import { AudioDistanceModel, IAudioSourceComponent, Point2 } from '../../../base';
import { AudioTypeDocRepo2D } from '../../gg-2d-world';

/**
 * 2D audio source: distance-rolloff tuning over the flat `{x, y}` ground plane, no cone/elevation
 * - there's no `Z` in 2D, the same reason `Pnt2` has no `Z`/`nZ` axis constant. `packages/audio`'s
 * 2D implementation has no native distance-panning primitive to lean on (Web Audio's
 * `StereoPannerNode` is pan-only) - it computes gain/pan itself every `IAudioSceneComponent.update`
 * call from these fields, using the same distance-model formulas 3D gets natively from `PannerNode`.
 */
export interface IAudioSource2dComponent<
  ATypeDoc extends AudioTypeDocRepo2D = AudioTypeDocRepo2D,
> extends IAudioSourceComponent<Point2, number, ATypeDoc> {
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  distanceModel: AudioDistanceModel;
}
