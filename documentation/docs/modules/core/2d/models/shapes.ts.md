---
title: core/2d/models/shapes.ts
nav_order: 46
parent: Modules
---

## shapes overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BodyShape2DDescriptor (type alias)](#bodyshape2ddescriptor-type-alias)
  - [Shape2DDescriptor (type alias)](#shape2ddescriptor-type-alias)

---

# utils

## BodyShape2DDescriptor (type alias)

**Signature**

```ts
export type BodyShape2DDescriptor = { shape: Shape2DDescriptor; body: Partial<Body2DOptions> }
```

## Shape2DDescriptor (type alias)

**Signature**

```ts
export type Shape2DDescriptor = { collisionMargin?: number } & (
  | { shape: 'BOX'; dimensions: Point2 }
  | { shape: 'CIRCLE'; radius: number }
  | { shape: 'CAPSULE'; radius: number; centersDistance: number }
  | { shape: 'CONVEX_HULL'; vertices: Point2[] }
  | { shape: 'POLYGON'; vertices: Point2[] }
  | { shape: 'COMPOUND'; children: { position?: Point2; rotation?: number; shape: Shape2DDescriptor }[] }
)
```
