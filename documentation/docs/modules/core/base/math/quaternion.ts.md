---
title: core/base/math/quaternion.ts
nav_order: 88
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
    - [rotAround (static method)](#rotaround-static-method)

---

# utils

## Qtrn (class)

Helper class with static functions, containing util functions, related to Quaternion (represented as Point4 type).
In terms of rotation, a quaternion is a mathematical representation of an orientation or rotation in 3D space.
It consists of a scalar component and a vector component, and can be written as q = w + xi + yj + zk, where w is the
scalar component, and i, j, and k are the vector components. The scalar component, w, represents the amount of
rotation, and the vector component, (x, y, z), represents the axis of rotation. The length of the vector component
represents the amount of rotation around the axis. Quaternions are often used in 3D computer graphics and animation
because they can be used to interpolate between two rotations, and they can avoid some of the issues with using
Euler angles (such as gimbal lock).

**Signature**

```ts
export declare class Qtrn
```

### clone (static method)

Returns a new quaternion instance with the same values as the given quaternion object.

**Signature**

```ts
static clone(q: Point4): Point4
```

### add (static method)

Returns the sum of two Point4 objects.

**Signature**

```ts
static add(a: Point4, b: Point4): Point4
```

### mult (static method)

Returns the result of multiplying two Point4 objects. This can be used for combining rotations

**Signature**

```ts
static mult(a: Point4, b: Point4): Point4
```

### combineRotations (static method)

Combines an arbitrary number of quaternions by multiplying them together in order.

**Signature**

```ts
static combineRotations(...quaternions: Point4[]): Point4
```

### lerp (static method)

Performs a linear interpolation between two Point4 objects.

**Signature**

```ts
static lerp(a: Point4, b: Point4, t: number): Point4
```

### slerp (static method)

Performs a spherical linear interpolation between two Point4 objects.

**Signature**

```ts
static slerp(a: Point4, b: Point4, t: number): Point4
```

### fromAngle (static method)

Converts an angle and an axis of rotation into a quaternion

**Signature**

```ts
static fromAngle(axis: Point3, angle: number)
```

### fromMatrix4 (static method)

Converts a 4x4 matrix representing a rotation into a quaternion

**Signature**

```ts
static fromMatrix4(m: number[]): Point4
```

### fromEuler (static method)

Creates a quaternion from euler

**Signature**

```ts
static fromEuler(e: Point3): Point4
```

### toEuler (static method)

Converts a quaternion to euler

**Signature**

```ts
static toEuler(q: Point4): Point3
```

### lookAt (static method)

Returns a quaternion that represents the rotation required to align an object to face towards a target point.

**Signature**

```ts
static lookAt(eye: Point3, target: Point3, up: Point3 = Pnt3.Z): Point4
```

### rotAround (static method)

Returns a quaternion that represents the input quaternion, rotated around provided axis vector by provided angle.
Assumes that axis vector is already normalized

**Signature**

```ts
static rotAround(q: Point4, axis: Point3, angle: number): Point4
```
