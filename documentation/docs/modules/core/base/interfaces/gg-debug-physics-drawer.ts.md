---
title: core/base/interfaces/gg-debug-physics-drawer.ts
nav_order: 50
parent: Modules
---

## gg-debug-physics-drawer overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgDebugPhysicsDrawer (interface)](#ggdebugphysicsdrawer-interface)

---

# utils

## GgDebugPhysicsDrawer (interface)

**Signature**

```ts
export interface GgDebugPhysicsDrawer<D, R> extends GgObject<D, R> {
  drawContactPoint(point: D, normal: D, color?: Point3): void

  drawLine(from: D, to: D, color?: Point3): void

  update(): void
}
```
