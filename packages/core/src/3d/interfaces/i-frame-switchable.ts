import { Point3, Point4 } from '../../base';
import { Frame3d } from '../models/frame-3d';

/**
 * Something holding world-space state that a frame switch (`Gg3dWorld.switchFrame`) has to carry
 * over into the new frame: positions, orientations, velocities, aim points, smoothing targets.
 *
 * `delta` maps a point of the old local space to the same global point in the new local space
 * (`newFrame.inverse().compose(oldFrame)`): positions go through `delta.toGlobalPoint` (rotated
 * about `+Z`, then translated), orientations through `delta.toGlobalRotation` (the yaw multiplied in
 * front) and anything that is a vector rather than a place - linear and angular velocities, offsets,
 * normals, axes - through `delta.toGlobalDirection` (rotated only).
 *
 * Implemented by entities (the world calls `onFrameSwitch` on every entity it holds, children
 * before their parents) and, optionally, by physics components and the physics world (see
 * `IRigidBody3dComponent.onFrameSwitch`), which know the native state a plain pose write misses.
 * An implementation moves only what it owns: an entity's children get their own call.
 */
export interface IFrameSwitchable {
  /** Moves this object's world-space state from the old local space to the new one by `delta`. */
  onFrameSwitch(delta: Frame3d): void;
}

/** Whether `o` implements {@link IFrameSwitchable}. */
export function isFrameSwitchable(o: unknown): o is IFrameSwitchable {
  return !!o && typeof (o as IFrameSwitchable).onFrameSwitch === 'function';
}

// the delta each object was last moved by: one switch hands every hook the same `Frame3d`
// instance, so an object reached from two places (a camera component wrapped by both a
// `Camera3dEntity` and a `Renderer3dEntity`) moves once
const lastSwitchDelta: WeakMap<object, Frame3d> = new WeakMap();

/**
 * `true` the first time `target` is seen for this `delta`, `false` on every later call with the same
 * `delta` instance - lets a hook skip state another hook already moved during the same switch.
 */
export function claimFrameSwitch(target: object, delta: Frame3d): boolean {
  if (lastSwitchDelta.get(target) === delta) {
    return false;
  }
  lastSwitchDelta.set(target, delta);
  return true;
}

/**
 * Moves anything with a `position` and a `rotation` (a display object, a camera, a light, an audio
 * source, ...) by `delta`, once per switch (see {@link claimFrameSwitch}). Calls the target's own
 * `onFrameSwitch` instead when it has one.
 */
export function switchPoseFrame(target: { position: Point3; rotation: Point4 }, delta: Frame3d): void {
  if (!claimFrameSwitch(target, delta)) {
    return;
  }
  if (isFrameSwitchable(target)) {
    target.onFrameSwitch(delta);
    return;
  }
  target.position = delta.toGlobalPoint(target.position);
  target.rotation = delta.toGlobalRotation(target.rotation);
}

/**
 * Moves a physics component (rigid body, raycast vehicle, trigger or character controller) by
 * `delta`, once per switch. A component implementing `onFrameSwitch` does it itself, keeping native
 * state a plain write would disturb (activation, interpolation, broadphase); for any other, this
 * falls back to the `position`/`rotation` setters, then `linearVelocity`/`angularVelocity` and `up`
 * where the component has them, rotated - which may wake a sleeping body.
 */
export function switchBodyFrame(
  body: {
    position: Point3;
    rotation: Point4;
    linearVelocity?: Point3;
    angularVelocity?: Point3 | Point4 | number;
    up?: Point3;
  },
  delta: Frame3d,
): void {
  if (!claimFrameSwitch(body, delta)) {
    return;
  }
  if (isFrameSwitchable(body)) {
    body.onFrameSwitch(delta);
    return;
  }
  const linearVelocity = body.linearVelocity;
  const angularVelocity = body.angularVelocity;
  body.position = delta.toGlobalPoint(body.position);
  body.rotation = delta.toGlobalRotation(body.rotation);
  if (linearVelocity) {
    body.linearVelocity = delta.toGlobalDirection(linearVelocity);
  }
  if (angularVelocity && typeof angularVelocity === 'object' && !('w' in angularVelocity)) {
    body.angularVelocity = delta.toGlobalDirection(angularVelocity);
  }
  if (body.up) {
    body.up = delta.toGlobalDirection(body.up);
  }
}
