---
title: core/base/components/physics/i-rigid-body.component.ts
nav_order: 66
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
export interface IRigidBodyComponent<D, R, TypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IBodyComponent<D, R, TypeDoc> {
  linearVelocity: D
  angularVelocity: R | D

  clone(): IRigidBodyComponent<D, R, TypeDoc>

  /** clear velocities etc. */
  resetMotion(): void
}
```
