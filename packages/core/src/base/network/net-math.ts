import { CorrectionTuning } from '../interfaces/i-network-syncable';
import { Point2, Point3, Point4 } from '../models/points';
import { Qtrn } from '../math/quaternion';
import { lerpAngle } from '../math/numbers';
import { Pnt2 } from '../math/point2';
import { Pnt3 } from '../math/point3';

/**
 * Dimension-agnostic vector/rotation helpers the correction helpers share. A 2D world's positions
 * are `Point2` and rotations plain angles; a 3D world's are `Point3` and quaternions - every function
 * here tells them apart at runtime (`z` present / rotation is a number) and dispatches to
 * `Pnt2`/`Pnt3`/`Qtrn`, so one algorithm serves both. Internal to the network helpers, not
 * re-exported from the package root.
 */

export type NetVec = Point2 | Point3;
export type NetRot = number | Point4;

const is3d = (v: NetVec): v is Point3 => typeof (v as Point3).z === 'number';

export function vAdd<D extends NetVec>(a: D, b: D): D {
  return (is3d(a) ? Pnt3.add(a, b as Point3) : Pnt2.add(a, b)) as D;
}

export function vSub<D extends NetVec>(a: D, b: D): D {
  return (is3d(a) ? Pnt3.sub(a, b as Point3) : Pnt2.sub(a, b)) as D;
}

export function vScale<D extends NetVec>(a: D, s: number): D {
  return (is3d(a) ? Pnt3.scalarMult(a, s) : Pnt2.scalarMult(a, s)) as D;
}

export function vLen(a: NetVec): number {
  return is3d(a) ? Pnt3.len(a) : Pnt2.len(a);
}

export function vLerp<D extends NetVec>(a: D, b: D, t: number): D {
  return (is3d(a) ? Pnt3.lerp(a, b as Point3, t) : Pnt2.lerp(a, b, t)) as D;
}

export function vZero<D extends NetVec>(like: D): D {
  return (is3d(like) ? Pnt3.O : Pnt2.O) as D;
}

/** Plain-JSON copy of a vector (drops any extra fields a native/adapter vector object might carry). */
export function vClone<D extends NetVec>(a: D): D {
  return (is3d(a) ? Pnt3.clone(a) : Pnt2.clone(a)) as D;
}

/** Plain-JSON copy of a rotation. */
export function rClone<R extends NetRot>(r: R): R {
  return (typeof r === 'number' ? r : { x: r.x, y: r.y, z: r.z, w: r.w }) as R;
}

/** Plain-JSON copy of an angular velocity: a scalar in 2D, a world-space axis*rate vector in 3D. */
export function avClone(av: number | Point3): number | Point3 {
  return typeof av === 'number' ? av : { x: av.x, y: av.y, z: av.z };
}

/**
 * Advance rotation `r` by angular velocity `av` (rad/s; scalar in 2D, world-space axis*rate vector in
 * 3D) over `seconds`.
 */
export function integrateRotation<R extends NetRot>(r: R, av: number | Point3, seconds: number): R {
  if (typeof r === 'number') {
    return (r + (typeof av === 'number' ? av : 0) * seconds) as R;
  }
  if (typeof av === 'number') {
    return r;
  }
  const rate = Math.sqrt(av.x * av.x + av.y * av.y + av.z * av.z);
  const angle = rate * seconds;
  if (rate < 1e-9 || Math.abs(angle) < 1e-9) {
    return r;
  }
  const axis = { x: av.x / rate, y: av.y / rate, z: av.z / rate };
  // world-space angular velocity: the increment is applied on the left
  return normalizeQuat(Qtrn.mult(Qtrn.fromAngle(axis, angle) as Point4, r)) as R;
}

/** Smallest angle (radians, >= 0) between two rotations. */
export function rotationError(a: NetRot, b: NetRot): number {
  if (typeof a === 'number' || typeof b === 'number') {
    let d = ((b as number) - (a as number)) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  }
  const dot = Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w));
  return 2 * Math.acos(dot);
}

/** Interpolate rotation `a` toward `b` by `t` along the shortest path. */
export function rotationLerp<R extends NetRot>(a: R, b: R, t: number): R {
  if (typeof a === 'number') {
    return lerpAngle(a, b as number, t) as R;
  }
  let target = b as Point4;
  const dot = a.x * target.x + a.y * target.y + a.z * target.z + a.w * target.w;
  if (dot < 0) {
    target = { x: -target.x, y: -target.y, z: -target.z, w: -target.w };
  }
  if (Math.abs(dot) > 0.9995) {
    return normalizeQuat(Qtrn.lerp(a, target, t)) as R;
  }
  return normalizeQuat(Qtrn.slerp(a, target, t)) as R;
}

/** Interpolate angular velocity (scalar in 2D, vector in 3D). */
export function avLerp(a: number | Point3, b: number | Point3, t: number): number | Point3 {
  if (typeof a === 'number' || typeof b === 'number') {
    const an = typeof a === 'number' ? a : 0;
    const bn = typeof b === 'number' ? b : 0;
    return an + (bn - an) * t;
  }
  return vLerp(a, b, t);
}

function normalizeQuat(q: Point4): Point4 {
  const l = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (l < 1e-12) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}

/** Per-tick blend factor for a per-second gain: `gain * dt`, clamped to [0, 1]. */
export function gainFactor(gainPerSecond: number, dtMs: number): number {
  return Math.max(0, Math.min(1, (gainPerSecond * dtMs) / 1000));
}

/** how far (seconds) a snapshot `ageMs` old is extrapolated: its age, capped at `extrapolateMaxMs` */
export function extrapolationSeconds(ageMs: number, tuning: CorrectionTuning): number {
  return Math.max(0, Math.min(ageMs, tuning.extrapolateMaxMs)) / 1000;
}

/**
 * whether a replica whose latest snapshot arrived `sinceReceivedMs` ago coasts: the stream has been
 * silent for longer than a snapshot is extrapolated, but not yet for the whole coasting window
 */
export function isCoasting(sinceReceivedMs: number | undefined, tuning: CorrectionTuning): boolean {
  return (
    sinceReceivedMs !== undefined &&
    sinceReceivedMs > tuning.extrapolateMaxMs &&
    sinceReceivedMs <= (tuning.coastMaxMs ?? 0)
  );
}
