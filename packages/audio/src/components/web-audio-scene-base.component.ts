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
  private resumeListenersBound = false;

  protected constructor() {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
  }

  public async init(): Promise<void> {
    if (this.context.state === 'suspended' && typeof window !== 'undefined' && !this.resumeListenersBound) {
      this.resumeListenersBound = true;
      const resume = () => {
        this.context.resume().catch(() => {
          /* ignore - browser will re-suspend until an accepted gesture happens */
        });
      };
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
          window.removeEventListener('pointerdown', resume);
          window.removeEventListener('keydown', resume);
        }
      };
    }
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
