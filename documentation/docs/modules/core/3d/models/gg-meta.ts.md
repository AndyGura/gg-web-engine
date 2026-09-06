---
title: core/3d/models/gg-meta.ts
nav_order: 62
parent: Modules
---

## gg-meta overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GG_META_SUPPORTED_FORMAT_VERSION](#gg_meta_supported_format_version)
  - [GgCurve (type alias)](#ggcurve-type-alias)
  - [GgDummy (type alias)](#ggdummy-type-alias)
  - [GgMeta (type alias)](#ggmeta-type-alias)
  - [GgRigidBody (type alias)](#ggrigidbody-type-alias)

---

# utils

## GG_META_SUPPORTED_FORMAT_VERSION

Highest `.meta` `formatVersion` this loader understands - see `GgMeta.formatVersion`.

**Signature**

```ts
export declare const GG_META_SUPPORTED_FORMAT_VERSION: 1
```

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
  /**
   * Written by the Blender exporter (`GG_META_FORMAT_VERSION` in
   * `blender-addon/gg_web_engine_exporter/exporter.py`) since it started declaring one. Absent on
   * `.meta` files exported before that, which is fine - the shape hasn't actually changed yet, so
   * there is nothing to migrate; this only matters once a future export starts writing a `.meta`
   * this loader's current version doesn't understand.
   */
  formatVersion?: number
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
