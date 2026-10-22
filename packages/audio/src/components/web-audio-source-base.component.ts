import { AudioSourceDescriptor, GgWorld, IEntity } from '@gg-web-engine/core';
import { Observable, Subject } from 'rxjs';
import { DEFAULT_RAMP_TAU, holdParam, rampParam, setParamNow } from '../utils/ramp';
import { wrapPlayhead } from '../utils/playhead';
import { WebAudioSceneComponentBase } from './web-audio-scene-base.component';

/**
 * How long a source being made virtual fades out before its buffer source is stopped and its chain
 * disconnected: 5 time constants of `rampParam`'s `DEFAULT_RAMP_TAU`, by which point the gain is
 * under 1% (-43 dB) of where it started, so the cut can't be heard.
 */
export const VIRTUAL_FADE_SECONDS = 0.2;

/**
 * How long a source heard again in the middle of a timed fade (`fadeTo`) takes to reach the level
 * the fade has got to by then, before it follows the rest of the fade: 3 ramp time constants, the
 * same order as the short ramp every other gain change gets.
 */
export const FADE_CATCH_UP_SECONDS = 3 * DEFAULT_RAMP_TAU;

/**
 * Shortest wait, in milliseconds, between two checks of whether a timed fade has reached its end
 * on the audio clock - the clock stands still while the context is suspended, so the check repeats.
 */
const MIN_FADE_POLL_MS = 20;

/** A playing source's rendering state - see the class doc. `fading` is on its way to `virtual`. */
type VoiceState = 'real' | 'fading' | 'virtual';

/** A timed fade in progress (`fadeTo`): a straight line from `from` to `to` on the context clock. */
type GainFade = {
  from: number;
  to: number;
  startTime: number;
  endTime: number;
  resolve: (reached: boolean) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

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
 *
 * Timed fades (`fadeTo`) are a `linearRampToValueAtTime` on `gainNode`, mirrored on the main thread
 * (`fade`: start and end on the context clock), so the level a fade has reached is known without
 * reading the param back (`heardVolume`). Every other gain write first freezes such a ramp where it
 * is (`holdParam`) - a `setTargetAtTime` scheduled alongside a pending linear ramp would otherwise
 * be overridden by it. A virtual source schedules nothing; it joins the fade where it has got to
 * when it is heard again.
 *
 * Time: every timestamp a source keeps (playhead anchor, fade start/end, voice fade-out) is on the
 * scene's `clock`, which is the context clock except while a scene on a shared context is paused:
 * the scene then holds its sources (`holdForScenePause`: buffer sources stopped, the clock standing
 * still) and moves their timestamps on by the paused time when it resumes
 * (`releaseFromScenePause`), so nothing has to tell paused time apart afterwards. `AudioParam`
 * events are always scheduled on the context clock; nothing timed on the clock is scheduled while
 * the scene holds its sources.
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
  /** The timed fade in progress, `null` when none is. */
  private fade: GainFade | null = null;
  /** Context time until which `gainNode.gain` may hold a fade's linear ramp - a gain write before
   * then freezes it first. */
  private fadeScheduledUntil = 0;
  /** The level, and context time, a demotion started fading out from - where the gain is while
   * `fading` follows from them. */
  private demotedFrom = 0;
  private demotedAt = 0;

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
    const heard = this.heardVolume();
    this.endFade(false);
    this._volume = value;
    if (!this.gainSilenced) {
      this.rampGain(value, heard);
    }
  }

  /**
   * See `IAudioSourceComponent.fadeTo`. A `linearRampToValueAtTime` on the gain from the level
   * heard now, resolved by a timer that checks the scene's clock - so a suspended context (a paused
   * world) holds the fade and its promise alike, and so does a paused scene on a shared context
   * (`WebAudioSceneComponentBase.clock`).
   */
  public fadeTo(volume: number, durationMs: number): Promise<boolean> {
    if (!Number.isFinite(volume) || volume < 0) {
      throw new RangeError(`fadeTo volume must be a non-negative number, got ${volume}`);
    }
    if (!Number.isFinite(durationMs)) {
      throw new RangeError(`fadeTo duration must be a finite number of milliseconds, got ${durationMs}`);
    }
    const now = this.scene.clock;
    const heard = this.heardVolume(now);
    this.endFade(false);
    this._volume = volume;
    if (durationMs <= 0) {
      if (!this.gainSilenced) {
        this.rampGain(volume, heard);
      }
      return Promise.resolve(true);
    }
    return new Promise<boolean>(resolve => {
      const fade: GainFade = {
        from: heard,
        to: volume,
        startTime: now,
        endTime: now + durationMs / 1000,
        resolve,
        timer: null,
      };
      this.fade = fade;
      this.scene.fadeStarted(this);
      // a scene holding its sources (paused on a shared context) schedules it on resume
      if (!this.gainSilenced && !this.scene.holdsSources) {
        const gain = this.gainNode.gain;
        holdParam(this.scene.context, gain, heard);
        gain.linearRampToValueAtTime(volume, fade.endTime);
        this.fadeScheduledUntil = fade.endTime;
      }
      this.watchFade(fade);
    });
  }

  /**
   * The volume this source is at on the audio clock - the level a timed fade has reached, else
   * `volume` (the short ramp after a plain write is not modelled). What the voice ranking uses, so
   * a source fading out keeps its rank while it is still heard.
   */
  protected heardVolume(now: number = this.scene.clock): number {
    const fade = this.fade;
    return fade ? fadeLevel(fade, now) : this._volume;
  }

  /** The fade in progress, unless the clock is already past its end. */
  private runningFade(now: number): GainFade | null {
    return this.fade && now < this.fade.endTime ? this.fade : null;
  }

  /**
   * Schedules a check for the fade's end on the scene's clock; resolves it once reached, or with
   * `false` once the scene is disposed or the context closed (its clock never moves again).
   * Nothing is scheduled while the scene holds its sources: `releaseFromScenePause` checks again.
   */
  private watchFade(fade: GainFade): void {
    const remaining = fade.endTime - this.scene.clock;
    if (remaining <= 0 || this.scene.isDisposed || this.scene.context.state === 'closed') {
      if (this.fade === fade) {
        this.endFade(remaining <= 0);
      }
      return;
    }
    if (this.scene.holdsSources) {
      return;
    }
    fade.timer = setTimeout(
      () => {
        fade.timer = null;
        if (this.fade === fade) {
          this.watchFade(fade);
        }
      },
      Math.max(remaining * 1000, MIN_FADE_POLL_MS),
    );
  }

  /**
   * Forgets the fade in progress, resolving its promise with `reached` (or `true` once the clock is
   * past its end anyway). Leaves the gain as it is.
   */
  private endFade(reached: boolean): void {
    const fade = this.fade;
    if (!fade) {
      return;
    }
    this.fade = null;
    this.scene.fadeEnded(this);
    if (fade.timer !== null) {
      clearTimeout(fade.timer);
    }
    fade.resolve(reached || this.scene.clock >= fade.endTime);
  }

  /** Ramps the gain to `value` from `heard` (the level it is at now), freezing a fade's ramp first. */
  private rampGain(value: number, heard: number): void {
    const ctx = this.scene.context;
    if (this.fadeScheduledUntil > ctx.currentTime) {
      holdParam(ctx, this.gainNode.gain, heard);
    }
    this.fadeScheduledUntil = 0;
    rampParam(ctx, this.gainNode.gain, value);
  }

  /**
   * Takes the gain, anchored at the current time by the caller, to where this source should be
   * heard: a short ramp to `volume`, or, during a fade, to the level the fade reaches
   * `FADE_CATCH_UP_SECONDS` from now and then along the rest of it.
   */
  private rampGainIn(): void {
    const ctx = this.scene.context;
    const now = this.scene.clock;
    const fade = this.runningFade(now);
    if (!fade) {
      rampParam(ctx, this.gainNode.gain, this._volume);
      return;
    }
    const gain = this.gainNode.gain;
    const caughtUp = Math.min(now + FADE_CATCH_UP_SECONDS, fade.endTime);
    gain.linearRampToValueAtTime(fadeLevel(fade, caughtUp), caughtUp);
    if (caughtUp < fade.endTime) {
      gain.linearRampToValueAtTime(fade.to, fade.endTime);
    }
    this.fadeScheduledUntil = fade.endTime;
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

  /** Starts playing, from where `pause()` left it, or from the start. Does nothing on a source of a
   * disposed scene: a shared context keeps running, and nothing would ever stop it again. */
  public play(): void {
    if (this._isPlaying || this.scene.isDisposed) {
      return;
    }
    this._isPlaying = true;
    this.voiceState = 'real';
    this.playheadAnchorTime = this.scene.clock;
    if (this.scene.voiceStarted(this)) {
      this.connectOutput();
      // position/rotation set while the chain was disconnected (ended, paused or stopped as a
      // virtual voice) were only stored: write them before anything is heard
      this.resyncSpatialParams();
      if (this.scene.holdsSources) {
        // the scene is paused on a shared context: heard from its resume on
        // (`releaseFromScenePause` restores the gain and starts the buffer source)
        return;
      }
      if (this.gainSilenced) {
        // left faded out by an earlier virtual stretch; nothing is playing into it yet, so the
        // jump back to full volume (or to where a fade has got to) can't be heard
        this.restoreGain();
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
    if (this.scene.holdsSources) {
      // no buffer source plays while the scene is paused on a shared context: nothing to fade out
      this.voiceState = 'virtual';
      this.gainSilenced = true;
      this.disconnectOutput();
      return;
    }
    const now = this.scene.clock;
    this.voiceState = 'fading';
    this.fadeEndsAt = now + VIRTUAL_FADE_SECONDS;
    this.gainSilenced = true;
    this.demotedFrom = this.heardVolume(now);
    this.demotedAt = now;
    this.rampGain(0, this.demotedFrom);
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
    if (this.scene.holdsSources) {
      // paused on a shared context: wired up now, heard from the resume on (`gainSilenced` stays,
      // so `releaseFromScenePause` restores the gain before starting the buffer source)
      if (this.voiceState === 'virtual' && this.currentPlayhead().ended) {
        this.endNaturally();
        return;
      }
      this.stopBufferSource();
      this.voiceState = 'real';
      this.gainSilenced = true;
      this.connectOutput();
      this.resyncSpatialParams();
      return;
    }
    if (this.voiceState === 'fading') {
      // its buffer source is still running: just turn it back up
      this.voiceState = 'real';
      this.gainSilenced = false;
      if (this.runningFade(this.scene.clock)) {
        // the linear ramps of the fade need an anchor: where the demotion's ramp has got to
        const level = this.demotedFrom * Math.exp(-(this.scene.clock - this.demotedAt) / DEFAULT_RAMP_TAU);
        holdParam(ctx, this.gainNode.gain, level);
      }
      this.rampGainIn();
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
    this.rampGainIn();
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
    if (this.voiceState === 'fading' && this.scene.clock >= this.fadeEndsAt) {
      this.stopBufferSource();
      this.disconnectOutput();
      this.voiceState = 'virtual';
    }
    if (this.voiceState === 'virtual' && !this._loop && this.currentPlayhead().ended) {
      this.endNaturally();
    }
  }

  /**
   * @internal called by a scene on a shared context when it pauses (`setPaused(true)`), for every
   * source of it playing or fading. The scene's `clock` stands still from now on, which freezes the
   * playhead and a timed fade where they are; this stops what renders on the context clock, which
   * runs on: the buffer source of a heard voice (its node chain stays connected), a voice fading
   * out to go virtual (it goes virtual at once), and the fade's end check.
   */
  public holdForScenePause(): void {
    if (this.fade && this.fade.timer !== null) {
      clearTimeout(this.fade.timer);
      this.fade.timer = null;
    }
    if (!this._isPlaying) {
      return;
    }
    if (this.voiceState === 'fading') {
      this.stopBufferSource();
      this.disconnectOutput();
      this.voiceState = 'virtual';
    } else if (this.voiceState === 'real') {
      this.stopBufferSource();
    }
  }

  /**
   * @internal called by a scene on a shared context when it resumes (`setPaused(false)`), for every
   * source of it playing or fading, right after its `clock` runs again: moves every timestamp kept
   * on the clock on by `shift` (the seconds the scene was paused), so the playhead and a timed fade
   * continue where they stood; a heard voice gets its gain back to the level it was heard at (the
   * gain's automation ran on with the context clock, while nothing played into it), the rest of a
   * timed fade scheduled, and a new buffer source from its playhead. A voice that started playing
   * while paused starts here.
   */
  public releaseFromScenePause(shift: number): void {
    this.playheadAnchorTime += shift;
    this.fadeEndsAt += shift;
    this.demotedAt += shift;
    const fade = this.fade;
    if (fade) {
      fade.startTime += shift;
      fade.endTime += shift;
    }
    if (this._isPlaying && this.voiceState === 'real') {
      this.restoreGain();
      this.startBufferSource();
    } else if (!this._isPlaying && fade && !this.gainSilenced) {
      // a fade on a source that isn't playing: the gain follows it again, for the next play()
      this.restoreGain();
    }
    if (fade && this.fade === fade) {
      this.watchFade(fade);
    }
  }

  /**
   * Jumps the gain to the level this source is heard at now - where a timed fade has got to, else
   * `volume` - and schedules the rest of the fade. Only while nothing is playing into the gain, so
   * the jump can't be heard: a `play()` after a virtual stretch, a resume on a shared context.
   */
  private restoreGain(): void {
    const ctx = this.scene.context;
    const gain = this.gainNode.gain;
    setParamNow(ctx, gain, this.heardVolume());
    const fade = this.runningFade(this.scene.clock);
    if (fade) {
      gain.linearRampToValueAtTime(fade.to, fade.endTime);
      this.fadeScheduledUntil = fade.endTime;
    } else {
      this.fadeScheduledUntil = 0;
    }
    this.gainSilenced = false;
  }

  /**
   * @internal how loud this source is heard at `listenerPosition` (volume x bus volume, parent
   * buses included, x distance attenuation; `null` listener: no attenuation) - what the voice ranking compares.
   */
  public estimateGain(listenerPosition: D | null): number {
    let gain = this.heardVolume() * this.scene.getEffectiveBusVolume(this._bus);
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
      position += (this.scene.clock - this.playheadAnchorTime) * this._playbackRate;
    }
    return wrapPlayhead(position, this.clip.duration || 0, this._loop, this._loopStart, this._loopEnd);
  }

  /** Folds the time played so far into `playheadOffset` - before the rate or loop settings change,
   * so the time already played keeps the rate/loop it was played with. */
  private reanchorPlayhead(): void {
    if (this._isPlaying) {
      this.playheadOffset = this.currentPlayhead().offset;
      this.playheadAnchorTime = this.scene.clock;
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
    this.endFade(false);
    this.stop();
    this.disconnectSpatialNode();
    this.gainNode.disconnect();
    this.endedSubject.complete();
  }
}

/** The level `fade` is at on context time `time` (its start level before it, its target after it). */
function fadeLevel(fade: GainFade, time: number): number {
  const t = Math.min(1, Math.max(0, (time - fade.startTime) / (fade.endTime - fade.startTime)));
  return fade.from + (fade.to - fade.from) * t;
}

function checkPriority(value: number): number {
  if (Number.isNaN(value)) {
    throw new RangeError('Audio source priority must be a number, got NaN');
  }
  return value;
}
