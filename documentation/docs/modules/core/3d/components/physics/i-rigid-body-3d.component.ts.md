---
title: core/3d/components/physics/i-rigid-body-3d.component.ts
nav_order: 30
parent: Modules
---

## i-rigid-body-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRigidBody3dComponent (interface)](#irigidbody3dcomponent-interface)

---

# utils

## IRigidBody3dComponent (interface)

**Signature**

```ts
export interface IRigidBody3dComponent<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IRigidBodyComponent<Point3, Point4, PTypeDoc> {
  angularVelocity: Point3

  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody3DSettings
}
```
