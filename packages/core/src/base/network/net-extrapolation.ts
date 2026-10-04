import { CorrectionTuning, DEFAULT_CORRECTION_TUNING } from '../interfaces/i-network-syncable';
import { isCoasting } from './net-math';
import { MoverCorrection, MoverNetState } from './mover-correction';
import { RigidBodyCorrection, RigidBodyNetState } from './rigid-body-correction';

const isVector = (v: unknown): boolean => !!v && typeof (v as { x?: unknown }).x === 'number';

/**
 * Where a replica of a networked `state` is steered to once the snapshot is `ageMs` old, for any state
 * shaped like (or containing) a {@link RigidBodyNetState} or a {@link MoverNetState} - the same
 * extrapolation the correction helpers apply. `null` for a state of another shape. For a network
 * layer's diagnostics, which sees states without knowing their entity class.
 */
export function extrapolateNetPosition<D = unknown>(
  state: unknown,
  ageMs: number,
  tuning: CorrectionTuning = DEFAULT_CORRECTION_TUNING,
): D | null {
  const s = state as { p?: unknown; lv?: unknown; v?: unknown; fv?: unknown; ahv?: unknown } | null | undefined;
  if (!s || !isVector(s.p)) {
    return null;
  }
  if (isVector(s.lv)) {
    return RigidBodyCorrection.targetPosition(s as RigidBodyNetState<D, unknown>, ageMs, tuning);
  }
  if (isVector(s.v) || (isVector(s.fv) && isVector(s.ahv))) {
    return MoverCorrection.targetPosition(s as MoverNetState<D, unknown>, ageMs, tuning);
  }
  return null;
}

/**
 * Whether a replica whose latest snapshot arrived `sinceReceivedMs` ago is coasting: the stream has
 * been silent for longer than a snapshot is extrapolated (`extrapolateMaxMs`), not yet long enough for
 * the replica to be corrected to it again (`coastMaxMs`).
 */
export function isNetStateCoasting(
  sinceReceivedMs: number,
  tuning: CorrectionTuning = DEFAULT_CORRECTION_TUNING,
): boolean {
  return isCoasting(sinceReceivedMs, tuning);
}
