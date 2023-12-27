---
title: core/3d/components/physics/i-physics-world-3d.component.ts
nav_order: 29
parent: Modules
---

## i-physics-world-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IPhysicsWorld3dComponent (interface)](#iphysicsworld3dcomponent-interface)

---

# utils

## IPhysicsWorld3dComponent (interface)

**Signature**

```ts
export interface IPhysicsWorld3dComponent<TypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IPhysicsWorldComponent<Point3, Point4, TypeDoc> {
  readonly loader: TypeDoc['loader']
}
```
