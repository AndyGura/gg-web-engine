/**
 * Default smoothing time constant (seconds) for every `AudioParam` write this adapter makes -
 * position, gain, pan. Fast enough to track real motion within a frame or two, slow enough to
 * turn per-tick position/volume jumps into a continuous ramp instead of a discontinuity - see the
 * audio RFC's "The jitter, diagnosed" section for why a direct `.value =` assignment (rather than
 * this) is the main cause of audible zipper noise on a moving positional source.
 */
export const DEFAULT_RAMP_TAU = 0.04;

/**
 * Write `value` into `param` via `setTargetAtTime` rather than direct assignment - the one rule
 * every position/gain/pan write in this package follows, without exception. Never fall back to
 * `param.value = value` for anything driven by world state (position, per-tick volume changes),
 * even "to be safe" - see the audio RFC for why that reintroduces the exact jitter this adapter
 * exists to avoid.
 */
export function rampParam(context: BaseAudioContext, param: AudioParam, value: number, tau = DEFAULT_RAMP_TAU): void {
  param.setTargetAtTime(value, context.currentTime, tau);
}
