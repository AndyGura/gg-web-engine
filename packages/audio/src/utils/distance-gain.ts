import { AudioDistanceModel } from '@gg-web-engine/core';

/**
 * Computes distance-based gain using the same three formulas the Web Audio `PannerNode` itself
 * uses natively - needed here because `packages/audio`'s 2D implementation has no native
 * distance-panning primitive (`StereoPannerNode` is pan-only) and has to recompute this by hand
 * every `IAudioSceneComponent.update` tick, unlike 3D where a `PannerNode` does this on the audio
 * thread automatically. Kept identical to the spec's own formulas so a source configured the same
 * way (`refDistance`/`maxDistance`/`rolloffFactor`/`distanceModel`) sounds consistent whether it's
 * 2D or 3D.
 */
export function computeDistanceGain(
  distance: number,
  refDistance: number,
  maxDistance: number,
  rolloffFactor: number,
  model: AudioDistanceModel,
): number {
  const d = Math.max(refDistance, Math.min(distance, maxDistance));
  switch (model) {
    case 'inverse':
      return refDistance / (refDistance + rolloffFactor * (d - refDistance));
    case 'exponential':
      return Math.pow(d / refDistance, -rolloffFactor);
    case 'linear':
    default: {
      if (maxDistance <= refDistance) {
        return 1;
      }
      return 1 - (rolloffFactor * (d - refDistance)) / (maxDistance - refDistance);
    }
  }
}
