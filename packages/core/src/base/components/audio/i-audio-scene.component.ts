import { IComponent } from '../i-component';
import { AudioTypeDocRepo } from '../../gg-world';
import { IPositionable } from '../../interfaces/i-positionable';

/**
 * The audio equivalent of `IVisualSceneComponent`: owns the native audio backend (e.g. a Web
 * Audio `AudioContext`), the source factory, and the single active listener a `GgWorld`'s
 * `audioScene` is composed from. See the audio RFC ("Where audio fits") for why this mirrors
 * `visualScene`/`physicsWorld` rather than being an app-level helper.
 * @template D - The position type
 * @template R - The rotation type
 * @template ATypeDoc - The type document repository
 */
export interface IAudioSceneComponent<
  D,
  R,
  ATypeDoc extends AudioTypeDocRepo<D, R> = AudioTypeDocRepo<D, R>,
> extends IComponent {
  readonly factory: ATypeDoc['factory'];

  init(): Promise<void>;

  /**
   * Master output volume, 0-1, applied on top of every bus's own volume. Most backends can only
   * apply this once a user gesture has resumed the native audio context (browser autoplay
   * policy) - see `gg-engine-audio-adapter` for the resume-on-first-input pattern.
   */
  masterVolume: number;

  /**
   * Per-category output volume (e.g. `"sfx"`, `"music"`, `"ambient"`), 0-1, applied on top of
   * `masterVolume` and independent of any individual source's own `volume`. A bus that hasn't
   * been explicitly set behaves as if its volume were `1` - buses don't need to be declared up
   * front, just referenced by name from `AudioSourceDescriptor.bus`.
   */
  getBusVolume(bus: string): number;

  setBusVolume(bus: string, volume: number): void;

  /**
   * The entity/component currently acting as the "ears" for spatial audio - normally a
   * renderer's camera. `null` means no spatial reference is set: positional sources are silent
   * (or rendered at a fixed neutral pan, depending on the adapter) while non-spatial sources
   * (ambient/music/UI, `AudioSourceDescriptor.spatial: false`) are unaffected. `GgWorld` binds
   * this automatically when exactly one renderer is present - see its `addEntity` doc - and warns
   * (without guessing) once more than one renderer exists and no listener has been set.
   */
  readonly activeListener: IPositionable<D, R> | null;

  setActiveListener(target: IPositionable<D, R> | null): void;

  /**
   * Called once per world tick, after every entity's own `tick$` (renderers included), to update
   * the native listener's position/orientation from `activeListener` and, for adapters with no
   * native distance-based panning (e.g. `packages/audio`'s 2D implementation), recompute each
   * living spatial source's pan/gain. Not meant to be called by app code - `GgWorld`'s tick loop
   * drives this automatically whenever an `audioScene` is present.
   */
  update(elapsed: number, delta: number): void;

  dispose(): void;
}
