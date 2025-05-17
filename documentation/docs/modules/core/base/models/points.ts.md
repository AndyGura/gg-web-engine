---
title: core/base/models/points.ts
nav_order: 95
parent: Modules
---

## points overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MutablePoint2 (type alias)](#mutablepoint2-type-alias)
  - [MutablePoint3 (type alias)](#mutablepoint3-type-alias)
  - [MutablePoint4 (type alias)](#mutablepoint4-type-alias)
  - [MutablePolar (type alias)](#mutablepolar-type-alias)
  - [MutableSpherical (type alias)](#mutablespherical-type-alias)
  - [Point2 (type alias)](#point2-type-alias)
  - [Point3 (type alias)](#point3-type-alias)
  - [Point4 (type alias)](#point4-type-alias)
  - [Polar (type alias)](#polar-type-alias)
  - [Spherical (type alias)](#spherical-type-alias)

---

# utils

## MutablePoint2 (type alias)

**Signature**

```ts
export type MutablePoint2 = { x: number; y: number }
```

## MutablePoint3 (type alias)

**Signature**

```ts
export type MutablePoint3 = { x: number; y: number; z: number }
```

## MutablePoint4 (type alias)

**Signature**

```ts
export type MutablePoint4 = { x: number; y: number; z: number; w: number }
```

## MutablePolar (type alias)

**Signature**

```ts
export type MutablePolar = { radius: number; phi: number }
```

## MutableSpherical (type alias)

**Signature**

```ts
export type MutableSpherical = { radius: number; phi: number; theta: number }
```

## Point2 (type alias)

**Signature**

```ts
export type Point2 = Readonly<MutablePoint2>
```

## Point3 (type alias)

**Signature**

```ts
export type Point3 = Readonly<MutablePoint3>
```

## Point4 (type alias)

**Signature**

```ts
export type Point4 = Readonly<MutablePoint4>
```

## Polar (type alias)

**Signature**

```ts
export type Polar = Readonly<MutablePolar>
```

## Spherical (type alias)

**Signature**

```ts
export type Spherical = Readonly<MutableSpherical>
```
