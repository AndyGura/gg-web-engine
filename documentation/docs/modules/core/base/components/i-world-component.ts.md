---
title: core/base/components/i-world-component.ts
nav_order: 57
parent: Modules
---

## i-world-component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IWorldComponent (interface)](#iworldcomponent-interface)

---

# utils

## IWorldComponent (interface)

**Signature**

```ts
export interface IWorldComponent<
  D,
  R,
  V extends IVisualSceneComponent<D, R> = IVisualSceneComponent<D, R>,
  P extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>
> {
  entity: IEntity | null
  addToWorld(world: GgWorld<D, R, V, P>): void
  removeFromWorld(world: GgWorld<D, R, V, P>, dispose?: boolean): void
  dispose(): void
}
```
