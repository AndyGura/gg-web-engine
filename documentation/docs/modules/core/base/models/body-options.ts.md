---
title: core/base/models/body-options.ts
nav_order: 92
parent: Modules
---

## body-options overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BodyOptions (interface)](#bodyoptions-interface)
  - [CollisionGroup (type alias)](#collisiongroup-type-alias)
  - [DebugBodySettings (type alias)](#debugbodysettings-type-alias)

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
  ownCollisionGroups: CollisionGroup[] | 'all'
  interactWithCollisionGroups: CollisionGroup[] | 'all'
}
```

## CollisionGroup (type alias)

**Signature**

```ts
export type CollisionGroup = number
```

## DebugBodySettings (type alias)

**Signature**

```ts
export type DebugBodySettings = { shape: any; ignoreTransform?: boolean } & (
  | {
      type: 'RIGID_STATIC' | 'TRIGGER'
    }
  | {
      type: 'RIGID_DYNAMIC'
      sleeping: boolean
    }
)
```
