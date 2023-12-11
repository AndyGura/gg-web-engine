---
title: core/base/components/physics/i-rigid-body.component.ts
nav_order: 64
parent: Modules
---

## i-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRigidBodyComponent (interface)](#irigidbodycomponent-interface)

---

# utils

## IRigidBodyComponent (interface)

**Signature**

```ts
export interface IRigidBodyComponent<D, R, PW extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>>
  extends IBodyComponent<D, R, PW> {
  linearVelocity: D
  angularVelocity: R | D

  clone(): IRigidBodyComponent<D, R, PW>

  /** clear velocities etc. */
  resetMotion(): void
}
```
