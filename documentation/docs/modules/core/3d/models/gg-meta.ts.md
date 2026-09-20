---
title: core/3d/models/gg-meta.ts
nav_order: 76
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
export declare const GG_META_SUPPORTED_FORMAT_VERSION: 2
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
   * `.meta` files exported before that - treated the same as `1` (the format those exports
   * actually wrote), not as "unknown"; see `IPhysicsBody3dComponentLoader.loadFromGgGlb`
   * (`packages/core/src/3d/loaders.ts`) for the one migration this currently needs.
   *
   * Format history:
   * - 1 (or absent): each `rigidBodies[].body` has `dynamic: boolean`.
   * - 2: `dynamic` replaced by `bodyType: 'dynamic' | 'static' | 'kinematic_pos' | 'kinematic_vel'`
   *   (`kinematic_vel` is never actually written by the exporter - Blender has no velocity-driven
   *   authoring concept, only `type`/`kinematic`, which map onto `dynamic`/`static`/`kinematic_pos`
   *   - see `get_body_type` in `exporter.py`).
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
