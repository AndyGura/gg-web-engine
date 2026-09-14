import { IPositionable } from '@gg-web-engine/core';
import { rampParam } from '../utils/ramp';
import { WebAudioSourceComponentBase } from './web-audio-source-base.component';

/**
 * Shared implementation behind `WebAudioScene3dComponent`/`WebAudioScene2dComponent`: owns the
 * `AudioContext`, the master/bus gain graph, clip loading+caching, and the currently active
 * listener reference. Dimension-specific listener orientation math lives in the two subclasses'
 * `update()` overrides.
 */
export abstract class WebAudioSceneComponentBase<D, R> {
  public readonly context: AudioContext;
  protected readonly masterGain: GainNode;
  private readonly buses = new Map<string, GainNode>();
  private readonly clipCache = new Map<string, Promise<AudioBuffer>>();
  private readonly sources = new Set<WebAudioSourceComponentBase<D, R>>();
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
