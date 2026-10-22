import { IComponent } from '../i-component';
import { AudioTypeDocRepo } from '../../gg-world';
import { IPositionable } from '../../interfaces/i-positionable';
import { AudioReverbSettings, ResolvedAudioReverbSettings } from '../../models/audio-reverb';
import { AudioSourceDescriptor } from './i-audio-source.component';

/**
 * Settings for {@link IAudioSceneComponent.playOneShot}: an `AudioSourceDescriptor` without what a
 * one-shot fixes itself - it never loops, always starts at once and is never positional.
 */
export type AudioOneShotDescriptor<Clip = unknown> = Omit<
  AudioSourceDescriptor<Clip>,
  'loop' | 'loopStart' | 'loopEnd' | 'autoplay' | 'spatial'
>;

/**
 * How many sources of one audio scene are playing, and how many of those are heard - see
 * `IAudioSceneComponent.maxVoices`. `playing` counts every source between `play()` and its
 * `pause()`/`stop()`/end; `audible + virtual === playing`.
 */
export interface AudioVoiceCounts {
  playing: number;
  audible: number;
  virtual: number;
}

/**
 * The audio equivalent of `IVisualSceneComponent`: owns the native audio backend (e.g. a Web
 * Audio `AudioContext`), the source factory, and the single active listener a `GgWorld`'s
 * `audioScene` is composed from. Mirrors `visualScene`/`physicsWorld` (a `GgWorld`-composed
 * subsystem with its own `init`/`update`/`dispose` lifecycle) rather than being an app-level
 * helper, so audio gets the same per-tick driving and teardown wiring those already have for free
 * instead of every app reinventing it.
 * @template D - The position type
 * @template R - The rotation type
 * @template ATypeDoc - The type document repository
 */
export interface IAudioSceneComponent<
  D,
  R,
  ATypeDoc extends AudioTypeDocRepo<D, R> = AudioTypeDocRepo<D, R>,
> extends IComponent {
  /**
   * Short, stable name of the audio backend behind this scene (`'webaudio'`, ...), the same for
   * every instance of an adapter. Shown in the dev console's world info and handy in logs or bug
   * reports.
   */
  readonly backendName: string;

  readonly factory: ATypeDoc['factory'];

  init(): Promise<void>;

  /**
   * Master output volume, 0-1, applied on top of every bus's own volume. Most backends can only
   * apply this once a user gesture has resumed the native audio context (browser autoplay
   * policy) - see `gg-engine-audio-adapter` for the resume-on-first-input pattern. Reads return
   * the volume last set, like `getBusVolume`.
   */
  masterVolume: number;

  /**
   * Per-category output volume (e.g. `"sfx"`, `"music"`, `"ambient"`), 0-1, applied on top of
   * its parent bus's volume (see `setBusParent`), then `masterVolume`, and independent of any
   * individual source's own `volume`. A bus that hasn't been explicitly set behaves as if its
   * volume were `1` - buses don't need to be declared up front, just referenced by name from
   * `AudioSourceDescriptor.bus`. Reads return the volume last set (the level being faded towards),
   * not the level heard at this instant.
   */
  getBusVolume(bus: string): number;

  setBusVolume(bus: string, volume: number): void;

  /**
   * Routes a bus's output into another bus (`parent`) instead of the master output (`null`, the
   * default for every bus): its sound then goes through the parent's volume and the parent's
   * reverb too, so volumes multiply down the chain. The usual game mixer layout - `"engine"`,
   * `"sfx"` and `"ambient"` feeding one `"world"` bus that carries the environment reverb, with
   * `"music"` and `"ui"` beside it - is
   * `setBusParent('engine', 'world'); setBusParent('sfx', 'world'); setBusParent('ambient', 'world')`
   * plus `setBusReverb('world', ...)`.
   *
   * Meant for setting the layout up, not for per-frame use: moving a bus that is playing can be
   * heard as a click. Either bus is created if it doesn't exist yet.
   * @throws RangeError when `parent` is `bus` itself or one of its descendants (a cycle)
   */
  setBusParent(bus: string, parent: string | null): void;

  /** The bus `bus` feeds into, or `null` when it feeds the master output (the default). */
  getBusParent(bus: string): string | null;

  /**
   * Puts a reverb on one bus (`settings`, defaults filled in by `resolveAudioReverbSettings`), or
   * takes it off (`null`). One reverb per bus, shared by every source routed through it and through
   * its child buses (`setBusParent`), applied after the bus volume: the bus's signal is split into
   * a direct part (`dry`) and a reverberated one (`wet`), both mixed into its parent bus or, without
   * one, the master output.
   *
   * Made to be called every frame: `wet`/`dry` changes are smoothed like every other level, so a
   * game fades the reverb in and out (a car entering and leaving a tunnel) by passing a changing
   * `wet`. Each call replaces the bus's settings as a whole - a field left out gets its default,
   * not its previous value. Changing `decay`/`preDelay`/`damping` rebuilds the reverb (the old one
   * fades out under the new one), which costs a little on the main thread - keep them constant
   * while fading. The reverb is built when its settings are first given, `wet: 0` included, so a
   * game can set it up front at `wet: 0` and pay that cost at load time.
   *
   * At `wet: 0` (and after `null`) the reverb fades out and then stops costing any audio
   * processing; `null` also fades `dry` back to `1` and forgets the settings.
   * @throws RangeError when a setting is out of its documented range (see `AudioReverbSettings`)
   */
  setBusReverb(bus: string, settings: AudioReverbSettings | null): void;

  /** The bus's current reverb settings, every default filled in, or `null` when it has none. */
  getBusReverb(bus: string): ResolvedAudioReverbSettings | null;

  /**
   * The entity/component currently acting as the "ears" for spatial audio - normally a
   * renderer's camera. `null` means no spatial reference is set: positional sources are silent
   * (or rendered at a fixed neutral pan, depending on the adapter) while non-spatial sources
   * (ambient/music/UI, `AudioSourceDescriptor.spatial: false`) are unaffected. `GgWorld` binds
   * this automatically when exactly one renderer is present - see its `addEntity` doc - and warns
   * (without guessing) once more than one renderer exists and no listener has been set. A 3D
   * scene reads its rotation as a camera's or a body's local axes - see
   * `IAudioScene3dComponent.activeListenerBasis`.
   */
  readonly activeListener: IPositionable<D, R> | null;

  /**
   * Voice budget: how many playing sources this scene renders at once. Beyond it, sources are
   * ranked and the lowest ones are made virtual (`IAudioSourceComponent.isVirtual`): silent and
   * free of audio processing, their playback position still advancing, and faded back in where
   * they would be once they rank inside the budget again. Ranking, re-evaluated every `update()`
   * and whenever a source starts (on a scene no world updates, an adapter re-ranks on its own
   * while any source is virtual, so a budget works there too): an audible source before a silent one (effective gain ~0 - a
   * muted loop never takes a voice from one that is heard), then higher
   * `IAudioSourceComponent.priority`, then the louder at the listener (volume x bus volume x every
   * parent bus's volume x distance attenuation from the source's own distance model; cones are
   * ignored), with a small
   * bias towards the voices already heard so near-equal sources don't swap every frame, then the
   * older source. Defaults to `Infinity` (every playing source is rendered, nothing is ranked);
   * a non-negative integer, changeable at any time.
   */
  maxVoices: number;

  /** Current playing/audible/virtual source counts, for debugging - see {@link AudioVoiceCounts}. */
  readonly voiceCounts: AudioVoiceCounts;

  setActiveListener(target: IPositionable<D, R> | null): void;

  /**
   * Plays a clip once, non-positional, on `descriptor.bus` (`"sfx"` by default), and disposes the
   * source the moment it ends - for sounds that belong to no place in a world: a menu click, a UI
   * confirmation, a stinger. Needs no world and no entity, so it works on a scene that is not part
   * of a world at all (an app-wide scene for the menus). The source counts against `maxVoices` like
   * any other (give UI sounds a high `priority` under a budget). Returns the source, which nothing
   * needs to keep: `dispose()` on it cuts the sound short. For a one-shot at a position in a world,
   * use `AudioSource(2d|3d)Entity.playOneShot`. `playAudioOneShot` implements this over any
   * adapter's factory.
   */
  playOneShot(descriptor: AudioOneShotDescriptor<ATypeDoc['clip']>): ATypeDoc['source'];

  /**
   * Freezes (`true`) or continues (`false`) everything this scene plays, every source keeping its
   * place. `GgWorld` calls it whenever its clock pauses or resumes, so a paused world is silent
   * and picks its sounds up where they stopped. A scene without it keeps playing through a pause.
   */
  setPaused?(paused: boolean): void;

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
