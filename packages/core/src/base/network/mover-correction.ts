import { CorrectionTuning, DEFAULT_CORRECTION_TUNING, NetworkApplyContext } from '../interfaces/i-network-syncable';
import {
  gainFactor,
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
import { CorrectionOutcome } from './rigid-body-correction';

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
 * crouch applied directly. A snap (error above `snapDistance`, or `ctx.snap`) writes position and
 * rotation through the setters and resets both momentum vectors to the owner's.
 */
export class MoverCorrection {
  /** Owner side: snapshot `mover` as plain JSON. */
  static capture<D, R>(mover: INetworkMover<D, R>): MoverNetState<D, R> {
    return {
      p: vClone(mover.position as unknown as NetVec) as unknown as D,
      r: rClone(mover.rotation as unknown as NetRot) as unknown as R,
      fv: vClone(mover.fallVelocity as unknown as NetVec) as unknown as D,
      ahv: vClone(mover.airHorizontalVelocity as unknown as NetVec) as unknown as D,
      crouch: mover.isCrouching,
      v: vClone(mover.actualVelocity as unknown as NetVec) as unknown as D,
    };
  }

  /**
   * Replica side: reconcile `mover` toward `target` - see the class doc.
   * @param mover - the replica's local character entity
   * @param target - the owner's snapshot
   * @param ctx - age/dt/snap/tuning of this application
   * @param tuning - overrides `ctx.tuning` when given
   */
  static correct<D, R>(
    mover: INetworkMover<D, R>,
    target: MoverNetState<D, R>,
    ctx: NetworkApplyContext,
    tuning: CorrectionTuning = ctx.tuning ?? DEFAULT_CORRECTION_TUNING,
  ): CorrectionOutcome {
    const ageS = Math.max(0, Math.min(ctx.ageMs, tuning.extrapolateMaxMs)) / 1000;
    const velocity = (target.v ?? vAdd(target.fv as unknown as NetVec, target.ahv as unknown as NetVec)) as NetVec;
    const tP = vAdd(target.p as unknown as NetVec, vScale(velocity, ageS));
    const lP = mover.position as unknown as NetVec;
    const error = vSub(tP, lP);
    const errLen = vLen(error);

    if (mover.isCrouching !== target.crouch) {
      mover.isCrouching = target.crouch;
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
