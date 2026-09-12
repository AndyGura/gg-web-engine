import { Pnt3, Point3 } from '../../../../base';

/** Sphere-tracing iterations `characterControllerSelfHitSkip()` runs - see that function's own doc
 * for why this converges safely (never overshooting) instead of reading an exit point off a
 * raycast. 20 converges to well under float precision's own tolerance for realistic capsule sizes -
 * verified empirically, not assumed - and is cheap regardless (a few vector subtractions, no
 * physics-engine calls, run at most once per grab attempt or per third-person camera tick). */
const ITERATIONS = 20;

/**
 * Exact distance from `point` to a capsule's own medial axis (the line segment between its two
 * hemisphere centers, clamped to `halfHeight` either side of `capsuleCenter` along `up`) - a capsule
 * is *defined* as every point within `radius` of this segment, so `radius - distanceToAxis(point,
 * ...)` is the exact (not approximated) signed distance from `point` to the capsule's own surface,
 * usable directly as a sphere-tracing step size.
 */
function distanceToCapsuleAxis(point: Point3, capsuleCenter: Point3, up: Point3, halfHeight: number): number {
  const toPoint = Pnt3.sub(point, capsuleCenter);
  const axial = Math.min(halfHeight, Math.max(-halfHeight, Pnt3.dot(toPoint, up)));
  const nearestOnAxis = Pnt3.add(capsuleCenter, Pnt3.scalarMult(up, axial));
  return Pnt3.len(Pnt3.sub(point, nearestOnAxis));
}

/**
 * Safe forward-skip distance, from `origin` along `direction`, to clear a character controller's own
 * capsule when raycasting from a point on or inside it - e.g. a first-person camera, which sits
 * inside or right at the surface of its own capsule - without reading an exit point off the raycast
 * result itself.
 *
 * A raycast whose origin already lies inside a shape has no reliable way to report where it *exits*
 * that shape: an adapter using a "solid" ray mode reports the containing shape hit at distance `0`,
 * from the origin again, not its far boundary, and doing this on some adapters but not others (e.g.
 * Rapier3d's `castRay(..., solid: true, ...)` vs. Ammo's `rayTest`, which simply can't see the shape
 * containing its own origin at all) makes any retry built on that reported point adapter-dependent -
 * see `ObjectGrabController.tryGrab()`'s own doc for a case where exactly this broke self-hit
 * recovery on one adapter while appearing to work fine on another.
 *
 * Computed by sphere-tracing against the capsule's own exact distance field instead of guessed from
 * `radius` alone: `radius - distanceToCapsuleAxis(point, ...)` is the *exact* signed distance from
 * any point to the capsule's surface (a capsule is exactly "every point within `radius` of its own
 * medial segment"), so repeatedly advancing by that remaining distance converges tightly onto the
 * real exit point along `direction`, for *any* pitch - not just a near-horizontal look direction. A
 * flat `radius`-sized skip (this function's first implementation) only clears the capsule when
 * `origin` sits in its cylindrical midsection and `direction` is close to horizontal; a real,
 * reproduced regression (found by reproducing the reporter's own exact in-game position) picked a
 * first-person camera above that midsection - `eyeHeight` (0.7 by default) taller than the capsule's
 * own half-height, so the camera already sits in the rounded top cap - looking down at a low, close
 * prop: the flat `radius` skip landed the retry still measurably inside the capsule (its horizontal
 * travel per meter shrinks with a steeper pitch, exactly where the cap's own cross-section is
 * smaller too), so the second cast self-hit again and pick-up silently failed at that exact range.
 * Sphere-tracing has no separate "which part of the capsule" case to get wrong - the same distance
 * field describes the cylindrical body and both rounded caps continuously.
 *
 * `skin` (0.05 by default) is added on top of the traced distance for ordinary float/engine surface
 * tolerance. The result is clamped to at most 90% of `maxDistance` (the full ray length in play at
 * the call site) so a capsule large relative to a short ray can't consume the entire cast.
 */
export function characterControllerSelfHitSkip(
  origin: Point3,
  direction: Point3,
  capsuleCenter: Point3,
  up: Point3,
  radius: number,
  centersDistance: number,
  maxDistance: number,
  skin = 0.05,
): number {
  const halfHeight = centersDistance / 2;
  let t = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const point = Pnt3.add(origin, Pnt3.scalarMult(direction, t));
    const remaining = radius - distanceToCapsuleAxis(point, capsuleCenter, up, halfHeight);
    if (remaining <= 0) {
      break;
    }
    t += remaining;
  }
  return Math.min(t + skin, maxDistance * 0.9);
}
