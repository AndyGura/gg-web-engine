import { characterControllerSelfHitSkip, Pnt3 } from '../../../../../src';

describe('characterControllerSelfHitSkip', () => {
  it('adds the default skin once past a capsule cleared by a purely horizontal ray from its own axis', () => {
    // Capsule at the origin, radius 0.3, centersDistance 1.0 (half-height 0.5) - origin sits on the
    // axis, well within the cylindrical midsection, looking straight along +Y.
    const skip = characterControllerSelfHitSkip(Pnt3.O, Pnt3.Y, Pnt3.O, Pnt3.Z, 0.3, 1.0, 3);
    expect(skip).toBeCloseTo(0.35, 3); // radius (0.3) + default skin (0.05)
  });

  it('accepts a custom skin', () => {
    const skip = characterControllerSelfHitSkip(Pnt3.O, Pnt3.Y, Pnt3.O, Pnt3.Z, 0.3, 1.0, 3, 0.01);
    expect(skip).toBeCloseTo(0.31, 3);
  });

  it('needs more than the flat radius to clear the capsule along a steeply pitched-down ray from above its midsection (regression: a first-person camera whose eyeHeight exceeds the capsule half-height sits in the rounded cap, not the cylindrical body)', () => {
    // Capsule at the origin, radius 0.4, centersDistance 1.0 (half-height 0.5). Origin 0.7 above the
    // capsule center (matching `PlayerCharacterController`'s default `eyeHeight`, taller than the
    // half-height) - already inside the rounded top cap - looking down and out at 45°.
    const origin = { x: 0, y: 0, z: 0.7 };
    const direction = Pnt3.norm({ x: 0, y: 1, z: -1 });
    const skip = characterControllerSelfHitSkip(origin, direction, Pnt3.O, Pnt3.Z, 0.4, 1.0, 3, 0);
    // A flat `radius`-sized skip (0.4) was the bug: verify the traced skip clears the capsule by more
    // than that, and that the resulting point is (up to the sphere-tracer's own float-precision
    // residual) actually on/outside its surface.
    expect(skip).toBeGreaterThan(0.4);
    const point = Pnt3.add(origin, Pnt3.scalarMult(direction, skip));
    const toPoint = Pnt3.sub(point, Pnt3.O);
    const axial = Math.min(0.5, Math.max(-0.5, Pnt3.dot(toPoint, Pnt3.Z)));
    const nearestOnAxis = Pnt3.scalarMult(Pnt3.Z, axial);
    expect(Pnt3.len(Pnt3.sub(point, nearestOnAxis))).toBeGreaterThan(0.4 - 1e-6);
  });

  it('clamps to 90% of maxDistance when the traced skip would exceed it', () => {
    // Capsule radius 1 is larger than maxDistance (1) itself.
    const skip = characterControllerSelfHitSkip(Pnt3.O, Pnt3.Y, Pnt3.O, Pnt3.Z, 1, 1, 1);
    expect(skip).toBeCloseTo(0.9, 3);
  });
});
