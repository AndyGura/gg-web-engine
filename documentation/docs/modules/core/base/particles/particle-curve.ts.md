---
title: core/base/particles/particle-curve.ts
nav_order: 169
parent: Modules
---

## particle-curve overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ParticleCurve (type alias)](#particlecurve-type-alias)
  - [ParticleCurveFunction (type alias)](#particlecurvefunction-type-alias)
  - [ParticleKeyframe (type alias)](#particlekeyframe-type-alias)
  - [evaluateParticleCurve](#evaluateparticlecurve)

---

# utils

## ParticleCurve (type alias)

A value over a particle's normalized age `t` (`0` = spawn, `1` = death; always `0` for a particle
with an infinite lifetime). Forms:

- a number: constant;
- `number[]`: keyframes spread evenly from `t = 0` to `t = 1`, linearly interpolated (`[1, 0]`
  fades from 1 to 0, `[0, 1, 0]` rises and falls);
- `ParticleKeyframe[]`: keyframes at given `t` (sorted ascending), linearly interpolated, held
  before the first and after the last;
- `{ keyframes, interpolation: 'step' }`: either keyframe form, each value held until the next
  keyframe instead of interpolated - a lookup table of an old game (`'linear'` is the default).
  With `number[]` keyframes every value gets an equal share of the life (`[a, b, c]` shows `a`
  for the first third, `c` for the last), unlike the linear spread where the last value sits at
  `t = 1`;
- a function `(t, particle) => number`, for anything else.

**Signature**

```ts
export type ParticleCurve =
  | number
  | readonly number[]
  | readonly ParticleKeyframe[]
  | {
      readonly keyframes: readonly number[] | readonly ParticleKeyframe[]
      readonly interpolation?: 'linear' | 'step'
    }
  | ParticleCurveFunction
```

## ParticleCurveFunction (type alias)

A function curve: any value from the normalized age and the particle itself.

**Signature**

```ts
export type ParticleCurveFunction = (t: number, particle: Particle<any, any>) => number
```

## ParticleKeyframe (type alias)

A keyframe of a {@link ParticleCurve}: `value` at normalized age `t` (`0` = spawn, `1` = death).

**Signature**

```ts
export type ParticleKeyframe = { readonly t: number; readonly value: number }
```

## evaluateParticleCurve

The value of `curve` at normalized age `t`. An `undefined` curve is `1`, so it can multiply a
particle's own value unconditionally.

**Signature**

```ts
export declare function evaluateParticleCurve(
  curve: ParticleCurve | undefined | null,
  t: number,
  particle: Particle<any, any>
): number
```
