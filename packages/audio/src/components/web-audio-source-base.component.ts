import { AudioSourceDescriptor, GgWorld, IEntity } from '@gg-web-engine/core';
import { Observable, Subject } from 'rxjs';
import { rampParam } from '../utils/ramp';
import { WebAudioSceneComponentBase } from './web-audio-scene-base.component';

/**
 * Shared implementation behind `WebAudioSource3dComponent`/`WebAudioSource2dComponent`: the
 * buffer-source/gain graph, play/pause/stop, bus routing, and the ramped-write discipline the
 * audio RFC's jitter fix depends on. Subclasses only add the spatial node (`PannerNode`/
 * `StereoPannerNode`) and `position`/`rotation`.
 *
 * A note on `AudioBufferSourceNode` reuse: per the Web Audio spec, a buffer source node can only
 * ever be `start()`ed once - it's discarded after `stop()`/naturally ending, never restarted. Every
 * `play()` call below creates a fresh one; what's reused across plays is everything *around* it
 * (`gainNode`, the spatial node, the bus routing), which is the actually expensive/limited part of
 * the graph to keep re-allocating. `AudioSourcePool` (see `utils/audio-source-pool.ts`) goes one
 * step further for high-frequency one-shots by reusing that surrounding chain across *many*
 * `IAudioSourceComponent` instances too, not just across replays of one.
 */
export abstract class WebAudioSourceComponentBase<D, R> {
  public entity: IEntity | null = null;

  protected readonly gainNode: GainNode;
  private bufferSource: AudioBufferSourceNode | null = null;
  private readonly endedSubject = new Subject<void>();
  public readonly ended$: Observable<void> = this.endedSubject.asObservable();

  private _loop: boolean;
  private _volume: number;
  private _playbackRate: number;
  private _spatial: boolean;
  private _bus: string;
  private _isPlaying = false;
  private startedAtContextTime = 0;
  private offsetSeconds = 0;

  protected readonly clip: AudioBuffer;

  protected constructor(
    protected readonly scene: WebAudioSceneComponentBase<D, R>,
    descriptor: AudioSourceDescriptor<AudioBuffer>,
  ) {
    this.clip = descriptor.clip;
    this._loop = descriptor.loop ?? false;
    this._volume = descriptor.volume ?? 1;
    this._playbackRate = descriptor.playbackRate ?? 1;
    this._spatial = descriptor.spatial ?? true;
    this._bus = descriptor.bus ?? 'sfx';

    this.gainNode = scene.context.createGain();
    this.gainNode.gain.value = this._volume;

    if (descriptor.autoplay ?? true) {
      // deferred one microtask so subclass constructors finish wiring their own spatial node
      // first (this constructor runs before theirs, since JS runs base constructors first)
      Promise.resolve().then(() => this.play());
    }
  }

  /** Connects `gainNode`'s output to the spatial node (when `spatial`) or straight to the bus. */
  protected abstract wireOutput(): void;

  protected abstract disconnectSpatialNode(): void;

  public abstract get position(): D;

  public abstract set position(value: D);

  public abstract get rotation(): R;

  public abstract set rotation(value: R);

  public abstract clone(): WebAudioSourceComponentBase<D, R>;

  public get loop(): boolean {
    return this._loop;
  }

  public set loop(value: boolean) {
    this._loop = value;
    if (this.bufferSource) {
      this.bufferSource.loop = value;
    }
  }

  public get volume(): number {
    return this._volume;
  }

  public set volume(value: number) {
    this._volume = value;
    rampParam(this.scene.context, this.gainNode.gain, value);
  }

  public get playbackRate(): number {
    return this._playbackRate;
  }

  public set playbackRate(value: number) {
    this._playbackRate = value;
    if (this.bufferSource) {
      rampParam(this.scene.context, this.bufferSource.playbackRate, value);
    }
  }

  public get spatial(): boolean {
    return this._spatial;
  }

  public set spatial(value: boolean) {
    if (this._spatial === value) {
      return;
    }
    this._spatial = value;
    this.wireOutput();
  }

  public get bus(): string {
    return this._bus;
  }

  public set bus(value: string) {
    this._bus = value;
    this.wireOutput();
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  protected getBusNode(): GainNode {
    return this.scene.getBusNode(this._bus);
  }

  public play(): void {
    if (this._isPlaying) {
      return;
    }
    const bufferSource = this.scene.context.createBufferSource();
    bufferSource.buffer = this.clip;
    bufferSource.loop = this._loop;
    bufferSource.playbackRate.value = this._playbackRate;
    bufferSource.connect(this.gainNode);
    bufferSource.onended = () => {
      // an explicit stop()/pause() also fires `onended` natively - only treat this as "playback
      // reached the end on its own" (and fire `ended$`) when this is still the live node
      if (this.bufferSource === bufferSource) {
        this._isPlaying = false;
        this.bufferSource = null;
        this.offsetSeconds = 0;
        this.endedSubject.next();
      }
    };
    const duration = this.clip.duration || 0;
    bufferSource.start(0, duration > 0 ? this.offsetSeconds % duration : 0);
    this.bufferSource = bufferSource;
    this._isPlaying = true;
    this.startedAtContextTime = this.scene.context.currentTime - this.offsetSeconds;
  }

  public pause(): void {
    if (!this._isPlaying || !this.bufferSource) {
      return;
    }
    this.offsetSeconds = this.scene.context.currentTime - this.startedAtContextTime;
    this.bufferSource.onended = null;
    this.bufferSource.stop();
    this.bufferSource = null;
    this._isPlaying = false;
  }

  public stop(): void {
    this.offsetSeconds = 0;
    if (this.bufferSource) {
      this.bufferSource.onended = null;
      this.bufferSource.stop();
      this.bufferSource = null;
    }
    this._isPlaying = false;
  }

  public addToWorld(_world: GgWorld<D, R, any>): void {
    this.scene.registerSource(this);
  }

  public removeFromWorld(_world: GgWorld<D, R, any>, dispose = false): void {
    this.scene.unregisterSource(this);
    if (dispose) {
      this.dispose();
    }
  }

  public dispose(): void {
    this.stop();
    this.disconnectSpatialNode();
    this.gainNode.disconnect();
    this.endedSubject.complete();
  }
}
