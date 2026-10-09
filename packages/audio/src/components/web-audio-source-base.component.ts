import { AudioSourceDescriptor, GgWorld, IEntity } from '@gg-web-engine/core';
import { Observable, Subject } from 'rxjs';
import { rampParam, setParamNow } from '../utils/ramp';
import { wrapPlayhead } from '../utils/playhead';
import { WebAudioSceneComponentBase } from './web-audio-scene-base.component';

/**
 * How long a source being made virtual fades out before its buffer source is stopped and its chain
 * disconnected: 5 time constants of `rampParam`'s `DEFAULT_RAMP_TAU`, by which point the gain is
 * under 1% (-43 dB) of where it started, so the cut can't be heard.
 */
export const VIRTUAL_FADE_SECONDS = 0.2;

/** A playing source's rendering state - see the class doc. `fading` is on its way to `virtual`. */
type VoiceState = 'real' | 'fading' | 'virtual';

/**
 * Shared implementation behind `WebAudioSource3dComponent`/`WebAudioSource2dComponent`: the
 * buffer-source/gain graph, play/pause/stop, bus routing, and the ramped-write discipline
 * `utils/ramp.ts`'s doc explains (every `AudioParam` write goes through `rampParam`, never a
 * direct `.value =`, to avoid audible zipper noise on per-tick position/volume changes).
 * Subclasses only add the spatial node (`PannerNode`/`StereoPannerNode`) and `position`/
 * `rotation`.
 *
 * A note on `AudioBufferSourceNode` reuse: per the Web Audio spec, a buffer source node can only
 * ever be `start()`ed once - it's discarded after `stop()`/naturally ending, never restarted. Every
 * `play()` call below creates a fresh one; what's reused across plays is everything *around* it
 * (`gainNode`, the spatial node, the bus routing), which is the actually expensive/limited part of
 * the graph to keep re-allocating. `AudioSourcePool` (see `utils/audio-source-pool.ts`) goes one
 * step further for high-frequency one-shots by reusing that surrounding chain across *many*
 * `IAudioSourceComponent` instances too, not just across replays of one.
 *
 * Voice budget (`WebAudioSceneComponentBase.maxVoices`): the scene tells a playing source to go
 * virtual (`demote`) or to be heard again (`promote`). Going virtual fades the gain out
 * (`VIRTUAL_FADE_SECONDS`), then stops the buffer source and disconnects this source's node chain
 * from its bus, so neither it nor its `PannerNode` costs any rendering. The playback position is
 * tracked on the main thread the whole time (context time x playback rate, wrapped by the clip's
 * loop region - `utils/playhead.ts`), so a promoted source starts a new buffer source exactly where
 * the old one would be, and fades in from silence. While cut off from the output, per-tick
 * `AudioParam` writes (volume, position) are only stored, not scheduled, and re-applied at once
 * (`setParamNow`, legal because the chain is silent) right before the fade-in: a node outside the
 * rendered graph never processes its automation events, so scheduling them every tick would just
 * pile them up.
 */
export abstract class WebAudioSourceComponentBase<D, R> {
  private static nextVoiceOrder = 0;

  public entity: IEntity | null = null;

  protected readonly gainNode: GainNode;
  private bufferSource: AudioBufferSourceNode | null = null;
  private readonly endedSubject = new Subject<void>();
  public readonly ended$: Observable<void> = this.endedSubject.asObservable();

  /** @internal creation order, the voice ranking's last tie-break. */
  public readonly voiceOrder = WebAudioSourceComponentBase.nextVoiceOrder++;

  private _loop: boolean;
  private _loopStart: number;
  private _loopEnd: number;
  private _volume: number;
  private _playbackRate: number;
  private _spatial: boolean;
  private _bus: string;
  private _priority: number;
  private _isPlaying = false;
  private voiceState: VoiceState = 'real';
  private fadeEndsAt = 0;
  /** Whether this source's node chain is connected to its bus - `false` only while virtual (or
   * after having ended/paused virtual, until the next `play()`). */
  private outputConnected = true;
  /** Whether `gainNode` was ramped away from `_volume` (towards 0, for going virtual). */
  private gainSilenced = false;
  /** Clip position (seconds, rate applied) at context time `playheadAnchorTime`. While not
   * playing: where the next `play()` starts from. */
  private playheadOffset = 0;
  private playheadAnchorTime = 0;

  protected readonly clip: AudioBuffer;

  protected constructor(
    protected readonly scene: WebAudioSceneComponentBase<D, R>,
    descriptor: AudioSourceDescriptor<AudioBuffer>,
  ) {
    this.clip = descriptor.clip;
    this._loop = descriptor.loop ?? false;
    this._loopStart = descriptor.loopStart ?? 0;
    this._loopEnd = descriptor.loopEnd ?? 0;
    this._volume = descriptor.volume ?? 1;
    this._playbackRate = descriptor.playbackRate ?? 1;
    this._spatial = descriptor.spatial ?? true;
    this._bus = descriptor.bus ?? 'sfx';
    this._priority = checkPriority(descriptor.priority ?? 0);

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

  /**
   * Distance attenuation at `listenerPosition`, from this source's own distance model - what the
   * voice ranking uses to tell how loud a spatial source is heard. Only called for a spatial source.
   */
  protected abstract distanceGainAt(listenerPosition: D): number;

  /**
   * Writes the stored position/rotation (and, in 2D, pan/distance gain) into the spatial node at
   * once, without a ramp - called right before a virtual source is heard again, while its chain is
   * still silent. See the class doc.
   */
  protected abstract resyncSpatialParams(): void;

  public abstract get position(): D;

  public abstract set position(value: D);

  public abstract get rotation(): R;

  public abstract set rotation(value: R);

  public abstract clone(): WebAudioSourceComponentBase<D, R>;

  /** Whether this source's node chain is part of the rendered graph right now - subclasses skip
   * per-tick `AudioParam` writes while it isn't (see the class doc). */
  protected get isOutputConnected(): boolean {
    return this.outputConnected;
  }

  public get loop(): boolean {
    return this._loop;
  }

  public set loop(value: boolean) {
    this.reanchorPlayhead();
    this._loop = value;
    if (this.bufferSource) {
      this.bufferSource.loop = value;
    }
  }

  public get loopStart(): number {
    return this._loopStart;
  }

  public set loopStart(value: number) {
    this.reanchorPlayhead();
    this._loopStart = value;
    if (this.bufferSource) {
      this.bufferSource.loopStart = value;
    }
  }

  public get loopEnd(): number {
    return this._loopEnd;
  }

  public set loopEnd(value: number) {
    this.reanchorPlayhead();
    this._loopEnd = value;
    if (this.bufferSource) {
      this.bufferSource.loopEnd = value;
    }
  }

  public get volume(): number {
    return this._volume;
  }

  public set volume(value: number) {
    this._volume = value;
    if (!this.gainSilenced) {
      rampParam(this.scene.context, this.gainNode.gain, value);
    }
  }

  public get playbackRate(): number {
    return this._playbackRate;
  }

  public set playbackRate(value: number) {
    this.reanchorPlayhead();
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
    if (this.outputConnected) {
      this.wireOutput();
    }
  }

  public get bus(): string {
    return this._bus;
  }

  public set bus(value: string) {
    this._bus = value;
    if (this.outputConnected) {
      this.wireOutput();
    }
  }

  public get priority(): number {
    return this._priority;
  }

  public set priority(value: number) {
    this._priority = checkPriority(value);
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get isVirtual(): boolean {
    return this._isPlaying && this.voiceState !== 'real';
  }

  protected getBusNode(): GainNode {
    return this.scene.getBusNode(this._bus);
  }

  public play(): void {
    if (this._isPlaying) {
      return;
    }
    this._isPlaying = true;
    this.voiceState = 'real';
    this.playheadAnchorTime = this.scene.context.currentTime;
    if (this.scene.voiceStarted(this)) {
      this.connectOutput();
      // position/rotation set while the chain was disconnected (ended, paused or stopped as a
      // virtual voice) were only stored: write them before anything is heard
      this.resyncSpatialParams();
      if (this.gainSilenced) {
        // left faded out by an earlier virtual stretch; nothing is playing into it yet, so the
        // jump back to full volume can't be heard
        setParamNow(this.scene.context, this.gainNode.gain, this._volume);
        this.gainSilenced = false;
      }
      this.startBufferSource();
    } else {
      // outranked from the start: never heard until promoted
      this.voiceState = 'virtual';
      this.gainSilenced = true;
      this.disconnectOutput();
    }
  }

  public pause(): void {
    if (!this._isPlaying) {
      return;
    }
    this.playheadOffset = this.currentPlayhead().offset;
    this.stopBufferSource();
    this.setStopped();
  }

  public stop(): void {
    this.playheadOffset = 0;
    this.stopBufferSource();
    if (this._isPlaying) {
      this.setStopped();
    }
  }

  /**
   * @internal called by the scene's voice ranking: this playing source ranks outside the voice
   * budget. Fades it out, then (`advanceVirtual`) stops rendering it.
   */
  public demote(): void {
    if (!this._isPlaying || this.voiceState !== 'real') {
      return;
    }
    this.voiceState = 'fading';
    this.fadeEndsAt = this.scene.context.currentTime + VIRTUAL_FADE_SECONDS;
    this.gainSilenced = true;
    rampParam(this.scene.context, this.gainNode.gain, 0);
  }

  /**
   * @internal called by the scene's voice ranking: this playing source ranks inside the voice
   * budget again. Fades it back in, from where it would be by now.
   */
  public promote(): void {
    if (!this._isPlaying || this.voiceState === 'real') {
      return;
    }
    const ctx = this.scene.context;
    if (this.voiceState === 'fading') {
      // its buffer source is still running: just turn it back up
      this.voiceState = 'real';
      this.gainSilenced = false;
      rampParam(ctx, this.gainNode.gain, this._volume);
      return;
    }
    if (this.currentPlayhead().ended) {
      this.endNaturally();
      return;
    }
    this.voiceState = 'real';
    this.connectOutput();
    this.resyncSpatialParams();
    setParamNow(ctx, this.gainNode.gain, 0);
    this.gainSilenced = false;
    this.startBufferSource();
    rampParam(ctx, this.gainNode.gain, this._volume);
  }

  /**
   * @internal called by the scene once per `update()` for every playing source while any is
   * virtual: completes a finished fade-out (stops the buffer source, disconnects the chain) and
   * ends a virtual one-shot once it would have reached its end.
   */
  public advanceVirtual(): void {
    if (!this._isPlaying) {
      return;
    }
    if (this.voiceState === 'fading' && this.scene.context.currentTime >= this.fadeEndsAt) {
      this.stopBufferSource();
      this.disconnectOutput();
      this.voiceState = 'virtual';
    }
    if (this.voiceState === 'virtual' && !this._loop && this.currentPlayhead().ended) {
      this.endNaturally();
    }
  }

  /**
   * @internal how loud this source is heard at `listenerPosition` (volume x bus volume x distance
   * attenuation; `null` listener: no attenuation) - what the voice ranking compares.
   */
  public estimateGain(listenerPosition: D | null): number {
    let gain = this._volume * this.scene.getBusVolume(this._bus);
    if (this._spatial && listenerPosition !== null && gain > 0) {
      gain *= this.distanceGainAt(listenerPosition);
    }
    return gain;
  }

  private startBufferSource(): void {
    const { offset } = this.currentPlayhead();
    const bufferSource = this.scene.context.createBufferSource();
    bufferSource.buffer = this.clip;
    bufferSource.loop = this._loop;
    bufferSource.loopStart = this._loopStart;
    bufferSource.loopEnd = this._loopEnd;
    bufferSource.playbackRate.value = this._playbackRate;
    bufferSource.connect(this.gainNode);
    bufferSource.onended = () => {
      // an explicit stop()/pause() also fires `onended` natively - only treat this as "playback
      // reached the end on its own" (and fire `ended$`) when this is still the live node
      if (this.bufferSource === bufferSource) {
        this.endNaturally();
      }
    };
    const duration = this.clip.duration || 0;
    bufferSource.start(0, duration > 0 ? Math.min(offset, duration) : 0);
    this.bufferSource = bufferSource;
  }

  private stopBufferSource(): void {
    if (this.bufferSource) {
      this.bufferSource.onended = null;
      this.bufferSource.stop();
      this.bufferSource = null;
    }
  }

  private endNaturally(): void {
    this.bufferSource = null;
    this.playheadOffset = 0;
    this.setStopped();
    this.endedSubject.next();
  }

  private setStopped(): void {
    this._isPlaying = false;
    this.voiceState = 'real';
    this.scene.voiceStopped(this);
  }

  private connectOutput(): void {
    if (!this.outputConnected) {
      this.wireOutput();
      this.outputConnected = true;
    }
  }

  private disconnectOutput(): void {
    if (this.outputConnected) {
      this.gainNode.disconnect();
      this.disconnectSpatialNode();
      this.outputConnected = false;
    }
  }

  /** Where playback is now (or, while not playing, where it resumes), wrapped into the clip. */
  private currentPlayhead(): { offset: number; ended: boolean } {
    let position = this.playheadOffset;
    if (this._isPlaying) {
      position += (this.scene.context.currentTime - this.playheadAnchorTime) * this._playbackRate;
    }
    return wrapPlayhead(position, this.clip.duration || 0, this._loop, this._loopStart, this._loopEnd);
  }

  /** Folds the time played so far into `playheadOffset` - before the rate or loop settings change,
   * so the time already played keeps the rate/loop it was played with. */
  private reanchorPlayhead(): void {
    if (this._isPlaying) {
      this.playheadOffset = this.currentPlayhead().offset;
      this.playheadAnchorTime = this.scene.context.currentTime;
    }
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

function checkPriority(value: number): number {
  if (Number.isNaN(value)) {
    throw new RangeError('Audio source priority must be a number, got NaN');
  }
  return value;
}
