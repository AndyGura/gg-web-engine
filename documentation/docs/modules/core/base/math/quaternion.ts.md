---
title: core/base/math/quaternion.ts
nav_order: 60
parent: Modules
---

## quaternion overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Qtrn (class)](#qtrn-class)
    - [clone (static method)](#clone-static-method)
    - [add (static method)](#add-static-method)
    - [mult (static method)](#mult-static-method)
    - [combineRotations (static method)](#combinerotations-static-method)
    - [lerp (static method)](#lerp-static-method)
    - [slerp (static method)](#slerp-static-method)
    - [fromAngle (static method)](#fromangle-static-method)
    - [fromMatrix4 (static method)](#frommatrix4-static-method)
    - [fromEuler (static method)](#fromeuler-static-method)
    - [toEuler (static method)](#toeuler-static-method)
    - [lookAt (static method)](#lookat-static-method)

---

# utils

## Qtrn (class)

**Signature**

```ts
export declare class Qtrn
```

### clone (static method)

clone quaternion

**Signature**

```ts
static clone(q: Point4): Point4
```

### add (static method)

add quaternion b to quaternion a

**Signature**

```ts
static add(a: Point4, b: Point4): Point4
```

### mult (static method)

**Signature**

```ts
static mult(a: Point4, b: Point4): Point4
```

### combineRotations (static method)

**Signature**

```ts
static combineRotations(...quaternions: Point4[]): Point4
```

### lerp (static method)

linear interpolation

**Signature**

```ts
static lerp(a: Point4, b: Point4, t: number): Point4
```

### slerp (static method)

spherical interpolation

**Signature**

```ts
static slerp(a: Point4, b: Point4, t: number): Point4
```

### fromAngle (static method)

creates quaternion from simple angle around axis. Assumes that axis vector is normalized

**Signature**

```ts
static fromAngle(axis: Point3, angle: number)
```

### fromMatrix4 (static method)

creates quaternion from 4-dimension rotation matrix

**Signature**

```ts
static fromMatrix4(m: number[]): Point4
```

### fromEuler (static method)

creates a quaternion from euler

**Signature**

```ts
static fromEuler(e: Point3): Point4
```

### toEuler (static method)

converts a quaternion to euler

**Signature**

```ts
static toEuler(q: Point4): Point3
```

### lookAt (static method)

creates a rotation for object, so it will look at some point in space

**Signature**

```ts
static lookAt(eye: Point3, target: Point3, up: Point3): Point4
```
