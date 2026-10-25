import {
  AudioReverbSettings,
  AudioVoiceCounts,
  IPositionable,
  resolveAudioReverbSettings,
  ResolvedAudioReverbSettings,
  sameAudioReverbShape,
} from '@gg-web-engine/core';
import { rankVoices, VoiceCandidate } from '../utils/voice-ranking';
import { DEFAULT_RAMP_TAU, rampParam } from '../utils/ramp';
import { generateImpulseResponse } from '../utils/impulse-response';
import { WebAudioSourceComponentBase } from './web-audio-source-base.component';

/**
 * How long a reverb whose wet level went to 0 keeps its convolver connected (5 ramp time constants,
 * by then the ramp is below -40 dB), before it is disconnected and stops costing audio processing.
 */
export const REVERB_RELEASE_SECONDS = 5 * DEFAULT_RAMP_TAU;

/**
 * How often, in milliseconds, a scene that has virtual (or fading-out) voices checks whether a world
 * still drives its voice bookkeeping, and does it itself when no `update()` came since the last
 * check: a scene with no world (an app's menu scene, `MusicPlayer` and `playOneShot` on a scene of
 * their own) still promotes virtual sources once voices free up, finishes fade-outs and ends virtual
 * one-shots. A world ticking more often than this never sees it run.
 */
export const VOICE_UPKEEP_INTERVAL_MS = 50;

/**
 * How often, in milliseconds, a scene whose voice bookkeeping a world's `update()` does checks that
 * the world still does: once a check finds no `update()` since the one before, the scene does the
 * bookkeeping itself, every `VOICE_UPKEEP_INTERVAL_MS`.
 */
export const VOICE_UPKEEP_WATCH_MS = 250;

/**
 * The `window` events on which a scene resumes a held-back `AudioContext` (see
 * `WebAudioSceneComponentBase.init()`): `pointerdown` is a user activation for audio in Chromium
 * and Firefox but not on iOS, where `pointerup`, `touchend`, `click` and `keydown` are.
 */
export const RESUME_GESTURE_EVENTS: readonly string[] = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];

/** Capture phase, so an element stopping its events' propagation cannot hide a gesture. */
const RESUME_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

/** Options of `WebAudioScene3dComponent`/`WebAudioScene2dComponent`. */
export type WebAudioSceneOptions = {
  /**
   * An existing `AudioContext` to build the scene on - typically the one of an app's long-lived
   * menu scene, shared with every world the app creates later. Without it the scene creates a
   * context of its own and owns it (`ownsContext`). Every scene on one context leaves the others
   * playing: while more than one lives on it, `setPaused` pauses only the scene's own sources
   * instead of suspending the context, and the owner's `dispose()` hands the context to another
   * scene on it instead of closing it - the last one closes it. Only the owner binds the autoplay
   * gesture listeners. Everything else - master volume, buses and their hierarchy, bus reverbs, the
   * voice budget - is per scene, independent of any other scene on the same context. The context's
   * `listener` is shared too: see `WebAudioScene3dComponent`. Why share at all: on iOS a context
   * starts on its own only when it is created within a moment of a user gesture, so a world created
   * at the end of a long load would stay silent until the next tap, while a context the app
   * unlocked once keeps running; and suspending or closing a second context disturbs the first
   * one's audio there. A context no scene created (the app's own) is never suspended, resumed or
   * closed by any scene.
   */
  context?: AudioContext;
};

/** Every live scene on one `AudioContext`, and which of them manages it. */
type ContextShare = {
  scenes: Set<WebAudioSceneComponentBase<any, any>>;
  /** The scene that unlocks, suspends and closes the context - the one that created it, or the one
   * that took it over when that one was disposed. `null` for a context the app created. */
  owner: WebAudioSceneComponentBase<any, any> | null;
  /** Whether the app's own `context.suspend()` holds the context: no scene resumes it until the
   * app's own `context.resume()`. */
  suspendedByApp: boolean;
  /** The context's own `suspend()`/`resume()`, which the scenes call - not the app-facing ones. */
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
};

const contextShares = new WeakMap<AudioContext, ContextShare>();

/**
 * Registers `context`. On a context a scene created, the app-facing `suspend()`/`resume()` are
 * wrapped to record whether the app holds the context suspended itself, so neither a gesture nor
 * the end of a pause resumes it behind the app's back.
 */
function shareContext(context: AudioContext, created: boolean): ContextShare {
  const suspend = context.suspend.bind(context);
  const resume = context.resume.bind(context);
  const share: ContextShare = { scenes: new Set(), owner: null, suspendedByApp: false, suspend, resume };
  if (created) {
    context.suspend = () => {
      share.suspendedByApp = true;
      return suspend();
    };
    context.resume = () => {
      share.suspendedByApp = false;
      return resume();
    };
  }
  contextShares.set(context, share);
  return share;
}

const ignoreRejection = () => {
  /* closed, or not yet allowed to start by the browser - nothing to do either way */
};

/** A convolver and the gain of its output - one bus reverb as rendered. */
type ReverbChain = {
  convolver: ConvolverNode;
  wet: GainNode;
};

/** A bus's reverb: its settings, the impulse response built from their shape, and the chain that
 * renders it, `null` while `wet` is 0 (nothing to render). */
type BusReverb = {
  settings: ResolvedAudioReverbSettings;
  impulse: AudioBuffer;
  chain: ReverbChain | null;
};

/**
 * One bus's node graph: sources (and child buses) connect to `input`, whose gain is the bus volume;
 * `input` feeds `dry` (the reverb's dry level, `1` without a reverb) into the bus's output - its
 * parent bus's `input`, or the master gain - and, while a reverb is heard, also its convolver,
 * whose `wet` gain feeds that same output.
 */
type WebAudioBus = {
  input: GainNode;
  dry: GainNode;
  reverb: BusReverb | null;
  /** The bus volume last set - `input.gain.value` lags behind it while ramping. */
  volume: number;
  parent: string | null;
};

/**
 * Shared implementation behind `WebAudioScene3dComponent`/`WebAudioScene2dComponent`: the
 * `AudioContext` (its own, or a shared one - see `WebAudioSceneOptions.context`), the master/bus
 * gain graph (bus reverbs included), clip loading+caching, the currently active listener
 * reference, and the voice budget (`maxVoices`). Dimension-specific listener orientation math lives
 * in the two subclasses' `update()` overrides, which end with `updateVoices()` and
 * `updateReverbs()`. While voices are virtual and no world calls `update()`, a timer does the voice
 * bookkeeping instead (`VOICE_UPKEEP_INTERVAL_MS`).
 */
export abstract class WebAudioSceneComponentBase<D, R> {
  public readonly context: AudioContext;
  private readonly share: ContextShare;
  protected readonly masterGain: GainNode;
  private readonly buses = new Map<string, WebAudioBus>();
  /** Reverb chains fading out (wet level ramping to 0), disconnected by `updateReverbs()` once
   * `releaseAt` (context time) has passed - or taken back by their bus if it fades in again first. */
  private readonly releasingReverbs: {
    bus: WebAudioBus;
    impulse: AudioBuffer;
    chain: ReverbChain;
    releaseAt: number;
  }[] = [];
  private _masterVolume = 1;
  private readonly clipCache = new Map<string, Promise<AudioBuffer>>();
  private readonly sources = new Set<WebAudioSourceComponentBase<D, R>>();
  /** Every source of this scene that is playing (`isPlaying`), whether or not it was added to a
   * world (an `AudioSourcePool` voice never is) - what the voice budget ranks. */
  private readonly voices = new Set<WebAudioSourceComponentBase<D, R>>();
  /** Every source of this scene with a timed fade (`fadeTo`) in progress, playing or not - held and
   * released with the voices by `setPaused` while the scene holds its sources. */
  private readonly fadingSources = new Set<WebAudioSourceComponentBase<D, R>>();
  /** Context time at which the scene paused holding its sources (`setPaused(true)` with other
   * scenes on the context); `null` otherwise. See `clock`. */
  private pausedAt: number | null = null;
  /** Whether the scene is paused by having suspended its context (it was alone on it). */
  private suspendedForPause = false;
  private _maxVoices = Infinity;
  /** The self-driven voice bookkeeping timer, armed while any voice is virtual (or the budget is
   * exceeded) and the scene is neither paused nor disposed - see `VOICE_UPKEEP_INTERVAL_MS`. */
  private voiceUpkeepTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether `update()` ran the voice bookkeeping since the timer was armed: a world drives this
   * scene, so the timer leaves it alone. */
  private voicesUpdatedByWorld = false;
  private initialized = false;
  private disposed = false;
  private _activeListener: IPositionable<D, R> | null = null;
  /** The gesture handler bound in `init()` (see `RESUME_GESTURE_EVENTS`), kept so `dispose()` can
   * remove it: the listeners live as long as the scene, and without this the window would keep
   * holding this (disposed) scene's closure indefinitely. `null` whenever no listener is bound
   * (never bound - no `window`, as in SSR - or already torn down). */
  private resumeListener: (() => void) | null = null;
  /** The one-sample silent buffer played by `unlockFromGesture()`, built on first use. */
  private silentBuffer: AudioBuffer | null = null;

  protected constructor(options: WebAudioSceneOptions = {}) {
    if (options.context) {
      this.context = options.context;
      this.share = contextShares.get(options.context) ?? shareContext(options.context, false);
      for (const scene of this.share.scenes) {
        scene.holdInsteadOfSuspending();
      }
    } else {
      this.context = new AudioContext();
      this.share = shareContext(this.context, true);
      this.share.owner = this;
    }
    this.share.scenes.add(this);
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
  }

  /**
   * Whether this scene manages its `AudioContext`: resumes it on user gestures, suspends it while
   * paused alone on it, and closes it on `dispose()` unless other scenes still use it (it hands the
   * context to one of them then). `true` for a scene that created its context (no `context`
   * option), and for the scene that took one over from its disposed owner; `false` on a context
   * the app created itself. See `WebAudioSceneOptions.context`.
   */
  public get ownsContext(): boolean {
    return this.share.owner === this;
  }

  /**
   * @internal The time this scene's sources measure playheads, timed fades and voice fade-outs
   * against: `context.currentTime`, except while the scene is paused holding its sources, when it
   * stands still at the moment of the pause - the shared context's clock runs on, so
   * `setPaused(false)` moves those sources' timestamps on by the paused time (a suspended context
   * stops `currentTime` itself, so a scene pausing that way needs none of this).
   */
  public get clock(): number {
    return this.pausedAt ?? this.context.currentTime;
  }

  /**
   * @internal Whether this scene holds its sources (paused while other scenes play on its context):
   * no buffer source plays, a `play()` waits for `setPaused(false)`, and gain automation that would
   * be timed on the clock is left for then.
   */
  public get holdsSources(): boolean {
    return this.pausedAt !== null;
  }

  /** @internal Whether `dispose()` has run - a source of a disposed scene no longer plays. */
  public get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Arms the autoplay unlock. Browsers hold an `AudioContext` back until a user gesture lets it
   * play: Chromium and Firefox report it `'suspended'`, WebKit `'suspended'` or `'interrupted'`,
   * and iOS can interrupt a running context again at any time (a call, another app's audio, the
   * app going to the background). So for as long as the scene lives - not just until its first
   * resume - every `RESUME_GESTURE_EVENTS` event on `window` that finds the context neither
   * running nor closed, while the scene is not paused (`setPaused`), resumes it and starts a
   * silent one-sample buffer source within the gesture (WebKit starts a context it held back when
   * a node starts during a gesture). The listeners are capture-phase, so a control that stops its
   * events' propagation (`@gg-web-engine/mobile-controls` does) cannot hide the gesture, and
   * several event types are listened to because browsers differ in which ones count as a user
   * activation for audio (iOS ignores `pointerdown` but accepts `pointerup`/`touchend`/`click`/
   * `keydown`). A gesture finding the context running costs one state check. An app with its own
   * "click to start" screen can still call `world.audioScene.context.resume()` from that click.
   * Every event of one tap (`pointerdown`, `pointerup`, `touchend`, `click`) tries while the state
   * hasn't changed yet: which of them the browser accepts differs, and the silent buffer has to
   * start inside the accepted one, so none can be skipped. A context the app suspended itself
   * (`context.suspend()`) is left suspended until the app's own `context.resume()`.
   * Without a `window` (SSR, node) nothing is armed. A scene that does not own its context
   * (`ownsContext`) arms nothing either: unlocking the context is its owner's job. A scene that
   * takes a context over from its disposed owner arms the listeners then, if `init()` has run.
   */
  public async init(): Promise<void> {
    this.initialized = true;
    this.bindResumeListeners();
  }

  private bindResumeListeners(): void {
    if (typeof window === 'undefined' || !this.ownsContext || this.resumeListener || this.disposed) {
      return;
    }
    const resume = () => {
      // a paused world stays silent: `setPaused(false)` resumes the context once it continues
      // (and if that comes outside a gesture and the browser refuses, the next gesture does it)
      if (this.suspendedForPause || this.share.suspendedByApp || this.disposed || !this.needsResume()) {
        return;
      }
      this.share.resume().catch(() => {
        /* not an accepted gesture for this browser - the next one tries again */
      });
      this.unlockFromGesture();
    };
    this.resumeListener = resume;
    for (const type of RESUME_GESTURE_EVENTS) {
      window.addEventListener(type, resume, RESUME_LISTENER_OPTIONS);
    }
  }

  /** Whether the context is held back (`'suspended'`, or WebKit's `'interrupted'`) and could play. */
  private needsResume(): boolean {
    // `'interrupted'` is not in TypeScript's `AudioContextState` yet
    const state: string = this.context.state;
    return state !== 'running' && state !== 'closed';
  }

  /** Starts a one-sample silent buffer source into the destination, from inside a user gesture:
   * the classic iOS unlock, which makes WebKit start a context it held back. */
  private unlockFromGesture(): void {
    try {
      if (!this.silentBuffer) {
        this.silentBuffer = this.context.createBuffer(1, 1, this.context.sampleRate);
      }
      const source = this.context.createBufferSource();
      source.buffer = this.silentBuffer;
      source.connect(this.context.destination);
      source.onended = () => source.disconnect();
      source.start(0);
    } catch {
      /* a context that can't create nodes (closed, or a test double) - the resume() call stands */
    }
  }

  /** Removes the gesture listeners bound in `init()`, if bound - called by `dispose()`. */
  private removeResumeListeners(): void {
    if (!this.resumeListener) {
      return;
    }
    for (const type of RESUME_GESTURE_EVENTS) {
      window.removeEventListener(type, this.resumeListener, RESUME_LISTENER_OPTIONS);
    }
    this.resumeListener = null;
  }

  public get masterVolume(): number {
    return this._masterVolume;
  }

  public set masterVolume(value: number) {
    this._masterVolume = value;
    rampParam(this.context, this.masterGain.gain, value);
  }

  public getBusVolume(bus: string): number {
    return this.buses.get(bus)?.volume ?? 1;
  }

  public setBusVolume(bus: string, volume: number): void {
    const node = this.getBus(bus);
    node.volume = volume;
    rampParam(this.context, node.input.gain, volume);
  }

  /**
   * The level a bus applies to what is routed into it: its own volume times every parent bus's
   * (`masterVolume` not included). What the voice ranking multiplies a source's volume by.
   */
  public getEffectiveBusVolume(bus: string): number {
    let volume = 1;
    for (let name: string | null = bus; name !== null; name = this.buses.get(name)?.parent ?? null) {
      volume *= this.getBusVolume(name);
    }
    return volume;
  }

  /** Lazily creates (and connects to `masterGain`) the named bus's input `GainNode` - what a source
   * or a child bus connects to; its gain is the bus volume. */
  public getBusNode(bus: string): GainNode {
    return this.getBus(bus).input;
  }

  private getBus(name: string): WebAudioBus {
    let bus = this.buses.get(name);
    if (!bus) {
      const input = this.context.createGain();
      const dry = this.context.createGain();
      input.connect(dry);
      dry.connect(this.masterGain);
      bus = { input, dry, reverb: null, volume: 1, parent: null };
      this.buses.set(name, bus);
    }
    return bus;
  }

  /** Where a bus's dry and wet outputs go: its parent bus's input, or the master gain. */
  private busOutput(bus: WebAudioBus): AudioNode {
    return bus.parent === null ? this.masterGain : this.getBus(bus.parent).input;
  }

  /**
   * See `IAudioSceneComponent.setBusParent`. Reconnects the bus's `dry` gain and every reverb chain
   * it has (heard or still releasing) from the old output to the new one; nothing else changes, so
   * the sources routed into the bus and its own child buses stay connected as they are.
   */
  public setBusParent(name: string, parent: string | null): void {
    for (let ancestor = parent; ancestor !== null; ancestor = this.buses.get(ancestor)?.parent ?? null) {
      if (ancestor === name) {
        throw new RangeError(
          parent === name
            ? `audio bus "${name}" can't be its own parent`
            : `audio bus "${parent}" feeds into "${name}", so "${name}" can't feed into it`,
        );
      }
    }
    if (parent === null && !this.buses.has(name)) {
      return;
    }
    const bus = this.getBus(name);
    if (bus.parent === parent) {
      return;
    }
    const previous = this.busOutput(bus);
    bus.parent = parent;
    const next = this.busOutput(bus);
    const outputs = [bus.dry];
    if (bus.reverb?.chain) {
      outputs.push(bus.reverb.chain.wet);
    }
    for (const releasing of this.releasingReverbs) {
      if (releasing.bus === bus) {
        outputs.push(releasing.chain.wet);
      }
    }
    for (const output of outputs) {
      output.disconnect(previous);
      output.connect(next);
    }
  }

  public getBusParent(bus: string): string | null {
    return this.buses.get(bus)?.parent ?? null;
  }

  /**
   * See `IAudioSceneComponent.setBusReverb`. One `ConvolverNode` per bus, fed from the bus's input
   * (after its volume) in parallel with the dry path, with a procedurally generated impulse response
   * (`generateImpulseResponse`), built when the settings' shape is first given or changes. `wet`/
   * `dry` are ramped. While `wet` is 0 there is no convolver at all: the one that was heard ramps
   * out and is disconnected `REVERB_RELEASE_SECONDS` later (in `update()`); fading in again creates
   * a fresh one (no stale tail from before), or takes the releasing one back if it is still there.
   */
  public setBusReverb(name: string, settings: AudioReverbSettings | null): void {
    if (!settings) {
      const bus = this.buses.get(name);
      if (bus?.reverb) {
        this.releaseReverbChain(bus);
        bus.reverb = null;
        rampParam(this.context, bus.dry.gain, 1);
      }
      return;
    }
    const resolved = resolveAudioReverbSettings(settings);
    const bus = this.getBus(name);
    const previous = bus.reverb?.settings;
    if (!bus.reverb || !sameAudioReverbShape(bus.reverb.settings, resolved)) {
      this.releaseReverbChain(bus);
      bus.reverb = { settings: resolved, impulse: this.createImpulseResponse(resolved), chain: null };
    } else {
      bus.reverb.settings = resolved;
    }
    const reverb = bus.reverb;
    if (resolved.dry !== (previous?.dry ?? 1)) {
      rampParam(this.context, bus.dry.gain, resolved.dry);
    }
    if (resolved.wet === 0) {
      this.releaseReverbChain(bus);
    } else if (!reverb.chain) {
      reverb.chain = this.takeReverbChain(bus, reverb.impulse);
      rampParam(this.context, reverb.chain.wet.gain, resolved.wet);
    } else if (resolved.wet !== previous?.wet) {
      rampParam(this.context, reverb.chain.wet.gain, resolved.wet);
    }
  }

  public getBusReverb(bus: string): ResolvedAudioReverbSettings | null {
    return this.buses.get(bus)?.reverb?.settings ?? null;
  }

  private createImpulseResponse(settings: ResolvedAudioReverbSettings): AudioBuffer {
    const channels = generateImpulseResponse(this.context.sampleRate, settings, 2);
    const buffer = this.context.createBuffer(channels.length, channels[0].length, this.context.sampleRate);
    channels.forEach((data, i) => buffer.getChannelData(i).set(data));
    return buffer;
  }

  /** A chain rendering `impulse` for `bus`: the one still releasing if there is one (its wet gain
   * just ramps back up), otherwise a new one, connected and silent. */
  private takeReverbChain(bus: WebAudioBus, impulse: AudioBuffer): ReverbChain {
    const index = this.releasingReverbs.findIndex(r => r.bus === bus && r.impulse === impulse);
    if (index >= 0) {
      return this.releasingReverbs.splice(index, 1)[0].chain;
    }
    const convolver = this.context.createConvolver();
    convolver.buffer = impulse;
    const wet = this.context.createGain();
    // initial value of a node that isn't connected yet - nothing to click against
    wet.gain.value = 0;
    bus.input.connect(convolver);
    convolver.connect(wet);
    wet.connect(this.busOutput(bus));
    return { convolver, wet };
  }

  /** Ramps the bus's reverb chain (if any) out and queues it for disconnection. */
  private releaseReverbChain(bus: WebAudioBus): void {
    const chain = bus.reverb?.chain;
    if (!chain) {
      return;
    }
    rampParam(this.context, chain.wet.gain, 0);
    this.releasingReverbs.push({
      bus,
      impulse: bus.reverb!.impulse,
      chain,
      releaseAt: this.context.currentTime + REVERB_RELEASE_SECONDS,
    });
    bus.reverb!.chain = null;
  }

  private disconnectReverbChain(bus: WebAudioBus, chain: ReverbChain): void {
    bus.input.disconnect(chain.convolver);
    chain.convolver.disconnect();
    chain.wet.disconnect();
  }

  /** Per-frame: disconnects the reverb chains whose fade-out has finished. Called at the end of
   * both subclasses' `update()`. */
  protected updateReverbs(): void {
    if (this.releasingReverbs.length === 0) {
      return;
    }
    const now = this.context.currentTime;
    for (let i = this.releasingReverbs.length - 1; i >= 0; i--) {
      const { bus, chain, releaseAt } = this.releasingReverbs[i];
      if (now >= releaseAt) {
        this.disconnectReverbChain(bus, chain);
        this.releasingReverbs.splice(i, 1);
      }
    }
  }

  public get activeListener(): IPositionable<D, R> | null {
    return this._activeListener;
  }

  public setActiveListener(target: IPositionable<D, R> | null): void {
    this._activeListener = target;
  }

  public get maxVoices(): number {
    return this._maxVoices;
  }

  /**
   * See `IAudioSceneComponent.maxVoices`. `Infinity` (the default) renders every playing source
   * and skips ranking altogether. Applied at once: lowering it fades the outranked sources out,
   * raising it fades virtual ones back in.
   */
  public set maxVoices(value: number) {
    if (Number.isNaN(value) || value < 0) {
      throw new RangeError(`maxVoices must be a non-negative number or Infinity, got ${value}`);
    }
    this._maxVoices = value === Infinity ? Infinity : Math.floor(value);
    this.rankVoices(null);
  }

  public get voiceCounts(): AudioVoiceCounts {
    let virtual = 0;
    for (const voice of this.voices) {
      if (voice.isVirtual) {
        virtual++;
      }
    }
    return { playing: this.voices.size, audible: this.voices.size - virtual, virtual };
  }

  /**
   * @internal called by a source's `play()`. Returns whether it may be heard right away: always
   * while the budget isn't exceeded; otherwise every playing source is ranked, the newcomer
   * included, and the others are faded in/out to match.
   */
  public voiceStarted(source: WebAudioSourceComponentBase<D, R>): boolean {
    this.voices.add(source);
    if (this.voices.size <= this._maxVoices) {
      return true;
    }
    return this.rankVoices(source);
  }

  /** @internal called by a source when a timed fade (`fadeTo`) starts. */
  public fadeStarted(source: WebAudioSourceComponentBase<D, R>): void {
    this.fadingSources.add(source);
  }

  /** @internal called by a source when its timed fade ends, reached or interrupted. */
  public fadeEnded(source: WebAudioSourceComponentBase<D, R>): void {
    this.fadingSources.delete(source);
  }

  /** @internal called by a source once it stops playing (pause/stop/end/dispose). The voice it
   * frees goes to the best virtual source on the next voice bookkeeping pass: the next `update()`,
   * or within `VOICE_UPKEEP_INTERVAL_MS` on a scene no world updates. */
  public voiceStopped(source: WebAudioSourceComponentBase<D, R>): void {
    this.voices.delete(source);
  }

  /**
   * Per-frame voice bookkeeping, called at the end of both subclasses' `update()`: finishes
   * fade-outs, ends virtual one-shots that have run out, and re-ranks every playing source against
   * `maxVoices` (sources move, volumes change). Nothing to do while the budget isn't exceeded and
   * nothing is virtual - the case for every scene that never sets `maxVoices`. Also tells the
   * self-driven timer that a world drives this scene, so it does nothing itself.
   */
  protected updateVoices(): void {
    this.upkeepVoices();
    // after the pass, whose ranking may have armed the timer (which clears the flag)
    this.voicesUpdatedByWorld = true;
  }

  /** Whether the voice bookkeeping has anything to do: a voice is virtual (or fading out), or more
   * sources play than the budget allows. */
  private needsVoiceUpkeep(): boolean {
    if (this.voices.size > this._maxVoices) {
      return true;
    }
    for (const voice of this.voices) {
      if (voice.isVirtual) {
        return true;
      }
    }
    return false;
  }

  private upkeepVoices(): void {
    if (!this.needsVoiceUpkeep()) {
      return;
    }
    for (const voice of [...this.voices]) {
      voice.advanceVirtual();
    }
    this.rankVoices(null);
  }

  /**
   * Arms the self-driven voice bookkeeping timer if the scene needs it and it isn't armed yet.
   * Called whenever a ranking leaves a source virtual, and on `setPaused(false)`.
   */
  private armVoiceUpkeep(delayMs: number = VOICE_UPKEEP_INTERVAL_MS): void {
    if (this.voiceUpkeepTimer !== null || this.paused || this.disposed || !this.needsVoiceUpkeep()) {
      return;
    }
    this.voicesUpdatedByWorld = false;
    this.voiceUpkeepTimer = setTimeout(this.onVoiceUpkeepTimer, delayMs);
  }

  private readonly onVoiceUpkeepTimer = (): void => {
    this.voiceUpkeepTimer = null;
    // a world's `update()` did it since the timer was armed: only check now and then that the world
    // still does
    const worldDriven = this.voicesUpdatedByWorld;
    if (!worldDriven) {
      this.upkeepVoices();
    }
    this.armVoiceUpkeep(worldDriven ? VOICE_UPKEEP_WATCH_MS : VOICE_UPKEEP_INTERVAL_MS);
  };

  private disarmVoiceUpkeep(): void {
    if (this.voiceUpkeepTimer !== null) {
      clearTimeout(this.voiceUpkeepTimer);
      this.voiceUpkeepTimer = null;
    }
  }

  /** Ranks every playing source, promotes/demotes all but `incoming`, and returns whether
   * `incoming` (a source starting to play, not yet heard) made the cut. */
  private rankVoices(incoming: WebAudioSourceComponentBase<D, R> | null): boolean {
    const listenerPosition = this._activeListener?.position ?? null;
    const candidates: (VoiceCandidate & { source: WebAudioSourceComponentBase<D, R> })[] = [];
    for (const source of this.voices) {
      candidates.push({
        source,
        priority: source.priority,
        gain: source.estimateGain(listenerPosition),
        audible: source !== incoming && !source.isVirtual,
        order: source.voiceOrder,
      });
    }
    const { audible, virtual } = rankVoices(candidates, this._maxVoices);
    let incomingAudible = false;
    for (const { source } of virtual) {
      if (source !== incoming) {
        source.demote();
      }
    }
    for (const { source } of audible) {
      if (source === incoming) {
        incomingAudible = true;
      } else {
        source.promote();
      }
    }
    if (virtual.length > 0) {
      this.armVoiceUpkeep();
    }
    return incomingAudible;
  }

  private paused: boolean = false;

  /**
   * A scene owning its context and alone on it suspends the whole `AudioContext` while paused:
   * every source, including ones scheduled but not yet audible, stops where it is and continues
   * from there - nothing has to be tracked per source. The resume is skipped while the app holds
   * the context suspended itself (`context.suspend()`).
   *
   * With other scenes on the context, the scene leaves it running - they play on it - and holds
   * only its own sources instead: every playing one stops its buffer source and keeps its playhead
   * (`clock` stands still), and starts a new one from there on resume, at the level it was heard
   * at; a voice fading out to go virtual becomes virtual at once. A `play()` meanwhile counts as
   * playing (`isPlaying`, the voice budget) but is heard only from the resume on. Timed fades
   * (`fadeTo`) hold where they are and continue on resume, their promises too, as on a suspended
   * context; virtual one-shots don't run out meanwhile. A scene paused alone that another scene
   * joins (`WebAudioSceneOptions.context`) switches to this and resumes the context for it.
   *
   * Either way the self-driven voice bookkeeping stops meanwhile too.
   */
  public setPaused(paused: boolean): void {
    if (this.paused === paused || this.disposed) {
      return;
    }
    this.paused = paused;
    if (paused) {
      this.disarmVoiceUpkeep();
      if (this.ownsContext && this.share.scenes.size === 1) {
        this.suspendedForPause = true;
        this.share.suspend().catch(ignoreRejection);
      } else {
        this.holdSources();
      }
      return;
    }
    if (this.suspendedForPause) {
      this.suspendedForPause = false;
      this.resumeContext();
    } else {
      this.releaseSources();
    }
    this.armVoiceUpkeep();
  }

  /** Resumes the context, unless the app holds it suspended itself. */
  private resumeContext(): void {
    if (!this.share.suspendedByApp) {
      this.share.resume().catch(ignoreRejection);
    }
  }

  /** Pauses this scene's sources on a context left running - see `setPaused`. */
  private holdSources(): void {
    this.pausedAt = this.context.currentTime;
    for (const source of this.timedSources()) {
      source.holdForScenePause();
    }
  }

  private releaseSources(): void {
    const shift = this.context.currentTime - this.pausedAt!;
    this.pausedAt = null;
    for (const source of this.timedSources()) {
      source.releaseFromScenePause(shift);
    }
  }

  /** Called when another scene joins this scene's context: one paused by suspending the context
   * holds its own sources instead, and lets the context run for the newcomer. */
  private holdInsteadOfSuspending(): void {
    if (!this.suspendedForPause) {
      return;
    }
    this.suspendedForPause = false;
    this.holdSources();
    this.resumeContext();
  }

  /** The sources whose state runs on `clock`: the playing ones and the ones with a timed fade. */
  private timedSources(): Set<WebAudioSourceComponentBase<D, R>> {
    return new Set([...this.voices, ...this.fadingSources]);
  }

  /** Decodes an already-fetched audio file - what `loadClip` does after its own fetch. */
  public decodeClip(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.context.decodeAudioData(data);
  }

  public async loadClip(url: string): Promise<AudioBuffer> {
    let promise = this.clipCache.get(url);
    if (!promise) {
      promise = fetch(url)
        .then(response => response.arrayBuffer())
        .then(buffer => this.context.decodeAudioData(buffer));
      this.clipCache.set(url, promise);
    }
    return promise;
  }

  /** @internal called from `WebAudioSourceComponentBase`'s own lifecycle - not app-facing. */
  public registerSource(source: WebAudioSourceComponentBase<D, R>): void {
    this.sources.add(source);
  }

  /** @internal called from `WebAudioSourceComponentBase`'s own lifecycle - not app-facing. */
  public unregisterSource(source: WebAudioSourceComponentBase<D, R>): void {
    this.sources.delete(source);
  }

  protected get livingSources(): ReadonlySet<WebAudioSourceComponentBase<D, R>> {
    return this.sources;
  }

  public abstract update(elapsed: number, delta: number): void;

  /**
   * Disposes the sources added to a world and every other source of the scene still playing or
   * fading (a `MusicPlayer` track, a pooled voice), disconnects every node the scene created (bus
   * gains, reverb chains, the master gain) and removes its gesture listeners and timers; a source of
   * the scene left idle no longer plays. Nothing of another scene on the context is touched. A scene
   * owning its context then closes it, unless other scenes still use it: it hands the context to
   * one of them (`ownsContext`), which closes it once disposed itself, last.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.disarmVoiceUpkeep();
    this.removeResumeListeners();
    this.share.scenes.delete(this);
    const sources = this.timedSources();
    for (const source of this.sources) {
      sources.add(source);
    }
    for (const source of sources) {
      source.dispose();
    }
    this.sources.clear();
    this.voices.clear();
    this.fadingSources.clear();
    this.pausedAt = null;
    for (const { bus, chain } of this.releasingReverbs) {
      this.disconnectReverbChain(bus, chain);
    }
    this.releasingReverbs.length = 0;
    for (const bus of this.buses.values()) {
      if (bus.reverb?.chain) {
        this.disconnectReverbChain(bus, bus.reverb.chain);
      }
      bus.input.disconnect();
      bus.dry.disconnect();
    }
    this.buses.clear();
    this.masterGain.disconnect();
    this.silentBuffer = null;
    if (this.share.owner !== this) {
      return;
    }
    const [heir] = this.share.scenes;
    this.share.owner = heir ?? null;
    if (heir) {
      heir.inheritContext();
      return;
    }
    this.context.close().catch(() => {
      /* already closed/closing - fine */
    });
  }

  /** Called on the scene taking the context over from its disposed owner: it unlocks it on gestures
   * from now on (if `init()` has run), and suspends and closes it as an owner does. */
  private inheritContext(): void {
    if (this.initialized) {
      this.bindResumeListeners();
    }
  }
}
