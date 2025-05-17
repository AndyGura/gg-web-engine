---
title: core/2d/components/physics/i-rigid-body-2d.component.ts
nav_order: 12
parent: Modules
---

## i-rigid-body-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRigidBody2dComponent (interface)](#irigidbody2dcomponent-interface)

---

# utils

## IRigidBody2dComponent (interface)

**Signature**

```ts
export interface IRigidBody2dComponent<PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends IRigidBodyComponent<Point2, number, PTypeDoc> {
  angularVelocity: number

  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody2DSettings
}
```
