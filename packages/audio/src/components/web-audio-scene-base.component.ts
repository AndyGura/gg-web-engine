import { AudioVoiceCounts, IPositionable } from '@gg-web-engine/core';
import { rankVoices, VoiceCandidate } from '../utils/voice-ranking';
import { rampParam } from '../utils/ramp';
import { WebAudioSourceComponentBase } from './web-audio-source-base.component';

/**
 * Shared implementation behind `WebAudioScene3dComponent`/`WebAudioScene2dComponent`: owns the
 * `AudioContext`, the master/bus gain graph, clip loading+caching, and the currently active
 * listener reference, and the voice budget (`maxVoices`). Dimension-specific listener orientation
 * math lives in the two subclasses' `update()` overrides, which end with `updateVoices()`.
 */
export abstract class WebAudioSceneComponentBase<D, R> {
  public readonly context: AudioContext;
  protected readonly masterGain: GainNode;
  private readonly buses = new Map<string, GainNode>();
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
    return this.buses.get(bus)?.gain.value ?? 1;
  }

  public setBusVolume(bus: string, volume: number): void {
    rampParam(this.context, this.getBusNode(bus).gain, volume);
  }

  /** Lazily creates (and connects to `masterGain`) the named bus's own `GainNode`. */
  public getBusNode(bus: string): GainNode {
    let node = this.buses.get(bus);
    if (!node) {
      node = this.context.createGain();
      node.connect(this.masterGain);
      this.buses.set(bus, node);
    }
    return node;
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
    for (const bus of this.buses.values()) {
      bus.disconnect();
    }
    this.buses.clear();
    this.masterGain.disconnect();
    this.context.close().catch(() => {
      /* already closed/closing - fine */
    });
  }
}
