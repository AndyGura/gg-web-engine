---
title: core/base/interfaces/i-debug-physics-drawer.ts
nav_order: 83
parent: Modules
---

## i-debug-physics-drawer overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IDebugPhysicsDrawer (interface)](#idebugphysicsdrawer-interface)

---

# utils

## IDebugPhysicsDrawer (interface)

**Signature**

```ts
export interface IDebugPhysicsDrawer<D, R, TypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IDisplayObjectComponent<D, R, TypeDoc> {
  drawContactPoint(point: D, normal: D, color?: Point3): void

  drawLine(from: D, to: D, color?: Point3): void

  update(): void
}
```
