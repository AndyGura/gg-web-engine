---
title: core/base/components/i-world-component.ts
nav_order: 63
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
  VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>,
  PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>
> {
  entity: IEntity | null

  addToWorld(world: GgWorld<D, R, VTypeDoc, PTypeDoc>): void

  removeFromWorld(world: GgWorld<D, R, VTypeDoc, PTypeDoc>, dispose?: boolean): void

  dispose(): void
}
```
