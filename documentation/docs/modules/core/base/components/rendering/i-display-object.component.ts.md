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
export interface IDisplayObjectComponent<D, R, TypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, TypeDoc> {
  position: D
  rotation: R
  scale: D

  visible: boolean

  name: string

  isEmpty(): boolean

  popChild(name: string): IDisplayObjectComponent<D, R, TypeDoc> | null

  getBoundings(): GgBox<D>

  clone(): IDisplayObjectComponent<D, R, TypeDoc>

  addToWorld(world: GgWorld<D, R, TypeDoc>): void

  removeFromWorld(world: GgWorld<D, R, TypeDoc>): void
}
```
