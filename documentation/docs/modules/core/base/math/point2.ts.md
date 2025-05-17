---
title: core/base/math/point2.ts
nav_order: 88
parent: Modules
---

## point2 overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Pnt2 (class)](#pnt2-class)
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
    - [norm (static method)](#norm-static-method)
    - [scalarMult (static method)](#scalarmult-static-method)
    - [dot (static method)](#dot-static-method)
    - [lerp (static method)](#lerp-static-method)
    - [slerp (static method)](#slerp-static-method)
    - [angle (static method)](#angle-static-method)
    - [rot (static method)](#rot-static-method)
    - [rotAround (static method)](#rotaround-static-method)
    - [toPolar (static method)](#topolar-static-method)
    - [fromPolar (static method)](#frompolar-static-method)

---

# utils

## Pnt2 (class)

**Signature**

```ts
export declare class Pnt2
```

### clone (static method)

clone point

**Signature**

```ts
static clone(p: Point2): Point2
```

### spr (static method)

spread point components

**Signature**

```ts
static spr(p: Point2): [number, number]
```

### neg (static method)

get negation of the point

**Signature**

```ts
static neg(p: Point2): Point2
```

### add (static method)

add point b to point a

**Signature**

```ts
static add(a: Point2, b: Point2): Point2
```

### sub (static method)

subtract point b from point a

**Signature**

```ts
static sub(a: Point2, b: Point2): Point2
```

### scale (static method)

scale point b by point. The result is the point, where each component is a product of appropriate components of input points

**Signature**

```ts
static scale(a: Point2, s: Point2): Point2
```

### avg (static method)

average point between a and b

**Signature**

```ts
static avg(a: Point2, b: Point2): Point2
```

### round (static method)

round point components

**Signature**

```ts
static round(p: Point2): Point2
```

### lenSq (static method)

calculate vector length (squared)

**Signature**

```ts
static lenSq(v: Point2)
```

### len (static method)

calculate vector length

**Signature**

```ts
static len(v: Point2)
```

### dist (static method)

distance between points

**Signature**

```ts
static dist(a: Point2, b: Point2): number
```

### norm (static method)

normalize

**Signature**

```ts
static norm(p: Point2): Point2
```

### scalarMult (static method)

scalar multiplication

**Signature**

```ts
static scalarMult(p: Point2, m: number): Point2
```

### dot (static method)

dot multiplication

**Signature**

```ts
static dot(a: Point2, b: Point2): number
```

### lerp (static method)

linear interpolation

**Signature**

```ts
static lerp(a: Point2, b: Point2, t: number): Point2
```

### slerp (static method)

linear interpolation (spherical/polar)

**Signature**

```ts
static slerp(a: Point2, b: Point2, t: number): Point2
```

### angle (static method)

angle between vectors in radians

**Signature**

```ts
static angle(a: Point2, b: Point2): number
```

### rot (static method)

rotate point around zero by provided angle

**Signature**

```ts
static rot(p: Point2, angle: number): Point2
```

### rotAround (static method)

rotate point around pivot by provided angle

**Signature**

```ts
static rotAround(p: Point2, pivot: Point2, angle: number): Point2
```

### toPolar (static method)

Converts a cartesian 2D point to a polar coordinate system,
phi == 0 is faced towards X axis direction

**Signature**

```ts
static toPolar(p: Point2): Polar
```

### fromPolar (static method)

Converts a polar coordinate system to a cartesian 2D point. Used polar coordinates,
where phi == 0 is faced towards X axis direction

**Signature**

```ts
static fromPolar(p: Polar): Point2
```
