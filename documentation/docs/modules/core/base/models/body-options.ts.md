---
title: core/base/models/body-options.ts
nav_order: 93
parent: Modules
---

## body-options overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BodyOptions (interface)](#bodyoptions-interface)
  - [CollisionGroup (type alias)](#collisiongroup-type-alias)
  - [DebugBodySettings (class)](#debugbodysettings-class)
  - [DebugBodyType (type alias)](#debugbodytype-type-alias)

---

# utils

## BodyOptions (interface)

**Signature**

```ts
export interface BodyOptions {
  dynamic: boolean
  mass: number
  restitution: number
  friction: number
  ownCollisionGroups: ReadonlyArray<CollisionGroup> | 'all'
  interactWithCollisionGroups: ReadonlyArray<CollisionGroup> | 'all'
}
```

## CollisionGroup (type alias)

**Signature**

```ts
export type CollisionGroup = number
```

## DebugBodySettings (class)

**Signature**

```ts
export declare class DebugBodySettings<S> {
  protected constructor(
    private _type: DebugBodyType,
    private _shape: S,
    private _ignoreTransform: boolean = false,
    private _color: number | undefined = undefined
  )
}
```

## DebugBodyType (type alias)

**Signature**

```ts
export type DebugBodyType =
  | { type: 'RIGID_STATIC' }
  | { type: 'TRIGGER'; activated: () => boolean }
  | { type: 'RIGID_DYNAMIC'; sleeping: () => boolean }
```
