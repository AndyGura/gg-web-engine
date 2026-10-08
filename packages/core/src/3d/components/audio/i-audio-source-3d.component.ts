import { AudioDistanceModel, AudioSourceDescriptor, IAudioSourceComponent, Point3, Point4 } from '../../../base';
import { AudioTypeDocRepo3D } from '../../gg-3d-world';

/**
 * How a 3D source is placed in the stereo field - the Web Audio `PannerNode.panningModel` values.
 * `'HRTF'` (head-related transfer function) also conveys front/back and elevation, but runs a
 * convolution per source; `'equalpower'` is a plain left/right gain split, roughly an order of
 * magnitude cheaper on the audio thread - the usual choice on a phone with many positional
 * sources. Distance attenuation and cones work the same with both.
 */
export type AudioPanningModel = 'HRTF' | 'equalpower';

/**
 * Settings for a new 3D audio source - `AudioSourceDescriptor` plus the 3D-only `panningModel`.
 * What `IAudioSource3dComponentFactory.createSource` takes.
 */
export interface AudioSource3dDescriptor<Clip = unknown> extends AudioSourceDescriptor<Clip> {
  /**
   * See {@link AudioPanningModel}. Defaults to the audio scene's
   * `IAudioScene3dComponent.defaultPanningModel` (itself `'HRTF'` unless the app changes it).
   */
  panningModel?: AudioPanningModel;
}

/**
 * 3D audio source: adds distance-rolloff tuning and a directional emission cone on top of the
 * base contract - the audio analogue of `ICamera3dComponent` adding FOV to `IDisplayObject3dComponent`.
 * `refDistance`/`maxDistance`/`rolloffFactor`/`distanceModel` map straight onto the Web Audio
 * `PannerNode` fields of the same name (see `packages/audio`); `distanceModel` defaults to
 * `'linear'` rather than the Web Audio default (`'inverse'`) - see `AudioDistanceModel`'s own doc
 * for why the steep near-field slope of `'inverse'` is the main driver of audible jitter on a
 * source sitting close to the listener.
 */
export interface IAudioSource3dComponent<
  ATypeDoc extends AudioTypeDocRepo3D = AudioTypeDocRepo3D,
> extends IAudioSourceComponent<Point3, Point4, ATypeDoc> {
  /** See {@link AudioPanningModel} - readable/writable at runtime. */
  panningModel: AudioPanningModel;

  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  distanceModel: AudioDistanceModel;

  /**
   * Directional emission cone, in degrees. `coneInnerAngle: 360` (the default) is omnidirectional
   * - inside that angle the source plays at full gain regardless of `coneOuterGain`; beyond
   * `coneOuterAngle` it plays at `coneOuterGain`, linearly interpolated between the two.
   */
  coneInnerAngle: number;
  coneOuterAngle: number;
  coneOuterGain: number;
}
