---
title: core/base/models/collision-event.ts
nav_order: 123
parent: Modules
---

## collision-event overview

Payload emitted by `IRigidBodyComponent.onCollisionStart` when this body begins touching
another rigid body via a real, physical contact - not a trigger/sensor overlap (see
`ITriggerComponent.onEntityEntered` for that; a trigger has no collision response and never
fires this). Carries enough of the contact to react differently to a light tap versus a hard
crash without re-deriving it from raw physics state - e.g. picking a different impact sound, or
only reacting above some damage threshold.

`RigidBody` is left as its own type parameter (rather than derived from a `PhysicsTypeDocRepo`
directly) so this type can be used both at the dimension-agnostic base interface (where it's the
abstract `IRigidBodyComponent<D, R, PTypeDoc>`) and re-declared at the 2D/3D-concrete interface
level narrowed to `PTypeDoc['rigidBody']` - mirroring how `ITriggerComponent.onEntityEntered` is
narrowed the same way, without this type recursively expanding through its own default type
parameter in the process (which trips TS's structural check on the enclosing `Observable`).

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CollisionEvent (interface)](#collisionevent-interface)

---

# utils

## CollisionEvent (interface)

Payload emitted by `IRigidBodyComponent.onCollisionStart` when this body begins touching
another rigid body via a real, physical contact - not a trigger/sensor overlap (see
`ITriggerComponent.onEntityEntered` for that; a trigger has no collision response and never
fires this). Carries enough of the contact to react differently to a light tap versus a hard
crash without re-deriving it from raw physics state - e.g. picking a different impact sound, or
only reacting above some damage threshold.

`RigidBody` is left as its own type parameter (rather than derived from a `PhysicsTypeDocRepo`
directly) so this type can be used both at the dimension-agnostic base interface (where it's the
abstract `IRigidBodyComponent<D, R, PTypeDoc>`) and re-declared at the 2D/3D-concrete interface
level narrowed to `PTypeDoc['rigidBody']` - mirroring how `ITriggerComponent.onEntityEntered` is
narrowed the same way, without this type recursively expanding through its own default type
parameter in the process (which trips TS's structural check on the enclosing `Observable`).

**Signature**

```ts
export interface CollisionEvent<D, RigidBody = unknown> {
  /** the other body this one just started touching */
  otherBody: RigidBody

  /** world-space point of contact */
  position: D

  /** contact normal at `position`, pointing away from this body towards `otherBody` */
  normal: D

  /**
   * Velocity of `otherBody` relative to this body, sampled at the moment contact began - its
   * magnitude and direction together describe how hard, and from which angle, the hit landed.
   * Exactly when relative to the solver this is sampled (the true pre-collision approach vector,
   * vs. already-post-response velocities) differs per physics adapter, since not every native
   * engine exposes a pre-solve velocity snapshot at the point its own collision-start event fires
   * - don't assume bit-identical magnitudes across two different adapters for what looks like the
   * same hit. What every adapter *does* guarantee: the reciprocal event `otherBody` receives for
   * this same contact carries the exact negation of this `relativeVelocity`, since both sides read
   * the same two bodies' velocities and just subtract them in the opposite order.
   */
  relativeVelocity: D

  /**
   * Approximate magnitude of the collision impulse (kg·m/s). Meaningful for comparing hits
   * against each other within the *same* physics adapter (e.g. thresholding "light" vs "hard"
   * hit sound effects) - the exact figure is derived differently per physics engine (a solved
   * contact impulse on some backends, a contact-force-times-timestep estimate on others), so
   * don't assume the same numeric value means the same thing across two different adapters.
   */
  impulse: number
}
```
