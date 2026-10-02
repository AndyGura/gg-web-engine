---
title: core/base/network/net-math.ts
nav_order: 141
parent: Modules
---

## net-math overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [NetRot (type alias)](#netrot-type-alias)
  - [NetVec (type alias)](#netvec-type-alias)
  - [avClone](#avclone)
  - [avLerp](#avlerp)
  - [gainFactor](#gainfactor)
  - [integrateRotation](#integraterotation)
  - [rClone](#rclone)
  - [rotationError](#rotationerror)
  - [rotationLerp](#rotationlerp)
  - [vAdd](#vadd)
  - [vClone](#vclone)
  - [vLen](#vlen)
  - [vLerp](#vlerp)
  - [vScale](#vscale)
  - [vSub](#vsub)
  - [vZero](#vzero)

---

# utils

## NetRot (type alias)

**Signature**

```ts
export type NetRot = number | Point4
```

## NetVec (type alias)

Dimension-agnostic vector/rotation helpers the correction helpers share. A 2D world's positions
are `Point2` and rotations plain angles; a 3D world's are `Point3` and quaternions - every function
here tells them apart at runtime (`z` present / rotation is a number) and dispatches to
`Pnt2`/`Pnt3`/`Qtrn`, so one algorithm serves both. Internal to the network helpers, not
re-exported from the package root.

**Signature**

```ts
export type NetVec = Point2 | Point3
```

## avClone

Plain-JSON copy of an angular velocity: a scalar in 2D, a world-space axis\*rate vector in 3D.

**Signature**

```ts
export declare function avClone(av: number | Point3): number | Point3
```

## avLerp

Interpolate angular velocity (scalar in 2D, vector in 3D).

**Signature**

```ts
export declare function avLerp(a: number | Point3, b: number | Point3, t: number): number | Point3
```

## gainFactor

Per-tick blend factor for a per-second gain: `gain * dt`, clamped to [0, 1].

**Signature**

```ts
export declare function gainFactor(gainPerSecond: number, dtMs: number): number
```

## integrateRotation

Advance rotation `r` by angular velocity `av` (rad/s; scalar in 2D, world-space axis\*rate vector in
3D) over `seconds`.

**Signature**

```ts
export declare function integrateRotation<R extends NetRot>(r: R, av: number | Point3, seconds: number): R
```

## rClone

Plain-JSON copy of a rotation.

**Signature**

```ts
export declare function rClone<R extends NetRot>(r: R): R
```

## rotationError

Smallest angle (radians, >= 0) between two rotations.

**Signature**

```ts
export declare function rotationError(a: NetRot, b: NetRot): number
```

## rotationLerp

Interpolate rotation `a` toward `b` by `t` along the shortest path.

**Signature**

```ts
export declare function rotationLerp<R extends NetRot>(a: R, b: R, t: number): R
```

## vAdd

**Signature**

```ts
export declare function vAdd<D extends NetVec>(a: D, b: D): D
```

## vClone

Plain-JSON copy of a vector (drops any extra fields a native/adapter vector object might carry).

**Signature**

```ts
export declare function vClone<D extends NetVec>(a: D): D
```

## vLen

**Signature**

```ts
export declare function vLen(a: NetVec): number
```

## vLerp

**Signature**

```ts
export declare function vLerp<D extends NetVec>(a: D, b: D, t: number): D
```

## vScale

**Signature**

```ts
export declare function vScale<D extends NetVec>(a: D, s: number): D
```

## vSub

**Signature**

```ts
export declare function vSub<D extends NetVec>(a: D, b: D): D
```

## vZero

**Signature**

```ts
export declare function vZero<D extends NetVec>(like: D): D
```
