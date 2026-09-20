---
title: core/3d/models/shapes.ts
nav_order: 77
parent: Modules
---

## shapes overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BodyShape3DDescriptor (type alias)](#bodyshape3ddescriptor-type-alias)
  - [CylinderRadius (type alias)](#cylinderradius-type-alias)
  - [Shape3DDescriptor (type alias)](#shape3ddescriptor-type-alias)
  - [Shape3DMeshDescriptor (type alias)](#shape3dmeshdescriptor-type-alias)
  - [getCylinderRadii](#getcylinderradii)

---

# utils

## BodyShape3DDescriptor (type alias)

**Signature**

```ts
export type BodyShape3DDescriptor = { shape: Shape3DDescriptor; body: Partial<Body3DOptions> }
```

## CylinderRadius (type alias)

A cylinder's cross-section radius: either a single `radius` (circular cross-section), or
independent `radiusX`/`radiusY` (elliptical cross-section, with `radiusX` along the local X
axis and `radiusY` along the local Y axis of the cylinder's ground plane). Passing equal
`radiusX`/`radiusY` is equivalent to passing that value as `radius`.

**Signature**

```ts
export type CylinderRadius = { radius: number } | { radiusX: number; radiusY: number }
```

## Shape3DDescriptor (type alias)

**Signature**

```ts
export type Shape3DDescriptor = { collisionMargin?: number } & (
  | { shape: 'PLANE' }
  | { shape: 'BOX'; dimensions: Point3 }
  | { shape: 'CONE'; radius: number; height: number }
  | ({ shape: 'CYLINDER'; height: number } & CylinderRadius)
  | { shape: 'CAPSULE'; radius: number; centersDistance: number }
  | { shape: 'SPHERE'; radius: number }
  | { shape: 'COMPOUND'; children: { position?: Point3; rotation?: Point4; shape: Shape3DDescriptor }[] }
  | { shape: 'CONVEX_HULL'; vertices: Point3[] }
  | { shape: 'MESH'; vertices: Point3[]; faces: [number, number, number][] }
)
```

## Shape3DMeshDescriptor (type alias)

**Signature**

```ts
export type Shape3DMeshDescriptor =
  | { shape: 'PLANE'; dimensions?: Point2; segments?: Point2 }
  | { shape: 'BOX'; dimensions: Point3; segments?: Point3 }
  | { shape: 'CONE'; radius: number; height: number; radialSegments?: number; heightSegments?: number }
  | ({ shape: 'CYLINDER'; height: number; radialSegments?: number; heightSegments?: number } & CylinderRadius)
  | { shape: 'CAPSULE'; radius: number; centersDistance: number; capSegments?: number; radialSegments?: number }
  | { shape: 'SPHERE'; radius: number; widthSegments?: number; heightSegments?: number }
  | { shape: 'COMPOUND'; children: { position?: Point3; rotation?: Point4; shape: Shape3DMeshDescriptor }[] }
  | { shape: 'CONVEX_HULL'; vertices: Point3[] }
  | { shape: 'MESH'; vertices: Point3[]; faces: [number, number, number][] }
```

## getCylinderRadii

Normalizes a {@link CylinderRadius} to explicit `radiusX`/`radiusY`. When `radiusX === radiusY`
(including the plain-`radius` case), every adapter must produce the exact same circular
cylinder it did before this field existed.

**Signature**

```ts
export declare function getCylinderRadii(shape: CylinderRadius): { radiusX: number; radiusY: number }
```
