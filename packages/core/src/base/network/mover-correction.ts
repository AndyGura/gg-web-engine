import {
  CorrectionOutcome,
  CorrectionTuning,
  DEFAULT_CORRECTION_TUNING,
  NetworkApplyContext,
  NetworkFrame,
} from '../interfaces/i-network-syncable';
import {
  NET_POSITION_STEP,
  NET_VELOCITY_STEP,
  rNormalize,
  rQuantize,
  vQuantize,
  extrapolationSeconds,
  gainFactor,
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
} from './net-math';

/**
 * Networked snapshot of a mover (character controller): position, rotation, fall velocity,
 * airborne horizontal velocity, crouch flag, and `v` - the velocity the mover actually moved at on
 * its last tick, used to extrapolate the snapshot (a grounded walk's horizontal motion is driven by
 * input and appears in neither `fv` nor `ahv`).
 */
export interface MoverNetState<D = unknown, R = unknown> {
  p: D;
  r: R;
  fv: D;
  ahv: D;
  crouch: boolean;
  v?: D;
}

/**
 * The surface of a character controller entity `MoverCorrection` drives - satisfied structurally
 * by `CharacterController3dEntity` and `CharacterController2dEntity`.
 */
export interface INetworkMover<D, R> {
  position: D;
  rotation: R;
  fallVelocity: D;
  airHorizontalVelocity: D;
  isCrouching: boolean;
  /** consumed (then cleared) by the mover's next `move()`, so corrections slide against geometry */
  externalDisplacement: D;
  /** velocity the mover actually moved at on its last tick */
  readonly actualVelocity: D;
}

/**
 * Replica correction for movers (kinematic capsules driven through `move()`): the position error
 * never teleports the capsule - it becomes the mover's `externalDisplacement`, which its next
 * `move()` consumes, so a correction slides against geometry and respects step/snap-to-ground like
 * any other movement. Forwarded input does most of the work; correction only erases a tick or two of
 * divergence. Rotation is lerped, `fallVelocity`/`airHorizontalVelocity` lerped toward the target,
 * crouch applied directly. While the stream is stalled (`ctx.sinceReceivedMs` between
 * `extrapolateMaxMs` and `coastMaxMs`) the mover is left alone (`'coast'`), only crouch is still
 * adopted. A snap (error above `snapDistance`, or `ctx.snap`) writes position and
 * rotation through the setters and resets both momentum vectors to the owner's.
 */
export class MoverCorrection {
  /**
   * Owner side: snapshot `mover` as plain JSON, quantised for the wire (positions to 1 mm,
   * velocities to 1 mm/s, quaternion components to 5 decimals - see `quantizeNetPosition`).
   * @param mover - the owner's local character entity
   * @param frame - the world's frame (`Gg3dWorld.frame`): the snapshot is converted to global
   * coordinates through it. Omitted (2D, or an identity frame), the snapshot is in world coordinates.
   */
  static capture<D, R>(mover: INetworkMover<D, R>, frame?: NetworkFrame<D, R> | null): MoverNetState<D, R> {
    const state: MoverNetState<D, R> = {
      p: mover.position,
      r: mover.rotation,
      fv: mover.fallVelocity,
      ahv: mover.airHorizontalVelocity,
      crouch: mover.isCrouching,
      v: mover.actualVelocity,
    };
    const global = frame ? MoverCorrection.toGlobal(state, frame) : state;
    const vel = (v: D) => vQuantize(v as unknown as NetVec, NET_VELOCITY_STEP) as unknown as D;
    return {
      p: vQuantize(global.p as unknown as NetVec, NET_POSITION_STEP) as unknown as D,
      r: rQuantize(global.r as unknown as NetRot) as unknown as R,
      fv: vel(global.fv),
      ahv: vel(global.ahv),
      crouch: global.crouch,
      v: vel(global.v!),
    };
  }

  /**
   * `state` (local) converted to global coordinates through `frame`: position as a point, rotation
   * as an orientation, every velocity as a direction. Every other field is kept as is.
   */
  static toGlobal<D, R, S extends MoverNetState<D, R>>(state: S, frame: NetworkFrame<D, R>): S {
    return {
      ...state,
      p: frame.toGlobalPoint(state.p),
      r: frame.toGlobalRotation(state.r),
      fv: frame.toGlobalDirection(state.fv),
      ahv: frame.toGlobalDirection(state.ahv),
      ...(state.v !== undefined ? { v: frame.toGlobalDirection(state.v) } : {}),
    };
  }

  /** `state` (global) converted to the local coordinates of `frame` - the inverse of {@link toGlobal}. */
  static toLocal<D, R, S extends MoverNetState<D, R>>(state: S, frame: NetworkFrame<D, R>): S {
    return {
      ...state,
      p: frame.toLocalPoint(state.p),
      r: frame.toLocalRotation(state.r),
      fv: frame.toLocalDirection(state.fv),
      ahv: frame.toLocalDirection(state.ahv),
      ...(state.v !== undefined ? { v: frame.toLocalDirection(state.v) } : {}),
    };
  }

  /**
   * Where a replica of `target` is steered to once the snapshot is `ageMs` old: its position
   * extrapolated along the owner's velocity, capped at `extrapolateMaxMs`.
   */
  static targetPosition<D, R>(
    target: MoverNetState<D, R>,
    ageMs: number,
    tuning: CorrectionTuning = DEFAULT_CORRECTION_TUNING,
  ): D {
    const velocity = (target.v ?? vAdd(target.fv as unknown as NetVec, target.ahv as unknown as NetVec)) as NetVec;
    return vAdd(target.p as unknown as NetVec, vScale(velocity, extrapolationSeconds(ageMs, tuning))) as unknown as D;
  }

  /**
   * Replica side: reconcile `mover` toward `target` - see the class doc.
   * @param mover - the replica's local character entity
   * @param target - the owner's snapshot
   * @param ctx - age/silence/dt/snap/tuning of this application
   * @param tuning - overrides `ctx.tuning` when given (`undefined` for `ctx.tuning`)
   * @param frame - the world's frame, read now: `target` is global and gets converted to local
   * coordinates through it. Omitted (2D, or an identity frame), `target` is in world coordinates.
   */
  static correct<D, R>(
    mover: INetworkMover<D, R>,
    target: MoverNetState<D, R>,
    ctx: NetworkApplyContext,
    tuning: CorrectionTuning = ctx.tuning ?? DEFAULT_CORRECTION_TUNING,
    frame?: NetworkFrame<D, R> | null,
  ): CorrectionOutcome {
    if (frame) {
      target = MoverCorrection.toLocal(target, frame);
    }
    // a quantised quaternion is a little off unit length
    target = { ...target, r: rNormalize(target.r as unknown as NetRot) as unknown as R };
    const tP = MoverCorrection.targetPosition(target, ctx.ageMs, tuning) as unknown as NetVec;
    const lP = mover.position as unknown as NetVec;
    const error = vSub(tP, lP);
    const errLen = vLen(error);

    if (mover.isCrouching !== target.crouch) {
      mover.isCrouching = target.crouch;
    }

    if (!ctx.snap && isCoasting(ctx.sinceReceivedMs, tuning)) {
      // the stream stalled: the mover keeps going on the input it has rather than being pulled back
      return 'coast';
    }

    if (ctx.snap || errLen > tuning.snapDistance) {
      mover.position = tP as unknown as D;
      mover.rotation = rClone(target.r as unknown as NetRot) as unknown as R;
      mover.fallVelocity = vClone(target.fv as unknown as NetVec) as unknown as D;
      mover.airHorizontalVelocity = vClone(target.ahv as unknown as NetVec) as unknown as D;
      mover.externalDisplacement = vScale(lP, 0) as unknown as D;
      return 'snap';
    }

    const posK = gainFactor(tuning.positionGain, ctx.dt);
    const rotK = gainFactor(tuning.rotationGain, ctx.dt);
    let outcome: CorrectionOutcome = 'none';

    const lR = mover.rotation as unknown as NetRot;
    if (rotationError(lR, target.r as unknown as NetRot) > tuning.rotationDeadzone) {
      mover.rotation = rotationLerp(lR, target.r as unknown as NetRot, rotK) as unknown as R;
      outcome = 'blend';
    }
    if (errLen > tuning.deadzone) {
      mover.externalDisplacement = vScale(error, posK) as unknown as D;
      mover.fallVelocity = vLerp(
        mover.fallVelocity as unknown as NetVec,
        target.fv as unknown as NetVec,
        posK,
      ) as unknown as D;
      mover.airHorizontalVelocity = vLerp(
        mover.airHorizontalVelocity as unknown as NetVec,
        target.ahv as unknown as NetVec,
        posK,
      ) as unknown as D;
      outcome = 'blend';
    }
    return outcome;
  }
}

/** Function alias of {@link MoverCorrection.capture}. */
export const captureMover = MoverCorrection.capture;

/** Function alias of {@link MoverCorrection.correct}. */
export const correctMover = MoverCorrection.correct;
