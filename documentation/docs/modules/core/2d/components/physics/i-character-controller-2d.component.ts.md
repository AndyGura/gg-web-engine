---
title: core/2d/components/physics/i-character-controller-2d.component.ts
nav_order: 14
parent: Modules
---

## i-character-controller-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ICharacterController2dComponent (interface)](#icharactercontroller2dcomponent-interface)

---

# utils

## ICharacterController2dComponent (interface)

A capsule-shaped kinematic character controller: a thin, physics-engine-specific "move and
collide" primitive - the 2D counterpart of `ICharacterController3dComponent` (see that
interface's doc for the full rationale, repeated here only where the 2D case differs). Unlike a
plain rigid body it does **not** own any gameplay logic (gravity, jumping, walk/run speed) - that
lives once, backend-agnostically, in `CharacterController2dEntity`, which is the class apps/other
core code should normally use instead of this interface directly.

Implementations must make `move()` fully synchronous: by the time it returns, `position`,
`isGrounded` and `groundNormal` must already reflect the result of that call, with no dependency
on a subsequent `IPhysicsWorld2dComponent.simulate()` call. This is what lets
`CharacterController2dEntity` integrate gravity/jumping itself and get identical behavior
regardless of which physics backend is plugged in, instead of relying on (and diverging on) each
native engine's own character-controller/kinematic-body model - relevant here specifically
because `packages/matter`'s `kinematic_pos`/`kinematic_vel` `BodyType`s have no native matter-js
equivalent at all (they fall back to a plain static body - see `Body2DOptions.kinematic_pos`'s
doc), so this interface's own `move()` is the _only_ way a matter-js-backed character can be
driven at all; there is no shortcut through an ordinary kinematic rigid body for that backend.

`removeFromWorld(world, dispose)` (inherited from `IBodyComponent`/`IWorldComponent` - see their
doc for the general contract) must free this component's own native shape/body/collider handles
when `dispose` is `true`, exactly as `ICharacterController3dComponent`'s doc describes (repeated
there in more detail) - this is load-bearing for `CharacterController2dEntity`'s own crouch/stand
transition too, which swaps this component wholesale for a freshly-created one at a different
`centersDistance` rather than resizing one in place, and relies on `dispose: true` to free the
outgoing capsule's native handles.

**Signature**

```ts
export interface ICharacterController2dComponent<PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends IBodyComponent<Point2, number, PTypeDoc> {
  /** Capsule radius, as given at creation time. */
  readonly radius: number
  /** Distance between the two capsule hemisphere centers, as given at creation time. */
  readonly centersDistance: number
  /** World "up" direction used to tell the floor from walls/ceilings. */
  up: Point2
  /** Whether the capsule is currently resting on the ground (as of the last `move()` call). */
  readonly isGrounded: boolean
  /** The ground's surface normal, if `isGrounded`; `null` otherwise. */
  readonly groundNormal: Point2 | null

  /**
   * Rigid bodies this character's own collision queries (the sweeps/overlap-recovery behind
   * `move()`) must skip entirely - not just "don't collide", genuinely invisible to this character's
   * queries, as if temporarily removed from the world. See
   * `ICharacterController3dComponent.ignoredBodies`'s doc for the full argument for why this exists
   * (`ownCollisionGroups`/`interactWithCollisionGroups` can't express a single-pair exclusion).
   *
   * A plain mutable `Set`, not a getter/setter pair. Implementations must consult this set fresh on
   * every `move()` call - membership can change between ticks. Empty by default (no exclusions).
   */
  readonly ignoredBodies: Set<PTypeDoc['rigidBody']>

  /**
   * Attempts to move the character by exactly this desired displacement, sliding along
   * obstacles, automatically stepping over ledges up to `maxStepHeight`, and snapping to the
   * ground per `snapToGroundDistance` - see `CharacterController2dOptions`. Fully resolves
   * `position`/`isGrounded`/`groundNormal` before returning (see interface doc).
   *
   * `dt`, when given, is the real time (seconds) `desiredTranslation` was computed to cover -
   * `CharacterController2dEntity` always passes it (its own tick delta). It exists purely so an
   * implementation that pushes dynamic bodies (see `CharacterController2dOptions.pushMass`) can
   * recover the character's actual speed (`desiredTranslation` magnitude / `dt`) rather than
   * working from a per-tick distance alone; a mover that doesn't implement pushing is free to
   * ignore it entirely. See `ICharacterController3dComponent.move()`'s doc for why a mover that
   * *does* push must skip the push (rather than misusing the raw per-tick distance as a speed)
   * whenever `dt` isn't available.
   *
   * Calling this before the component has been added to a world (see `addToWorld`) must be a
   * silent no-op rather than throwing, so backend-agnostic caller code behaves identically
   * regardless of which adapter is plugged in.
   */
  move(desiredTranslation: Point2, dt?: number): void

  clone(): ICharacterController2dComponent<PTypeDoc>
}
```
