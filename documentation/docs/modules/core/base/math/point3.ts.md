---
title: core/base/math/point3.ts
nav_order: 90
parent: Modules
---

## point3 overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Pnt3 (class)](#pnt3-class)
    - [clone (static method)](#clone-static-method)
    - [spr (static method)](#spr-static-method)
    - [neg (static method)](#neg-static-method)
    - [add (static method)](#add-static-method)
    - [sub (static method)](#sub-static-method)
    - [scale (static method)](#scale-static-method)
    - [avg (static method)](#avg-static-method)
    - [round (static method)](#round-static-method)
    - [lenSq (static method)](#lensq-static-method)
    - [len (static method)](#len-static-method)
    - [dist (static method)](#dist-static-method)
    - [cross (static method)](#cross-static-method)
    - [norm (static method)](#norm-static-method)
    - [scalarMult (static method)](#scalarmult-static-method)
    - [lerp (static method)](#lerp-static-method)
    - [angle (static method)](#angle-static-method)
    - [rot (static method)](#rot-static-method)
    - [rotAround (static method)](#rotaround-static-method)
    - [toSpherical (static method)](#tospherical-static-method)
    - [fromSpherical (static method)](#fromspherical-static-method)

---

# utils

## Pnt3 (class)

**Signature**

```ts
export declare class Pnt3
```

### clone (static method)

clone point

**Signature**

```ts
static clone(p: Point3): Point3
```

### spr (static method)

spread point components

**Signature**

```ts
static spr(p: Point3): [number, number, number]
```

### neg (static method)

get negation of the point

**Signature**

```ts
static neg(p: Point3): Point3
```

### add (static method)

add point b to point a

**Signature**

```ts
static add(a: Point3, b: Point3): Point3
```

### sub (static method)

subtract point b from point a

**Signature**

```ts
static sub(a: Point3, b: Point3): Point3
```

### scale (static method)

scale point b by point. The result is the point, where each component is a product of appropriate components of input points

**Signature**

```ts
static scale(a: Point3, s: Point3): Point3
```

### avg (static method)

average point between a and b

**Signature**

```ts
static avg(a: Point3, b: Point3): Point3
```

### round (static method)

round point components

**Signature**

```ts
static round(p: Point3): Point3
```

### lenSq (static method)

calculate vector length (squared)

**Signature**

```ts
static lenSq(v: Point3)
```

### len (static method)

calculate vector length

**Signature**

```ts
static len(v: Point3)
```

### dist (static method)

distance between points

**Signature**

```ts
static dist(a: Point3, b: Point3): number
```

### cross (static method)

cross vectors

**Signature**

```ts
static cross(a: Point3, b: Point3): Point3
```

### norm (static method)

normalize

**Signature**

```ts
static norm(p: Point3): Point3
```

### scalarMult (static method)

scalar multiplication

**Signature**

```ts
static scalarMult(p: Point3, m: number): Point3
```

### lerp (static method)

linear interpolation

**Signature**

```ts
static lerp(a: Point3, b: Point3, t: number): Point3
```

### angle (static method)

angle between vectors in radians

**Signature**

```ts
static angle(a: Point3, b: Point3): number
```

### rot (static method)

rotate point a with quaternion q

**Signature**

```ts
static rot(p: Point3, q: Point4): Point3
```

### rotAround (static method)

rotate point around axis a (normalized vector)

**Signature**

```ts
static rotAround(p: Point3, axis: Point3, angle: number): Point3
```

### toSpherical (static method)

Converts a cartesian 3D point to a spherical coordinate system, where theta is azimuth and phi is inclination,
theta == 0 is faced towards X axis direction, and phi == 0 is faced towards zenith (Z axis)

**Signature**

```ts
static toSpherical(p: Point3): Spherical
```

### fromSpherical (static method)

Converts a spherical coordinate system to a cartesian 3D point. Used spherical coordinates, where theta is azimuth
and phi is inclination, theta == 0 is faced towards X axis direction, and phi == 0 is faced towards zenith (Z axis)

**Signature**

```ts
static fromSpherical(s: Spherical): Point3
```
