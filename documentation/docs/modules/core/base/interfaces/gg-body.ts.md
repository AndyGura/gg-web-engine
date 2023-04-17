---
title: core/base/interfaces/gg-body.ts
nav_order: 52
parent: Modules
---

## gg-body overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgBody (interface)](#ggbody-interface)

---

# utils

## GgBody (interface)

**Signature**

```ts
export interface GgBody<D, R> {
  position: D
  rotation: R
  scale: D

  name: string

  entity: GgEntity | null

  clone(): GgBody<D, R>

  addToWorld(world: GgPhysicsWorld<D, R>): void

  removeFromWorld(world: GgPhysicsWorld<D, R>): void

  dispose(): void

  /** clear velocities etc. */
  resetMotion(): void
}
```
