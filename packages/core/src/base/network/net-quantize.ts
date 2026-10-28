import { Point2, Point3, Point4 } from '../models/points';
import { avQuantize, NET_POSITION_STEP, NET_VELOCITY_STEP, rQuantize, vQuantize } from './net-math';

/*
 * Wire quantisation of network state. Global coordinates can be large (an open world spans
 * kilometres), and a full double serializes to 17 significant digits; rounding to a resolution far
 * below what a replica correction notices keeps every state message short and makes a resting
 * entity's snapshot identical from one capture to the next. `RigidBodyCorrection.capture` and
 * `MoverCorrection.capture` quantise their output with these; an app-defined payload should too.
 */

/** A position rounded to 1 mm (0.001 world units) per axis. */
export function quantizeNetPosition<D extends Point2 | Point3>(p: D): D {
  return vQuantize(p, NET_POSITION_STEP);
}

/** A linear velocity (or any other vector of that scale) rounded to 1 mm/s (0.001 units/s) per axis. */
export function quantizeNetVelocity<D extends Point2 | Point3>(v: D): D {
  return vQuantize(v, NET_VELOCITY_STEP);
}

/** An angular velocity rounded to 0.001 rad/s: a 2D scalar, or each component of a 3D vector. */
export function quantizeNetAngularVelocity<A extends number | Point3>(av: A): A {
  return avQuantize(av) as A;
}

/**
 * A rotation rounded to 5 decimals: each component of a quaternion (an angle error of about
 * 1e-5 rad; the result is no longer exactly unit length, so the correction helpers normalize what
 * they receive), or a 2D angle.
 */
export function quantizeNetRotation<R extends number | Point4>(r: R): R {
  return rQuantize(r);
}
