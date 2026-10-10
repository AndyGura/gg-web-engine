import type { Particle } from './particle';

/** A keyframe of a {@link ParticleCurve}: `value` at normalized age `t` (`0` = spawn, `1` = death). */
export type ParticleKeyframe = { readonly t: number; readonly value: number };

/** A function curve: any value from the normalized age and the particle itself. */
export type ParticleCurveFunction = (t: number, particle: Particle<any, any>) => number;

/**
 * A value over a particle's normalized age `t` (`0` = spawn, `1` = death; always `0` for a particle
 * with an infinite lifetime). Forms:
 * - a number: constant;
 * - `number[]`: keyframes spread evenly from `t = 0` to `t = 1`, linearly interpolated (`[1, 0]`
 *   fades from 1 to 0, `[0, 1, 0]` rises and falls);
 * - `ParticleKeyframe[]`: keyframes at given `t` (sorted ascending), linearly interpolated, held
 *   before the first and after the last;
 * - `{ keyframes, interpolation: 'step' }`: either keyframe form, each value held until the next
 *   keyframe instead of interpolated - a lookup table of an old game (`'linear'` is the default);
 * - a function `(t, particle) => number`, for anything else.
 */
export type ParticleCurve =
  | number
  | readonly number[]
  | readonly ParticleKeyframe[]
  | {
      readonly keyframes: readonly number[] | readonly ParticleKeyframe[];
      readonly interpolation?: 'linear' | 'step';
    }
  | ParticleCurveFunction;

function evaluateEven(values: readonly number[], t: number, step: boolean): number {
  const n = values.length;
  if (n === 0) {
    return 1;
  }
  if (n === 1 || t <= 0) {
    return values[0];
  }
  if (t >= 1) {
    return values[n - 1];
  }
  const f = t * (n - 1);
  const i = Math.floor(f);
  if (step) {
    return values[i];
  }
  return values[i] + (values[i + 1] - values[i]) * (f - i);
}

function evaluateKeyframes(keys: readonly ParticleKeyframe[], t: number, step: boolean): number {
  const n = keys.length;
  if (n === 0) {
    return 1;
  }
  if (t <= keys[0].t) {
    return keys[0].value;
  }
  for (let i = 1; i < n; i++) {
    const b = keys[i];
    if (t < b.t) {
      const a = keys[i - 1];
      if (step) {
        return a.value;
      }
      const span = b.t - a.t;
      return span > 0 ? a.value + (b.value - a.value) * ((t - a.t) / span) : b.value;
    }
  }
  return keys[n - 1].value;
}

function evaluateTable(keys: readonly number[] | readonly ParticleKeyframe[], t: number, step: boolean): number {
  if (keys.length > 0 && typeof keys[0] === 'number') {
    return evaluateEven(keys as readonly number[], t, step);
  }
  return evaluateKeyframes(keys as readonly ParticleKeyframe[], t, step);
}

/**
 * The value of `curve` at normalized age `t`. An `undefined` curve is `1`, so it can multiply a
 * particle's own value unconditionally.
 */
export function evaluateParticleCurve(
  curve: ParticleCurve | undefined | null,
  t: number,
  particle: Particle<any, any>,
): number {
  if (curve === undefined || curve === null) {
    return 1;
  }
  if (typeof curve === 'number') {
    return curve;
  }
  if (typeof curve === 'function') {
    return curve(t, particle);
  }
  if (Array.isArray(curve)) {
    return evaluateTable(curve as readonly number[] | readonly ParticleKeyframe[], t, false);
  }
  const table = curve as { keyframes: readonly number[] | readonly ParticleKeyframe[]; interpolation?: string };
  return evaluateTable(table.keyframes, t, table.interpolation === 'step');
}
