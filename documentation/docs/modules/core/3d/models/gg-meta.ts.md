---
title: core/3d/models/gg-meta.ts
nav_order: 34
parent: Modules
---

## gg-meta overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgCurve (type alias)](#ggcurve-type-alias)
  - [GgDummy (type alias)](#ggdummy-type-alias)
  - [GgMeta (type alias)](#ggmeta-type-alias)
  - [GgRigidBody (type alias)](#ggrigidbody-type-alias)

---

# utils

## GgCurve (type alias)

**Signature**

```ts
export type GgCurve = { name: string; cyclic: boolean; points: Point3[] } & any
```

## GgDummy (type alias)

**Signature**

```ts
export type GgDummy = { name: string; position: Point3; rotation: Point4 } & any
```

## GgMeta (type alias)

**Signature**

```ts
export type GgMeta = {
  dummies: GgDummy[]
  curves: GgCurve[]
  rigidBodies: GgRigidBody[]
}
```

## GgRigidBody (type alias)

**Signature**

```ts
export type GgRigidBody = { name: string; position: Point3; rotation: Point4 } & BodyShape3DDescriptor
```
