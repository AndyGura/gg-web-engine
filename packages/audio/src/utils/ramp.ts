/**
 * Default smoothing time constant (seconds) for every `AudioParam` write this adapter makes -
 * position, gain, pan. Fast enough to track real motion within a frame or two, slow enough to
 * turn per-tick position/volume jumps into a continuous ramp instead of a discontinuity - a direct
 * `.value =` assignment on a param driven by per-tick world state is the main cause of audible
 * zipper noise on a moving positional source, since each tick's new value snaps in immediately
 * rather than being smoothed into the previous one.
 */
export const DEFAULT_RAMP_TAU = 0.04;

/**
 * Write `value` into `param` via `setTargetAtTime` rather than direct assignment - the one rule
 * every position/gain/pan write in this package follows, without exception. Never fall back to
 * `param.value = value` for anything driven by world state (position, per-tick volume changes),
 * even "to be safe" - see `DEFAULT_RAMP_TAU`'s doc for why that reintroduces the exact jitter this
 * adapter exists to avoid.
 */
export function rampParam(context: BaseAudioContext, param: AudioParam, value: number, tau = DEFAULT_RAMP_TAU): void {
  param.setTargetAtTime(value, context.currentTime, tau);
}

/**
 * Jump `param` to `value` right now, dropping any ramp still in progress. The one exception to
 * `rampParam`: only for a param whose node is silent at this moment (nothing playing into it, or
 * cut off from the output), so the jump can't be heard - e.g. a virtual source's gain/position just
 * before it is started again and faded in (see `WebAudioSourceComponentBase`).
 */
export function setParamNow(context: BaseAudioContext, param: AudioParam, value: number): void {
  param.cancelScheduledValues(context.currentTime);
  param.setValueAtTime(value, context.currentTime);
}
