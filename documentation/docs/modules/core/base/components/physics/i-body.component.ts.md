---
title: core/base/components/physics/i-body.component.ts
nav_order: 62
parent: Modules
---

## i-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IBodyComponent (interface)](#ibodycomponent-interface)

---

# utils

## IBodyComponent (interface)

**Signature**

```ts
export interface IBodyComponent<D, R, PW extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>>
  extends IWorldComponent<D, R, IVisualSceneComponent<D, R>, PW> {
  entity: IEntity | null

  position: D
  rotation: R

  name: string

  clone(): IBodyComponent<D, R, PW>

  addToWorld(world: GgWorld<D, R, IVisualSceneComponent<D, R>, PW>): void

  removeFromWorld(world: GgWorld<D, R, IVisualSceneComponent<D, R>, PW>): void
}
```
