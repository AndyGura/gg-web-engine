import { IRigidBodyComponent } from '../components/physics/i-rigid-body.component';
import {
  CorrectionOutcome,
  CorrectionTuning,
  DEFAULT_CORRECTION_TUNING,
  NetworkApplyContext,
} from '../interfaces/i-network-syncable';
import { Point3 } from '../models/points';
import {
  avClone,
  avLerp,
  extrapolationSeconds,
  gainFactor,
  integrateRotation,
  isCoasting,
  NetRot,
  NetVec,
  rClone,
  rotationError,
  rotationLerp,
  vAdd,
  vClone,
  vLen,
  vLerp,
  vScale,
  vSub,
  vZero,
} from './net-math';

/**
 * Networked snapshot of one rigid body: position, rotation, linear velocity, angular velocity
 * (scalar in 2D, world-space axis*rate vector in 3D) and the sleep flag. Short keys keep the JSON
 * small - it is sent many times per second per entity.
 */
export interface RigidBodyNetState<D = unknown, R = unknown> {
  p: D;
  r: R;
  lv: D;
  av: R | D;
  s: boolean;
}

/**
 * Replica correction for rigid bodies, shared by every entity class whose networked state is (or
 * contains) a rigid body: one algorithm, applied per body kind.
 *
 * 1. The snapshot is extrapolated to "now" along its velocities, capped at `extrapolateMaxMs`. A
 *    dynamic replica of a moving target whose snapshot is older than that, up to `coastMaxMs`, is
 *    left alone (`'coast'`): the stream stalled, and its own simulation is the better guess.
 * 2. Error below the deadzone: nothing is written (and an awake replica of a sleeping target is put
 *    to sleep).
 * 3. Error above `snapDistance`, or `ctx.snap`: the extrapolated state is written outright.
 * 4. Otherwise blend:
 *    - dynamic body: velocity is steered toward `targetVelocity + error * velocityGain` at
 *      `positionGain` per second (a velocity bias does not fight momentum the way a position lerp
 *      does), rotation slerped at `rotationGain`, angular velocity lerped. A sleeping target instead
 *      gets a gentle position/rotation lerp with zero velocity, so the replica comes to rest where
 *      the owner's body rests;
 *    - kinematic body (`kinematic_pos`/`kinematic_vel`): position/rotation lerp only, through the
 *      setters - kinematic bodies don't integrate a written velocity on every adapter;
 *    - static body: never corrected.
 *
 * The helper never reads a value back after writing it within one call (a position-based kinematic
 * write is deferred to the next physics step on some adapters), and gains are per-second, scaled by
 * `ctx.dt`.
 */
export class RigidBodyCorrection {
  /** Owner side: snapshot `body` as plain JSON. */
  static capture<D, R>(body: IRigidBodyComponent<D, R>): RigidBodyNetState<D, R> {
    return {
      p: vClone(body.position as unknown as NetVec) as unknown as D,
      r: rClone(body.rotation as unknown as NetRot) as unknown as R,
      lv: vClone(body.linearVelocity as unknown as NetVec) as unknown as D,
      av: avClone(body.angularVelocity as unknown as number | Point3) as unknown as R | D,
      s: body.isSleeping,
    };
  }

  /**
   * Where a replica of `target` is steered to once the snapshot is `ageMs` old: its position
   * extrapolated along its linear velocity (not at all for a sleeping target), capped at
   * `extrapolateMaxMs`.
   */
  static targetPosition<D, R>(
    target: RigidBodyNetState<D, R>,
    ageMs: number,
    tuning: CorrectionTuning = DEFAULT_CORRECTION_TUNING,
  ): D {
    const ageS = target.s ? 0 : extrapolationSeconds(ageMs, tuning);
    return vAdd(target.p as unknown as NetVec, vScale(target.lv as unknown as NetVec, ageS)) as unknown as D;
  }

  /**
   * Replica side: reconcile `body` toward `target` - see the class doc for the algorithm.
   * @param body - the replica's local body
   * @param target - the owner's snapshot
   * @param ctx - age/dt/snap/tuning of this application
   * @param tuning - overrides `ctx.tuning` when given
   */
  static correct<D, R>(
    body: IRigidBodyComponent<D, R>,
    target: RigidBodyNetState<D, R>,
    ctx: NetworkApplyContext,
    tuning: CorrectionTuning = ctx.tuning ?? DEFAULT_CORRECTION_TUNING,
  ): CorrectionOutcome {
    const bodyType = body.bodyOptions.bodyType;
    if (bodyType === 'static') {
      return 'none';
    }
    const isDynamic = bodyType === 'dynamic';
    if (!ctx.snap && isDynamic && !target.s && isCoasting(ctx.ageMs, tuning)) {
      return 'coast';
    }
    const ageS = target.s ? 0 : extrapolationSeconds(ctx.ageMs, tuning);
    const tP = RigidBodyCorrection.targetPosition(target, ctx.ageMs, tuning) as unknown as NetVec;
    const tR = integrateRotation(target.r as unknown as NetRot, target.av as unknown as number | Point3, ageS);
    const lP = body.position as unknown as NetVec;
    const lR = body.rotation as unknown as NetRot;
    const error = vSub(tP, lP);
    const errLen = vLen(error);
    const rotErr = rotationError(lR, tR);

    if (ctx.snap || errLen > tuning.snapDistance) {
      body.position = tP as unknown as D;
      body.rotation = tR as unknown as R;
      if (isDynamic) {
        body.linearVelocity = vClone(target.lv as unknown as NetVec) as unknown as D;
        body.angularVelocity = avClone(target.av as unknown as number | Point3) as unknown as R | D;
        if (target.s) {
          body.sleep();
        } else {
          body.wakeUp();
        }
      }
      return 'snap';
    }

    if (errLen <= tuning.deadzone && rotErr <= tuning.rotationDeadzone) {
      if (isDynamic && target.s && !body.isSleeping) {
        body.linearVelocity = vZero(lP) as unknown as D;
        body.angularVelocity = (typeof lR === 'number' ? 0 : { x: 0, y: 0, z: 0 }) as unknown as R | D;
        body.sleep();
        return 'sleep';
      }
      return 'none';
    }

    const posK = gainFactor(tuning.positionGain, ctx.dt);
    const rotK = gainFactor(tuning.rotationGain, ctx.dt);

    if (!isDynamic) {
      // kinematic: a written velocity isn't integrated on every adapter, so lerp the transform
      if (errLen > tuning.deadzone) {
        body.position = vLerp(lP, tP, posK) as unknown as D;
      }
      if (rotErr > tuning.rotationDeadzone) {
        body.rotation = rotationLerp(lR, tR, rotK) as unknown as R;
      }
      return 'blend';
    }

    if (target.s) {
      // the owner's body rests: glide there without injecting velocity, then sleep in the deadzone
      if (errLen > tuning.deadzone) {
        body.position = vLerp(lP, tP, posK) as unknown as D;
      }
      if (rotErr > tuning.rotationDeadzone) {
        body.rotation = rotationLerp(lR, tR, rotK) as unknown as R;
      }
      body.linearVelocity = vZero(lP) as unknown as D;
      body.angularVelocity = (typeof lR === 'number' ? 0 : { x: 0, y: 0, z: 0 }) as unknown as R | D;
      return 'blend';
    }

    const desiredLv = vAdd(target.lv as unknown as NetVec, vScale(error, tuning.velocityGain));
    body.linearVelocity = vLerp(body.linearVelocity as unknown as NetVec, desiredLv, posK) as unknown as D;
    if (rotErr > tuning.rotationDeadzone) {
      body.rotation = rotationLerp(lR, tR, rotK) as unknown as R;
    }
    body.angularVelocity = avLerp(
      body.angularVelocity as unknown as number | Point3,
      target.av as unknown as number | Point3,
      posK,
    ) as unknown as R | D;
    if (body.isSleeping) {
      // not every adapter wakes a body on a velocity write (matter-js doesn't)
      body.wakeUp();
    }
    return 'blend';
  }
}

/** Function alias of {@link RigidBodyCorrection.capture}. */
export const captureRigidBody = RigidBodyCorrection.capture;

/** Function alias of {@link RigidBodyCorrection.correct}. */
export const correctRigidBody = RigidBodyCorrection.correct;
