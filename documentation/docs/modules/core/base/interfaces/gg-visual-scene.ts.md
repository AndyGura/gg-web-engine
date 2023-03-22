---
title: core/base/interfaces/gg-visual-scene.ts
nav_order: 54
parent: Modules
---

## gg-visual-scene overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgVisualScene (interface)](#ggvisualscene-interface)

---

# utils

## GgVisualScene (interface)

**Signature**

```ts
export interface GgVisualScene<D, R> {
  readonly factory: any // type defined in sub-interfaces

  readonly debugPhysicsDrawerClass?: { new (): GgDebugPhysicsDrawer<D, R> }

  init(): Promise<void>

  dispose(): void
}
```
