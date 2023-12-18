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
