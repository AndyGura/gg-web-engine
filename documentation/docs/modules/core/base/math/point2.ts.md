---
title: core/base/math/point2.ts
nav_order: 61
parent: Modules
---

## point2 overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Pnt2 (class)](#pnt2-class)
    - [clone (static method)](#clone-static-method)
    - [add (static method)](#add-static-method)
    - [sub (static method)](#sub-static-method)
    - [lenSq (static method)](#lensq-static-method)
    - [len (static method)](#len-static-method)
    - [dist (static method)](#dist-static-method)
    - [norm (static method)](#norm-static-method)
    - [scalarMult (static method)](#scalarmult-static-method)
    - [lerp (static method)](#lerp-static-method)
    - [angle (static method)](#angle-static-method)

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

### lerp (static method)

linear interpolation

**Signature**

```ts
static lerp(a: Point2, b: Point2, t: number): Point2
```

### angle (static method)

angle between vectors in radians

**Signature**

```ts
static angle(a: Point2, b: Point2): number
```
