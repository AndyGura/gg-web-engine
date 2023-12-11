---
title: core/2d/components/physics/i-rigid-body-2d.component.ts
nav_order: 11
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
export interface IRigidBody2dComponent<PW extends IPhysicsWorld2dComponent = IPhysicsWorld2dComponent>
  extends IRigidBodyComponent<Point2, number, PW> {
  angularVelocity: number
}
```
