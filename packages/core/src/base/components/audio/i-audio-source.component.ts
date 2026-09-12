import { Observable } from 'rxjs';
import { IWorldComponent } from '../i-world-component';
import { AudioTypeDocRepo, GgWorldTypeDocAPatch } from '../../gg-world';
import { IPositionable } from '../../interfaces/i-positionable';

/**
 * How a positional audio source's gain falls off with distance from the listener - the same
 * three curves the Web Audio `PannerNode` itself offers, so `packages/audio` (and any future
 * adapter built on the same primitive) can map this straight through. `'inverse'`'s slope is
 * steepest close to `refDistance` - the audio RFC's jitter investigation found this to be the
 * main amplifier of otherwise-inaudible per-tick position jitter into an audible volume swing for
 * a source sitting close to the listener (e.g. a chase-cammed vehicle's own engine), which is why
 * `IAudioSource3dComponent`/`IAudioSource2dComponent` default to `'linear'` instead.
 */
export type AudioDistanceModel = 'linear' | 'inverse' | 'exponential';

/**
 * Settings for a new audio source, handed to `IAudioSceneComponent['factory'].createSource`.
 * `clip` is whatever decoded/loadable representation the adapter's own factory produces from
 * `loadClip` (e.g. a Web Audio `AudioBuffer`) - never a raw URL, so a level JSON's `"Sound"` class
 * and the `"PlaySound"` blueprint node both resolve a clip via `loadClip` first.
 */
export interface AudioSourceDescriptor<Clip = unknown> {
  clip: Clip;
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
  /**
   * Positional (spatialized relative to the active listener) vs. flat/non-positional audio.
   * Defaults to `true`. Set `false` for ambient/music/UI sounds, or for a source whose distance
   * to the listener can't meaningfully change (e.g. the player's own chase-cammed vehicle) - see
   * the audio RFC's case study on engine sound for why that case specifically benefits from
   * turning spatialization off rather than tuning it.
   */
  spatial?: boolean;
  /**
   * Output bus/category name (e.g. `"sfx"`, `"music"`, `"ambient"`) - see
   * `IAudioSceneComponent.setBusVolume`. Defaults to `"sfx"`. Bus names don't need to be declared
   * up front; an unset bus behaves as if its volume were `1`.
   */
  bus?: string;
  /** Whether to start playing immediately once created. Defaults to `true`. */
  autoplay?: boolean;
}

/**
 * One audio-emitting component: a single sound instance, positioned in the world like a display
 * object (`IPositionable`) and lifecycle-managed like any other world component
 * (`IWorldComponent`). Wrapped by the dimension-specific `AudioSource(2d|3d)Entity` in app-facing
 * code - see the audio RFC's "The contract" section and `gg-engine-audio-adapter`.
 * @template D - The position type
 * @template R - The rotation type
 * @template ATypeDoc - The type document repository
 */
export interface IAudioSourceComponent<D, R, ATypeDoc extends AudioTypeDocRepo<D, R> = AudioTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, GgWorldTypeDocAPatch<D, R, ATypeDoc>>, IPositionable<D, R> {
  loop: boolean;
  volume: number;
  playbackRate: number;
  spatial: boolean;
  bus: string;

  readonly isPlaying: boolean;

  /**
   * Fires once when playback reaches the end of a non-looping clip (never fires for a looping
   * source, since it never ends on its own). What `AudioSource(2d|3d)Entity.playOneShot` and the
   * `"PlaySound"` blueprint node subscribe to in order to remove/dispose the transient source
   * once it's done.
   */
  readonly ended$: Observable<void>;

  play(): void;

  pause(): void;

  stop(): void;

  clone(): IAudioSourceComponent<D, R, ATypeDoc>;
}
