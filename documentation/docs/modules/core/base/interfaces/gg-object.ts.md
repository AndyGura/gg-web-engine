---
title: core/base/interfaces/gg-object.ts
nav_order: 55
parent: Modules
---

## gg-object overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgObject (interface)](#ggobject-interface)

---

# utils

## GgObject (interface)

**Signature**

```ts
export interface GgObject<D, R> {
  position: D
  rotation: R
  scale: D

  visible: boolean

  name: string

  isEmpty(): boolean

  popChild(name: string): GgObject<D, R> | null

  getBoundings(): GgBox<D>

  clone(): GgObject<D, R>

  addToWorld(world: GgVisualScene<D, R>): void

  removeFromWorld(world: GgVisualScene<D, R>): void

  dispose(): void
}
```
