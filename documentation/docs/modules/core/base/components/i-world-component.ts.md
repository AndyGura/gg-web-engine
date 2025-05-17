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
export interface IWorldComponent<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>>
  extends IComponent {
  entity: IEntity | null

  addToWorld(world: GgWorld<D, R, TypeDoc>): void

  removeFromWorld(world: GgWorld<D, R, TypeDoc>, dispose?: boolean): void
}
```
