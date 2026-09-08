---
title: core/3d/components/physics/i-character-controller-3d.component.ts
nav_order: 32
parent: Modules
---

## i-character-controller-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ICharacterController3dComponent (interface)](#icharactercontroller3dcomponent-interface)

---

# utils

## ICharacterController3dComponent (interface)

A capsule-shaped kinematic character controller: a thin, physics-engine-specific "move and
collide" primitive, parallel to `IRaycastVehicleComponent`. Unlike a raycast vehicle it does
**not** own any gameplay logic (gravity, jumping, walk/run speed) - that lives once, backend-
agnostically, in `CharacterController3dEntity`, which is the class apps/other core code should
normally use instead of this interface directly.

Implementations must make `move()` fully synchronous: by the time it returns, `position`,
`rotation`, `isGrounded` and `groundNormal` must already reflect the result of that call, with
no dependency on a subsequent `IPhysicsWorld3dComponent.simulate()` call. This is what lets
`CharacterController3dEntity` integrate gravity/jumping itself and get identical behavior
regardless of which physics backend is plugged in, instead of relying on (and diverging on) each
native engine's own character-controller gravity/impulse model.

`removeFromWorld(world, dispose)` (inherited from `IBodyComponent`/`IWorldComponent` - see their
doc for the general contract) matters especially here: `CharacterController3dEntity` swaps this
component out wholesale on every crouch/stand transition (`recreateCapsule`), calling
`removeFromWorld(world, true)` on the discarded capsule and then dropping its only reference to
it. An implementation whose `removeFromWorld` ignores `dispose` and only detaches from the
world's own bookkeeping - without also freeing the native capsule shape/ghost object/collider -
leaks one such native object per crouch/stand transition, since nothing else will ever call
`dispose()` on that discarded instance afterwards.

**Signature**

```ts
export interface ICharacterController3dComponent<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IBodyComponent<Point3, Point4, PTypeDoc> {
  /** Capsule radius, as given at creation time. */
  readonly radius: number
  /** Distance between the two capsule hemisphere centers, as given at creation time. */
  readonly centersDistance: number
  /** World "up" direction used to tell the floor from walls/ceilings. */
  up: Point3
  /** Whether the capsule is currently resting on the ground (as of the last `move()` call). */
  readonly isGrounded: boolean
  /** The ground's surface normal, if `isGrounded`; `null` otherwise. */
  readonly groundNormal: Point3 | null

  /**
   * Attempts to move the character by exactly this desired displacement, sliding along
   * obstacles, automatically stepping over ledges up to `maxStepHeight`, and snapping to the
   * ground per `snapToGroundDistance` - see `CharacterController3dOptions`. Fully resolves
   * `position`/`rotation`/`isGrounded`/`groundNormal` before returning (see interface doc).
   *
   * `dt`, when given, is the real time (seconds) `desiredTranslation` was computed to cover -
   * `CharacterController3dEntity` always passes it (its own tick delta). It exists purely so an
   * implementation that pushes dynamic bodies (see `CharacterController3dOptions.pushMass`) can
   * recover the character's actual speed (`desiredTranslation` magnitude / `dt`) rather than
   * working from a per-tick distance alone; a mover that doesn't implement pushing is free to
   * ignore it entirely. A mover that *does* push dynamic bodies must not treat a missing `dt` as
   * license to use `desiredTranslation`'s raw per-tick magnitude as if it were already a speed -
   * that understates push force by roughly a factor of `dt` (a 16ms tick's displacement is ~60x
   * smaller than the equivalent m/s figure), silently, not just imprecisely. Skip the push for that
   * tick instead (a one-time warning is reasonable) whenever `dt` isn't available to compute a real
   * speed from.
   *
   * Calling this before the component has been added to a world (see `addToWorld`) must be a
   * silent no-op rather than throwing, so backend-agnostic caller code behaves identically
   * regardless of which adapter is plugged in.
   */
  move(desiredTranslation: Point3, dt?: number): void

  clone(): ICharacterController3dComponent<PTypeDoc>
}
```
