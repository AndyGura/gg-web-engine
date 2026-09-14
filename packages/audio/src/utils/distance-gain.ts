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
  switch (model) {
    // Per spec, only the linear model clamps distance to maxDistance - its gain formula is a
    // straight ramp that would go negative past that point. inverse/exponential only clamp the
    // lower bound (refDistance, so gain never exceeds 1) and are left to keep decaying naturally
    // past maxDistance, same as a native PannerNode does - maxDistance isn't a hard cutoff for
    // them, just the distance at which linear's ramp bottoms out.
    case 'inverse': {
      const d = Math.max(distance, refDistance);
      return refDistance / (refDistance + rolloffFactor * (d - refDistance));
    }
    case 'exponential': {
      const d = Math.max(distance, refDistance);
      return Math.pow(d / refDistance, -rolloffFactor);
    }
    case 'linear':
    default: {
      const d = Math.max(refDistance, Math.min(distance, maxDistance));
      if (maxDistance <= refDistance) {
        return 1;
      }
      return 1 - (rolloffFactor * (d - refDistance)) / (maxDistance - refDistance);
    }
  }
}
