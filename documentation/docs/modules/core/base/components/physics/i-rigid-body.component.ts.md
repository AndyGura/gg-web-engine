---
title: core/base/components/physics/i-rigid-body.component.ts
nav_order: 61
parent: Modules
---

## i-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRigidBodyComponent (interface)](#irigidbodycomponent-interface)

---

# utils

## IRigidBodyComponent (interface)

**Signature**

```ts
export interface IRigidBodyComponent<D, R, PW extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>>
  extends IWorldComponent<D, R, IVisualSceneComponent<D, R>, PW> {
  entity: IEntity | null

  position: D
  rotation: R

  name: string

  clone(): IRigidBodyComponent<D, R, PW>

  addToWorld(world: GgWorld<D, R, IVisualSceneComponent<D, R>, PW>): void

  removeFromWorld(world: GgWorld<D, R, IVisualSceneComponent<D, R>, PW>): void

  /** clear velocities etc. */
  resetMotion(): void
}
```
