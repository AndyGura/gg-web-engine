---
title: core/3d/models/shapes.ts
nav_order: 57
parent: Modules
---

## shapes overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BodyShape3DDescriptor (type alias)](#bodyshape3ddescriptor-type-alias)
  - [Shape3DDescriptor (type alias)](#shape3ddescriptor-type-alias)
  - [Shape3DMeshDescriptor (type alias)](#shape3dmeshdescriptor-type-alias)

---

# utils

## BodyShape3DDescriptor (type alias)

**Signature**

```ts
export type BodyShape3DDescriptor = { shape: Shape3DDescriptor; body: Partial<Body3DOptions> }
```

## Shape3DDescriptor (type alias)

**Signature**

```ts
export type Shape3DDescriptor =
  | { shape: 'PLANE' }
  | { shape: 'BOX'; dimensions: Point3 }
  | { shape: 'CONE' | 'CYLINDER'; radius: number; height: number }
  | { shape: 'CAPSULE'; radius: number; centersDistance: number }
  | { shape: 'SPHERE'; radius: number }
  | { shape: 'COMPOUND'; children: { position?: Point3; rotation?: Point4; shape: Shape3DDescriptor }[] }
  | { shape: 'CONVEX_HULL'; vertices: Point3[] }
  | { shape: 'MESH'; vertices: Point3[]; faces: [number, number, number][] }
```

## Shape3DMeshDescriptor (type alias)

**Signature**

```ts
export type Shape3DMeshDescriptor =
  | { shape: 'PLANE'; dimensions?: Point2; segments?: Point2 }
  | { shape: 'BOX'; dimensions: Point3; segments?: Point3 }
  | { shape: 'CONE' | 'CYLINDER'; radius: number; height: number; radialSegments?: number; heightSegments?: number }
  | { shape: 'CAPSULE'; radius: number; centersDistance: number; capSegments?: number; radialSegments?: number }
  | { shape: 'SPHERE'; radius: number; widthSegments?: number; heightSegments?: number }
  | { shape: 'COMPOUND'; children: { position?: Point3; rotation?: Point4; shape: Shape3DMeshDescriptor }[] }
  | { shape: 'CONVEX_HULL'; vertices: Point3[] }
  | { shape: 'MESH'; vertices: Point3[]; faces: [number, number, number][] }
```
