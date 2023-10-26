---
title: core/3d/components/physics/i-physics-world-3d.ts
nav_order: 27
parent: Modules
---

## i-physics-world-3d overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IPhysicsWorld3dComponent (interface)](#iphysicsworld3dcomponent-interface)

---

# utils

## IPhysicsWorld3dComponent (interface)

**Signature**

```ts
export interface IPhysicsWorld3dComponent extends IPhysicsWorldComponent<Point3, Point4> {
  readonly factory: IPhysicsBody3dComponentFactory
  readonly loader: IPhysicsBody3dComponentLoader
}
```
