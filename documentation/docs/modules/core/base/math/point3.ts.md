---
title: core/base/math/point3.ts
nav_order: 63
parent: Modules
---

## point3 overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Pnt3 (class)](#pnt3-class)
    - [clone (static method)](#clone-static-method)
    - [add (static method)](#add-static-method)
    - [sub (static method)](#sub-static-method)
    - [lenSq (static method)](#lensq-static-method)
    - [len (static method)](#len-static-method)
    - [cross (static method)](#cross-static-method)
    - [norm (static method)](#norm-static-method)
    - [scalarMult (static method)](#scalarmult-static-method)
    - [lerp (static method)](#lerp-static-method)
    - [rot (static method)](#rot-static-method)
    - [rotAround (static method)](#rotaround-static-method)

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
