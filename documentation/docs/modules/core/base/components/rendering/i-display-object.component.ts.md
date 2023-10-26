---
title: core/base/components/rendering/i-display-object.component.ts
nav_order: 63
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
export interface IDisplayObjectComponent<D, R, VS extends IVisualSceneComponent<D, R> = IVisualSceneComponent<D, R>>
  extends IWorldComponent<D, R, VS> {
  position: D
  rotation: R
  scale: D

  visible: boolean

  name: string

  isEmpty(): boolean

  popChild(name: string): IDisplayObjectComponent<D, R, VS> | null

  getBoundings(): GgBox<D>

  clone(): IDisplayObjectComponent<D, R, VS>

  addToWorld(world: GgWorld<D, R, VS>): void

  removeFromWorld(world: GgWorld<D, R, VS>): void
}
```
