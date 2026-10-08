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
 * One bus's node graph: sources connect to `input`, whose gain is the bus volume; `input` feeds
 * `dry` (the reverb's dry level, `1` without a reverb) into the master gain, and, while a reverb is
 * heard, also its convolver, whose `wet` gain feeds the master gain too.
 */
type WebAudioBus = {
  input: GainNode;
  dry: GainNode;
  reverb: BusReverb | null;
};

/**
 * Shared implementation behind `WebAudioScene3dComponent`/`WebAudioScene2dComponent`: owns the
 * `AudioContext`, the master/bus gain graph (bus reverbs included), clip loading+caching, the
 * currently active listener reference, and the voice budget (`maxVoices`). Dimension-specific
 * listener orientation math lives in the two subclasses' `update()` overrides, which end with
 * `updateVoices()` and `updateReverbs()`.
 */
export abstract class WebAudioSceneComponentBase<D, R> {
  public readonly context: AudioContext;
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
  private readonly clipCache = new Map<string, Promise<AudioBuffer>>();
  private readonly sources = new Set<WebAudioSourceComponentBase<D, R>>();
  /** Every source of this scene that is playing (`isPlaying`), whether or not it was added to a
   * world (an `AudioSourcePool` voice never is) - what the voice budget ranks. */
  private readonly voices = new Set<WebAudioSourceComponentBase<D, R>>();
  private _maxVoices = Infinity;
  private _activeListener: IPositionable<D, R> | null = null;
  /** The `resume` closure bound in `init()`, kept around so `dispose()` can remove it if the
   * gesture never fires - `{ once: true }` only removes a listener once it *fires*, not on
   * dispose, so without this the window would keep holding a live reference to this (disposed)
   * scene's `resume` closure indefinitely. `null` whenever no listener is currently bound (never
   * bound, or already resumed/torn down). */
  private resumeListener: (() => void) | null = null;

  protected constructor() {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
  }

  public async init(): Promise<void> {
    if (this.context.state === 'suspended' && typeof window !== 'undefined' && !this.resumeListener) {
      const resume = () => {
        if (this.paused) {
          // the world is paused: `setPaused(false)` resumes the context, from this same gesture's
          // allowance, once the world continues
          return;
        }
        this.context.resume().catch(() => {
          /* ignore - browser will re-suspend until an accepted gesture happens */
        });
      };
      this.resumeListener = resume;
      // Browser autoplay policy: an AudioContext starts (or is forced back into) "suspended"
      // until a user gesture resumes it. Resuming on the first pointerdown/keydown covers the
      // overwhelming majority of apps without requiring them to wire this up themselves; an app
      // with its own "click to start" screen can call `world.audioScene.context.resume()`
      // directly from that click handler instead, which makes these listeners no-ops (removed on
      // the first successful resume regardless of which one fired).
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
      this.context.onstatechange = () => {
        if (this.context.state === 'running') {
          this.removeResumeListeners();
        }
      };
    }
  }

  /** Removes the `pointerdown`/`keydown` resume listeners bound in `init()`, if still bound -
   * shared by the "gesture arrived" path (`onstatechange` above) and `dispose()` (for the "scene
   * was torn down before any gesture arrived" case, see `resumeListener`'s doc). */
  private removeResumeListeners(): void {
    if (!this.resumeListener) {
      return;
    }
    window.removeEventListener('pointerdown', this.resumeListener);
    window.removeEventListener('keydown', this.resumeListener);
    this.resumeListener = null;
  }

  public get masterVolume(): number {
    return this.masterGain.gain.value;
  }

  public set masterVolume(value: number) {
    rampParam(this.context, this.masterGain.gain, value);
  }

  public getBusVolume(bus: string): number {
    return this.buses.get(bus)?.input.gain.value ?? 1;
  }

  public setBusVolume(bus: string, volume: number): void {
    rampParam(this.context, this.getBusNode(bus).gain, volume);
  }

  /** Lazily creates (and connects to `masterGain`) the named bus's input `GainNode` - what a source
   * connects to; its gain is the bus volume. */
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
      bus = { input, dry, reverb: null };
      this.buses.set(name, bus);
    }
    return bus;
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
    wet.connect(this.masterGain);
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

  /** @internal called by a source once it stops playing (pause/stop/end/dispose). The voice it
   * frees goes to the best virtual source on the next `update()`. */
  public voiceStopped(source: WebAudioSourceComponentBase<D, R>): void {
    this.voices.delete(source);
  }

  /**
   * Per-frame voice bookkeeping, called at the end of both subclasses' `update()`: finishes
   * fade-outs, ends virtual one-shots that have run out, and re-ranks every playing source against
   * `maxVoices` (sources move, volumes change). Nothing to do while the budget isn't exceeded and
   * nothing is virtual - the case for every scene that never sets `maxVoices`.
   */
  protected updateVoices(): void {
    let anyVirtual = false;
    for (const voice of this.voices) {
      if (voice.isVirtual) {
        anyVirtual = true;
        break;
      }
    }
    if (!anyVirtual && this.voices.size <= this._maxVoices) {
      return;
    }
    for (const voice of [...this.voices]) {
      voice.advanceVirtual();
    }
    this.rankVoices(null);
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
    return incomingAudible;
  }

  private paused: boolean = false;

  /**
   * Suspends the whole `AudioContext` while paused: every source, including ones scheduled but not
   * yet audible, stops where it is and continues from there - nothing has to be tracked per source.
   */
  public setPaused(paused: boolean): void {
    if (this.paused === paused) {
      return;
    }
    this.paused = paused;
    const change = paused ? this.context.suspend() : this.context.resume();
    change.catch(() => {
      /* closed, or not yet allowed to start by the browser - nothing to do either way */
    });
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

  public dispose(): void {
    this.removeResumeListeners();
    this.context.onstatechange = null;
    for (const source of [...this.sources]) {
      source.dispose();
    }
    this.sources.clear();
    this.voices.clear();
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
    this.context.close().catch(() => {
      /* already closed/closing - fine */
    });
  }
}
