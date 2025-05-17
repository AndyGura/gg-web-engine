---
title: core/base/components/rendering/i-display-object.component.ts
nav_order: 68
parent: Modules
---

## i-display-object.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IDisplayObjectComponent (interface)](#idisplayobjectcomponent-interface)

---

# utils

## IDisplayObjectComponent (interface)

**Signature**

```ts
export interface IDisplayObjectComponent<D, R, VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>> {
  position: D
  rotation: R
  scale: D

  visible: boolean

  name: string

  isEmpty(): boolean

  popChild(name: string): IDisplayObjectComponent<D, R, VTypeDoc> | null

  getBoundings(): GgBox<D>

  clone(): IDisplayObjectComponent<D, R, VTypeDoc>

  addToWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void

  removeFromWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void
}
```
