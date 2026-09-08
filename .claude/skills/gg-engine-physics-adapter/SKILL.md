---
name: gg-engine-physics-adapter
description: Create or modify a physics-engine adapter package for gg-web-engine (packages/ammo, packages/rapier2d, packages/rapier3d, packages/matter, or a new one such as box2d/jolt/planck). Use when the task is to implement core's physics-world interfaces against a specific physics library.
---

# Building a physics adapter package

A physics adapter package makes a third-party physics library satisfy `@gg-web-engine/core`'s 2D
or 3D physics interfaces so it can plug into `Gg2dWorld`/`Gg3dWorld` as `physicsWorld`. Read
`gg-engine-core-development`'s "TypeDocRepo" section first — every type here plugs into that
generic pattern.

## Decide dimensionality first

Implement either the `3d/components/physics/*` interfaces (see `packages/ammo`, `packages/
rapier3d`) or the `2d/components/physics/*` ones (see `packages/matter`, `packages/rapier2d`) from
`packages/core/src`.

## File layout (mirror the closest existing adapter)

```
packages/<lib>/
  src/
    index.ts                            # barrel export
    types.ts                            # concrete PhysicsTypeDocRepo(2D|3D) for this lib
    <lib>-factory.ts                    # implements IPhysicsBody(2d|3d)ComponentFactory
    components/
      <lib>-world.component.ts          # implements IPhysicsWorld(2d|3d)Component
      <lib>-body.component.ts           # optional shared base for rigid body + trigger
                                         #   (transform sync, native-pointer reverse map — see ammo)
      <lib>-rigid-body.component.ts     # implements IRigidBody(2d|3d)Component
      <lib>-trigger.component.ts        # implements ITrigger(2d|3d)Component
      <lib>-raycast-vehicle.component.ts  # 3D only: implements IRaycastVehicleComponent
      <lib>-character-controller.component.ts  # 3D only: implements ICharacterController3dComponent
```

## The TypeDocRepo you must define

```typescript
export type <Lib>PhysicsTypeDocRepo = {
  factory: <Lib>Factory;
  rigidBody: <Lib>RigidBodyComponent;
  trigger: <Lib>TriggerComponent;
  // 3D only:
  raycastVehicle?: <Lib>RaycastVehicleComponent;
  characterController?: <Lib>CharacterControllerComponent;
};
```

## World component — the core of the adapter

`IPhysicsWorldComponent<D, R, PTypeDoc>` requires:

- `readonly factory` — throw a clear "`<Lib>` world not initialized" error from the getter if
  accessed before `init()` completes (see `AmmoWorldComponent.factory`).
- `gravity` — plain `Point2`/`Point3` getter/setter, translated to the native gravity
  representation on write.
- `added$` / `removed$` (RxJS `Subject`) and a `children` array kept in sync by subscribing to your
  own `added$`/`removed$` in the constructor:
  ```typescript
  constructor() {
    this.added$.subscribe(c => this.children.push(c));
    this.removed$.subscribe(c => this.children.splice(this.children.indexOf(c), 1));
  }
  ```
- `mainCollisionGroup` — the default group every body gets.
- `async init()` — do **all** async/native setup here (WASM module loading for Ammo/Rapier,
  world/dispatcher/broadphase/solver construction), not in the constructor. This is where
  `this._factory` and any loader get instantiated.
- `simulate(delta: number)` — `delta` arrives in **milliseconds**; most native engines step in
  seconds, so convert (`delta / 1000`) before calling the native step function.
- `registerCollisionGroup()` / `deregisterCollisionGroup(group)` — maintain a pool of group IDs;
  respect any hard limit the engine imposes (Ammo's bitmask caps at 16 groups — see
  `AmmoWorldComponent.registerCollisionGroup`, which throws once exhausted) and throw a clear error
  on exhaustion rather than silently reusing IDs.
- `raycast(options: RaycastOptions<D>): RaycastResult<D, ...>` — run the native raycast, then
  resolve the native hit handle back to your `rigidBody`/`trigger` component via a reverse map
  (native pointer/handle → component instance), and populate `hitPoint`/`hitNormal`/`hitDistance`.
  Return `{ hasHit: false }` cleanly if the world isn't initialized or nothing was hit.
  `RaycastOptions` only ever supports **group/mask filtering** (`collisionFilterGroups`/
  `collisionFilterMask`, both `CollisionGroup[]` - plain numeric bit-indices, no `'all'` sentinel
  the way `IBodyComponent`'s own group setters have one) - there is no identity-based "exclude this
  exact body" parameter anywhere in the interface, even on engines whose native raycast API does
  support one (confirmed for Rapier: `castRay` accepts `filterExcludeCollider`/
  `filterExcludeRigidBody`, but the wrapper here only ever threads the group bitmask through). Left
  unfiltered, a raycast hits *everything* registered in the world, including the very body that
  issued it if that body happens to sit on/near the ray's own path - this bit a caller two ways
  already, not just adapter code: `AmmoCharacterControllerComponent`'s own internal sweep self-hits
  (see the pitfall further down) and, at the app level, `PlayerCharacterController`'s third-person
  camera raycast starting from a point on the player's own capsule centerline and immediately
  self-hitting at ~0 distance (collapsing the camera onto the character - regression, found live in
  the rapier3d example). The general-purpose fix used at the app level (no interface change) was
  geometric, not group-based: nudge the ray's start point outward past the character's own radius
  along its direction first, then add that offset back onto the reported hit distance - the same
  "start just outside my own shape" trick `CharacterController3dEntity.tryStandUp`'s self-raycast
  already used. Keep this in mind before adding any new raycast call that might originate on or near
  a body already in the world.
- `dispose()` — explicitly destroy every native handle (solver, broadphase, dispatcher, collision
  configuration, the world itself). WASM-backed engines (Ammo, Rapier) do **not** garbage-collect
  native memory automatically — leaving this out leaks.

## Rigid body / trigger components

Both must implement `IPositionable(2d|3d)` (position/rotation proxied to the native body) plus
`IRigidBodyComponent`/`ITriggerComponent`. Shared transform-sync and native-handle bookkeeping
(e.g. a `nativeBodyReverseMap` from native pointer to component instance, used by `raycast`) is
worth factoring into a common base component — see `AmmoBodyComponent` shared by
`AmmoRigidBodyComponent` and `AmmoTriggerComponent`.

**Triggers** are sensor colliders with no collision response that emit enter/exit events; wire the
native engine's collision-event mechanism into an RxJS-based interface matching
`ITriggerComponent`, enabling the native "collision events" flag on the collider at creation time
(see `Rapier2dFactory.createTrigger` calling `colliderDescr.setActiveEvents(ActiveEvents.
COLLISION_EVENTS)`).

## Character controller component (3D only)

`ICharacterController3dComponent` (`packages/core/src/3d/components/physics/i-character-controller-3d.component.ts`)
is a capsule-shaped kinematic "move and collide" primitive, parallel to `IRaycastVehicleComponent`.
Its defining constraint: **`move(desiredTranslation)` must be fully synchronous** — `position`,
`rotation`, `isGrounded` and `groundNormal` must already reflect the result by the time `move()`
returns, with no dependency on a later `IPhysicsWorld3dComponent.simulate()` call. All gravity/jump/
speed integration lives once, backend-agnostically, in core's `CharacterController3dEntity`, which
calls `move()` once per tick with the full desired displacement already computed (including any
vertical/jump/gravity component) — the adapter component must not apply any gravity of its own.

For a WASM/native engine whose usual character-controller pattern is "stage a kinematic move, then
resolve it as part of the next `world.step()`" (Rapier, and likely others), reconcile that with the
synchronous contract like this (see `Rapier3dCharacterControllerComponent`):

- Build the character from an actual kinematic rigid body (`RigidBodyDesc.kinematicPositionBased()`
  or equivalent) with the shape collider attached — reuse the adapter's existing `CAPSULE` mapping
  from `createColliderDescr` rather than duplicating it.
- Inside `move()`, run the engine's own sweep/collision-resolution call (Rapier:
  `KinematicCharacterController.computeColliderMovement` → `computedMovement()`/
  `computedGrounded()`), then apply the resulting position with an **immediate** transform setter
  (Rapier: `RigidBody.setTranslation(next, true)`, not `setNextKinematicTranslation` alone — the
  "next kinematic" family of setters only takes effect once a subsequent `world.step()` integrates
  it, which would violate the synchronous contract). Call both if the engine offers it: the
  immediate setter for correctness right now, and the "next kinematic" one too so dynamic bodies the
  character pushes still get a reasonable velocity estimate whenever the next real `world.step()`
  does run — this is a nice-to-have, not load-bearing.
- After moving the body directly (in `move()`, and in any `position`/`rotation` setter), explicitly
  propagate that change to the collider/broad-phase state the engine's sweep query reads, without
  running a full simulation step. Check the exact API name at the pinned version — see the pitfall
  below for Rapier specifically, since it has changed across releases and easy-to-find example code
  may reference a newer/older name than what's actually pinned.
- Ground normal: most engines' character controllers don't expose a single "the ground normal" —
  only a list of per-obstacle collisions from the last sweep, each with its own contact normal.
  Best-effort approach: scan those collisions for one whose normal points roughly along `up` (i.e. a
  floor, not a wall) and use that; fall back to plain `up` if grounded with no such collision on
  record (e.g. snapped to ground without an explicit sweep hit that tick), or `null` if not grounded.
  Document this as a known limitation rather than chasing exactness. Precision here matters more than
  it might look: `CharacterController3dEntity` re-derives its own "is this actually stable footing"
  decision from `groundNormal` every tick (comparing its angle against `maxSlopeClimbAngleRad` itself,
  regardless of what this component's own `isGrounded` says) and integrates gravity as a **full 3D
  vector** rather than just its component along `up` - so reporting `isGrounded: true` with a
  `groundNormal` steeper than the configured limit doesn't get a character stuck floating in place,
  but it does mean an adapter that reports a wrong-but-walkable-looking normal there will make the
  entity treat a too-steep surface as stable footing instead of sliding off it.
- `up`/`maxStepHeight`+`minStepWidth`/`maxSlopeClimbAngleRad`/`snapToGroundDistance` map directly onto
  whatever setup calls the native controller exposes (Rapier: `setUp`, `enableAutostep(maxHeight,
  minWidth, includeDynamicBodies)`, `setMaxSlopeClimbAngle`, `enableSnapToGround(distance)` — skip
  the autostep/snap-to-ground calls entirely when the corresponding option is `0`/falsy rather than
  passing a zero value through, since "enabled with distance 0" and "disabled" are not obviously the
  same thing to every engine).
- Rotation: verify (don't assume) whether the native engine's sweep test is orientation-sensitive for
  this shape. A capsule aligned with `up` has an identical collision footprint at any yaw, so setting
  the body's own rotation is purely so a debug view / anything reading the native transform directly
  stays in sync with a caller-driven yaw (e.g. camera-driven) — it should have zero effect on
  `move()`'s sweep results. Confirm this holds for the specific engine rather than taking it on faith.
- `children`/`added$`/`removed$` on the world component: this new component is a different class from
  the existing `rigidBody`, so keeping "children stays in sync" (see the World component section
  above) requires widening those three members' element type to a union including the new component
  class — safe to do (see the circular-import note two sections up: rigid body ↔ world component
  already import each other by class for the same reason). Registering the character's native handle
  in the raycast reverse-map (so `world.raycast()` can resolve a hit back to it) is optional scope —
  reasonable to skip and document as a limitation, since it would otherwise force widening that map's
  and `raycast()`'s return-type generics for a corner case outside the interface's actual contract.

### The `removeFromWorld(dispose)` contract

`IWorldComponent.removeFromWorld(world, dispose?)` (`packages/core/src/base/components/i-world-component.ts`,
inherited by every component interface including `ICharacterController3dComponent` via
`IBodyComponent`) documents that `dispose: true` requires the implementation to free any
native/backend resource the component owns (shape, body/ghost-object handle, GPU buffer, ...) as
part of that same call, not merely stop tracking it in `world`. This is exactly what
`CharacterController3dEntity.recreateCapsule` relies on: every crouch/stand transition creates a
brand-new character-controller component at a different `centersDistance` and swaps it in via
`this.removeComponents([old], true)`, dropping its only reference to `old` immediately afterward -
nothing else will ever call `dispose()` on that discarded instance, so if `removeFromWorld` doesn't
honor `dispose` there, the native object leaks on every single crouch/stand transition.

Every `removeFromWorld` override in every adapter (`ammo`, `matter`, `pixi`, `three`, `rapier2d`,
`rapier3d`) now accepts and honors this parameter - the general pattern, used consistently across
all of them: accept `dispose?: boolean`, thread it through to `super.removeFromWorld(world,
dispose)` when the component subclasses another `IWorldComponent`, and at the point where this
component's own native handles are known (usually the base of a class hierarchy, e.g.
`AmmoBodyComponent`/`MatterRigidBodyComponent`/`PixiDisplayObjectComponent`) call `this.dispose()`
when `dispose` is `true`. Concretely, by library family:

- **Ammo** (WASM/Bullet, manual `Ammo.destroy(...)` per allocation): the leak this section
  originally documented was real - `AmmoCharacterControllerComponent.removeFromWorld` only called
  `removeCollisionObject` and never freed the ghost object or its capsule shape. Fixed by having
  `AmmoBodyComponent.removeFromWorld` call `this.dispose()` when `dispose` is `true` (every Ammo
  body/trigger/character-controller subclass already had a working `dispose()` for its own native
  body - it just was never wired to `removeFromWorld`), and by giving
  `AmmoCharacterControllerComponent` its own `dispose()` override that additionally frees
  `nativeShape` (the capsule shape `AmmoBodyComponent.dispose()` alone can't reach, since Bullet
  shapes aren't owned by the collision object referencing them).
  `AmmoRaycastVehicleComponent` had the same class of gap independently:
  `nativeVehicle`/`vehicleTuning`/`raycaster`/`wheelDirectionCS0`/`wheelAxleCS` had no `dispose()`
  at all and were never freed on removal, `dispose` or not - fixed the same way. Its `nativeBody` is
  shared with the `chassisBody` passed into its constructor (same native handle, not a copy); only
  the vehicle's own `removeFromWorld`/`dispose()` frees it - never pass `dispose: true` down into
  `chassisBody.removeFromWorld` too, or the shared handle gets double-freed.
- **Rapier** (`rapier2d`/`rapier3d`, WASM but reference-counted per-call, not manually tracked):
  every rigid-body/trigger/character-controller `removeFromWorld` already unconditionally freed its
  native handles regardless of any flag - `addToWorld` always recreates them fresh from stored
  descriptors, so eager freeing on every removal is both safe and cheap to undo, unlike Ammo's
  handles. These now accept `dispose?: boolean` for interface conformance (and each `dispose()`
  passes `true` through to `removeFromWorld` for self-documentation), but the parameter doesn't
  change behavior. The one genuine bug found here: `Rapier3dRaycastVehicleComponent`'s native
  vehicle controller needs an explicit `.free()` beyond `removeVehicleController`, which - like the
  Ammo raycast vehicle - was never reachable from an ordinary `removeFromWorld` before; fixed by
  calling `this.dispose()` from `removeFromWorld` when `dispose` is `true`.
- **Matter** (pure JS, GC-managed - `matter-js` has no native/WASM handles at all): `removeFromWorld`
  now threads `dispose` through and calls `this.dispose()`, but `MatterRigidBodyComponent.dispose()`
  is intentionally a no-op (nothing to free). `MatterTriggerComponent` is the one real fix: it now
  overrides `dispose()` to complete its `onEnter$`/`onLeft$` RxJS subjects, which previously never
  happened on either path.
- **Pixi/Three** (rendering, not physics, but implement the same `IWorldComponent` base): both
  already had a correct `dispose()` (Pixi: `Application.destroy(...)` / `Container.destroy()`;
  Three: `geometry.dispose()`/`material.dispose()` per mesh, `WebGLRenderer.dispose()`) - the fix
  was purely wiring `removeFromWorld(world, dispose)` to call it, identical to the Ammo pattern.

**A leak that was consciously left alone**: `AmmoRigidBodyComponent`/`AmmoTriggerComponent` never
capture or free their collision shape (`this._nativeBody.getCollisionShape()`) anywhere, including
in `dispose()` - only the character controller's capsule (which owns a private, never-shared shape)
was fixed here, since that was the concretely reported leak. Ammo/Bullet shapes are shareable
across multiple bodies by design, and this package's factory (`ammo-factory.ts`) doesn't currently
track whether a given native shape is exclusively owned by the one body that created it or reused
elsewhere - freeing it unconditionally in `dispose()` risks a use-after-free for a shared shape.
Fixing this properly needs that ownership question answered first; treat it as a known, separate,
unresolved gap rather than assuming `dispose()` on an ordinary Ammo rigid body/trigger is fully leak-free.

### Pitfall: a freshly-created collider is invisible to sweeps/raycasts until the world steps once

Hit implementing `Rapier3dCharacterControllerComponent`: calling `move()` immediately after creating
both the character and its floor/wall geometry (no `world.step()`/`simulate()` ever having run)
always returned the full, uncollided desired translation — the sweep silently found nothing to hit.
This is not specific to character controllers: the exact same thing happens to
`Rapier3dWorldComponent.raycast()` against a same-tick-created collider (confirmed empirically; it's
why the existing raycast tests in `rapier-3d-world.component.spec.ts` all call `world.simulate(1)`
before raycasting). In this pinned `@dimforge/rapier3d-compat` build, a collider's AABB only actually
enters the broad-phase as part of running `World.step()` at least once — there is no
`QueryPipeline`/`updateSceneQueries()`-style "just rebuild the query structure" call exposed on this
version (older Rapier releases and some example code floating around *do* have a separate
`QueryPipeline` object with an `update()`/`updateSceneQueries()` method — that API does not exist on
the version actually pinned here; check `node_modules/@dimforge/rapier3d-compat/dist/pipeline/
world.d.ts` directly rather than trusting an example project's `node_modules`, which may have
resolved a different/newer build under the same version string). The fix used for keeping `move()`
itself synchronous (re-propagating collider transforms after directly setting a kinematic body's
translation) is `World.propagateModifiedBodyPositionsToColliders()` — but that call only re-syncs a
collider's position from its already-registered parent body; it does not newly register a collider
that has never been through a `step()` at all. Practical implication: a level's static geometry (or
the character itself) needs at least one `physicsWorld.simulate()` call — even `simulate(0)`, a
zero-length timestep works fine and moves nothing — sometime after being added and before the first
`move()`/`raycast()` that depends on seeing it; a normal per-frame game loop already satisfies this
after its first tick, so this only bites synthetic same-tick test setups (see the test file for how
to structure a `settleWorld()` no-simulate()-in-between-moves helper around it) or a character
spawned and moved on the very first frame before physics has ever ticked once. The exact same
one-time-registration quirk exists in this package's pinned Ammo.js build too (every existing
`AmmoRaycastVehicleComponent`/`world.raycast()` test already calls `world.simulate(1)` once after
`addToWorld()` for the same reason) — the `settleWorld()` pattern applies equally there.

### Pitfall (Rapier only): *two separate* native features silently cancel a jump - fixing only snap-to-ground isn't enough

Rapier's `KinematicCharacterController` has its own built-in `enableSnapToGround(distance)` (used to
follow slopes/stairs down without briefly going airborne each step - see the option-mapping bullet
above), left enabled unconditionally at construction. It applies inside `computeColliderMovement`
itself, with no notion of "this tick's movement is a deliberate jump takeoff, don't snap it back
down" - a jump's own per-tick rise (`jumpSpeed * dt`) starts out far smaller than the default `0.3`
snap distance, so every jump was silently cancelled the moment it started (visible as: `jump()`
correctly sets internal takeoff velocity, `move()` even receives a `desiredTranslation` with the
right upward component, but the character's height never actually changes tick to tick) - this is
the exact same failure mode documented below for Ammo's own hand-rolled ground-snap fallback, just
triggered by a *native* engine feature instead of adapter-written code, so it's easy to overlook
that the same guard is still needed. Fix: mirror the Ammo adapter's `movingUp` check - at the top of
`move()`, before calling `computeColliderMovement`, check whether `desiredTranslation` has a positive
component along `up`; if so call `disableSnapToGround()` for this call, otherwise
`enableSnapToGround(snapToGroundDistance)` (skip entirely if that option is `0`).

**This alone looked like the whole fix (an open-field jump - nothing to collide with horizontally -
worked perfectly with just this change) but wasn't**: `enableAutostep(maxStepHeight, minStepWidth,
...)`, also left enabled unconditionally, needs the identical guard for a related but distinct
reason, and only misbehaves under a second, easy-to-miss condition - jumping *while simultaneously
blocked horizontally* by something taller than `maxStepHeight` (running at a tall obstacle and
jumping right as you reach it, not jumping in open space, and not jumping stationary somewhere with
nothing in front of you either). Symptom with only the snap-to-ground fix in place: a jump attempted
in the open arced perfectly, but the *identical* jump attempted pressed up against such an obstacle
turned into a small up-then-snap-back-down "flick" - the rise stopping right around `maxStepHeight`
itself (a very recognizable number once you know to look for it) before reverting to standing height,
even though snap-to-ground was already correctly disabled that whole time. Autostep's own "raise up
to `maxStepHeight`, retry the blocked horizontal move, keep the raise only if that retry actually
clears" evaluation runs as part of the very same `computeColliderMovement` call that's also carrying
the jump's vertical component - when the retry still doesn't clear (the obstacle is taller than the
autostep raise), whatever it does to "give back" the failed step attempt isn't scoped to only the
horizontal axis, so it cancels the deliberate vertical rise sharing that same call too. There's no
real reason to want auto-step-climbing active while already deliberately jumping regardless, so
disable it under the exact same `movingUp` condition as snap-to-ground (both toggle together, one
`if`/`else`). Toggling both every call this way is cheap and keeps normal stair-climbing/downhill-
snap behavior intact for every tick that isn't actively rising.

The practical lesson for testing a fix like this: **a jump that works perfectly in open space is not
sufficient evidence the fix is complete** - specifically test jumping while pressed against/blocked by
a tall obstacle too (this repo's own `player-character-three-ammo`/`-rapier3d` demo scene ships a
`JumpBarrier` purpose-built for exactly this), since that's the condition that exposes a second native
feature interacting with the same code path that an open-field test can't reach at all. Also test the
*realistic* version of that scenario (running at the obstacle from a normal approach distance and
timing the jump to clear it, matching how a player actually plays) rather than only the exaggerated
"standing already pressed flush against it" version - the latter is useful for finding the bug (it
reproduces most reliably) but can also surface a narrower, expected-ish artifact of its own
unrealistic starting condition (e.g. the character's own capsule silhouette brushing the obstacle's
top corner while rising, if it's rising from a position already overlapping/touching the obstacle) that
isn't the actual bug and isn't what a real player would ever trigger - don't chase that part further
once the realistic approach-and-clear scenario is confirmed working end-to-end.

### Pitfall (Rapier only): the native dynamic-body-push feature is unusable on a kinematic character body - it explodes, not just mis-scales

Rapier's `KinematicCharacterController` has a built-in, seemingly ideal equivalent of `pushMass`:
`setApplyImpulsesToDynamicBodies(true)` + `setCharacterMass(mass)`, computing a momentum-aware
impulse against dynamic bodies hit during `computeColliderMovement` - no hand-rolled push logic
needed, unlike Ammo's ghost-based mover (which has no native equivalent at all - see
`pushDynamicBody` further down). It looks like the obvious, correct way to implement `pushMass`
support for this adapter. **Do not use it as-is on a `kinematicPositionBased()` character body**:
confirmed empirically, enabling it here doesn't just get the mass scaling backwards (a *heavier* box
ending up moving *further* than a lighter one at otherwise identical settings) - it genuinely
explodes. A pushed box's position jumped by 5+ meters in a single 16ms tick and kept climbing
indefinitely, tick after tick, never settling - not a one-off spike, a runaway. Root cause not fully
isolated from JS (plausibly `setCharacterMass`'s override interacting badly with this body's own
`mass()`, which a kinematic body reports as `0`, somewhere inside Rapier's impulse resolution - this
package's pinned `@dimforge/rapier3d-compat` build doesn't expose enough of that internal state to
debug further); ruled out as an ordering/setup mistake on this side by testing several variations
(toggling the character's own collider between sensor/non-sensor made no measurable difference to
either the explosion or the mis-scaling, so it isn't a "native kinematic-vs-dynamic collision
response double-counting with the impulse feature" issue either, or at least not solely that).
**Fix used**: don't call either method at all; implement `pushMass` by hand instead, mirroring
`AmmoCharacterControllerComponent.pushDynamicBody`'s formula and contract exactly (same inelastic-
collision-against-a-virtual-mass model, same `pushMass <= 0` "disable pushing" convention, only ever
*adding* velocity along the push direction). The one native piece still worth keeping:
`computeColliderMovement` already populates `numComputedCollisions()`/`computedCollision(i)` on every
`move()` call regardless of whether the impulse feature is enabled, so the hand-rolled version needs
no extra sweep/query of its own to find out what got hit - see `Rapier3dCharacterControllerComponent
.pushDynamicBodies` for the full implementation. This residual gap is worth knowing about for anyone
tempted to revisit it later: even with the hand-rolled push in place, a mid-mass box occasionally
reads a *bit* faster than the plain formula predicts and visibly tips up onto an edge/corner instead
of staying flat (the light and heavy ends of the mass range track the formula closely) - a secondary,
non-explosive effect, most likely genuine box-tipping physics from the push contact point not being
centered, not a repeat of the impulse-feature bug; not chased further since it doesn't reach anywhere
near the older bug's severity and the core "pushing works, mass roughly matters" behavior holds.

### Pitfall (Ammo only): `btKinematicCharacterController` produced zero collision response in this build

Implementing `AmmoCharacterControllerComponent`, the "obvious" approach — a `btPairCachingGhostObject`
+ capsule shape driven by Bullet's own `btKinematicCharacterController` via `setWalkDirection()` then
directly calling `preStep(collisionWorld)`/`playerStep(collisionWorld, dt)` (never `world.addAction`/
`stepSimulation`, to keep `move()` synchronous — same reasoning as the Rapier section above) —
compiled and ran, but produced **no collision response at all**, for both vertical (falling through a
static floor) and horizontal (walking straight through a wall) motion, verified empirically with a
minimal standalone repro against this package's actual pinned Ammo.js WASM build. `controller.
onGround()` also reported stale/incorrect state throughout (`true` immediately at construction, in
mid-air, before any `preStep` ever ran). The ghost object's own `getNumOverlappingObjects()` stayed
at `0` before and after `preStep` in every case, suggesting the class's internals depend on its
`btGhostObject` overlapping-pairs cache (populated by broadphase pair maintenance, which nothing here
ever triggers, matching the "no `world.addAction`" design) even though its main step logic is
documented/believed to use `btCollisionWorld::convexSweepTest` — a **direct** `convexSweepTest` call
against the identical shape/world/transforms, by contrast, correctly detected the same floor/wall
every time. Root cause not fully isolated (plausibly that dependency, or a build-specific issue with
this class in the vendored WASM binary) — not worth chasing further given a working alternative
exists.

**Fix used**: drop `btKinematicCharacterController` entirely and implement the mover directly as a
sequence of `btCollisionWorld.convexSweepTest` calls (`AmmoCharacterControllerComponent`'s `sweep()`
helper — construct `btTransform` from/to, a `ClosestConvexResultCallback` with the character's own
`_ownCGsMask`/`_interactWithCGsMask` copied onto `set_m_collisionFilterGroup`/`set_m_collisionFilterMask`,
read `hasHit()`/`get_m_closestHitFraction()`/`get_m_hitNormalWorld()`, destroy all three Ammo objects
after). Movement is split into a horizontal sweep (with one step-up-and-retry pass for ledges up to
`maxStepHeight`, and one slide bounce along the hit plane's tangent when blocked) and a vertical sweep
(gravity/jump, also used to detect ground), plus a fallback downward raycast (via the existing
`IPhysicsWorld3dComponent.raycast()`, which already works reliably) approximating `snapToGroundDistance`
for a stationary/near-ground character with no explicit vertical input that tick. The ghost object is
still created and added to the collision world — it's just a transform/collision-object identity now,
not driven by the removed class. A `btPairCachingGhostObject` is not actually required for this
approach (a plain `btGhostObject` would do), but there's no reason to change it once a
`btPairCachingGhostObject` is already in hand.

**Pitfall inside that fix**: `convexSweepTest`'s `allowedCcdPenetration` parameter (passed as this
component's `offset`/skin value) lets the capsule end up resting *already slightly inside* whatever it
swept into — by exactly that amount (e.g. a resting `z` of `0.89` instead of the geometrically exact
`0.9` for a `0.01` offset). A ground-snap raycast whose `from` point is derived from that
already-slightly-penetrating position (even nudged up by only the same skin amount) starts *inside*
the floor's collision shape — and a ray that begins inside a shape does not register an entry hit
against it, so the snap silently always missed (character correctly fell/settled once via the main
vertical sweep, then immediately read back `isGrounded: false` on the very next horizontal-only move,
since nothing re-derives groundedness from a stale sweep result). Fix: start the snap ray comfortably
above the theoretical resting bottom (`max(skin * 4, 0.02)`, not just `skin`) — enough margin to clear
the sweep's own allowed penetration in the worst case — before sweeping down through
`snapToGroundDistance`.

**Pitfall: an unconditional ground-snap fallback silently cancels every jump.** If `move()` falls
back to an extra downward ray/sweep whenever the main vertical sweep didn't already confirm grounded
(e.g. because the vertical component this tick was zero, or too small to register a floor hit), that
fallback must skip entirely whenever the desired vertical component is **upward** (jumping/rising) —
otherwise it pulls the character straight back down to the floor it just launched from, since a jump's
first tick or two moves it only a few centimeters up, well within any reasonable snap distance. Found
exactly this way: `jump()` visibly set the right internal state and the very first `move()` afterward
even integrated gravity correctly, but the character's height never changed frame to frame at all —
the snap fallback was undoing the small rise every single tick before it could accumulate. Fix: gate
the fallback on `dot(desiredVertical, up) <= 0` (falling or stationary), never when moving away from
the ground.

**Pitfall (more severe, found after the above): `convexSweepTest` has no built-in "don't hit me"
concept, and a character sweeping its own shape self-collides.** Unlike `btKinematicCharacterController`
(which excludes its own ghost object from its internal sweeps by identity, via a callback subclass
`needsCollision` override that JS can't replicate against the embind-exposed `ClosestConvexResultCallback`),
a hand-rolled `collisionWorld.convexSweepTest(shape, from, to, callback, ...)` happily reports the
character's **own** collider as the closest hit — a resting capsule always geometrically overlaps its
own ghost object's collider, by definition, at the sweep's `from` transform. Symptom was severe and
easy to misdiagnose as something else entirely: ordinary WASD movement on a completely flat, empty
floor (no walls, no other bodies at all) was capped to a small, *direction-dependent* fraction of the
intended speed (e.g. one strafe direction covering roughly half the expected distance while the exact
opposite direction was unaffected) — the self-hit's reported fraction/normal are essentially
floating-point noise from the exact geometry of the self-overlap, so different sweep directions "lose"
by different, inconsistent amounts. Do not try to fix this by filtering the hit normal (e.g.
"discard hits whose normal looks floor-like/walkable") — that was tried first and made things worse in
a different way: it also discards genuine ledge/step-corner hits whose blended normal (from sweeping
into a box's edge, not a clean face) happens to fall within the walkable-slope threshold, silently
letting the character glide through a real step instead of climbing it. The actual fix: exclude the
character's own collision object from the collision world for the duration of each sweep call —
`collisionWorld.removeCollisionObject(this.nativeBody)`, run `convexSweepTest`, then
`collisionWorld.addCollisionObject(this.nativeBody, ownMask, interactMask)` in a `finally` block. This
is the one case where filtering by collision group/mask isn't a viable alternative either: a
character's own group is generally not exclusive to it (it commonly shares the default/main group with
ordinary static geometry like the floor itself), so masking the query to exclude "my own group" would
also hide real obstacles that happen to share it, not just self. When implementing a from-scratch sweep-
based mover (here or for any future adapter that ends up needing the same approach because its engine's
native character controller turns out unusable — see the note on `btKinematicCharacterController`
itself further up), write an end-to-end test that drives continuous movement in **all four
horizontal directions** (not just one) over a plain floor with nothing else in the scene, asserting each
covers the same, undiminished distance — a single-direction test is exactly the kind of test that keeps
this bug hidden (it happened to still look correct in the direction that was tested first).

**Pitfall (most severe of all: silent, permanent tunneling through geometry, not just a jitter):
`convexSweepTest` finds nothing once this character's shape is even slightly embedded in a body,
forever after.** `convexSweepTest` is a conservative-advancement/GJK-based cast, which can only
compute a time-of-impact when it *starts* outside the target - a well-documented Bullet limitation,
not a bug specific to this package. The moment this character's shape ends up penetrating another
body by even a hair - from ordinary `allowedCcdPenetration`/skin tolerance on a settle, or a
per-tick step distance simply overshooting the exact contact point - **every subsequent
`convexSweepTest` against that specific body silently returns no hit at all, from any position, in
any direction, permanently** (not a one-tick glitch: this is a standing blind spot to that body
until the character moves away and back). Symptom that made this hard to trace: walking toward a
low overhead beam correctly slowed the character down tick over tick as it approached (a legitimate,
not-yet-penetrating sweep hit each time) - then, the instant it got close enough to end up a hair
inside the beam, the very next `move()` found nothing there at all and the character sailed straight
through, at full speed, with zero further resistance. A test that only checks "is progress blocked
while approaching" (e.g. `is slowed/stopped when walking directly into a wall` in this package's own
suite) cannot catch this - it only shows up as a **failure to still be blocked after having already
made contact**; write the regression test as "walk *through* the obstacle's full footprint" and
assert final position never got picked up.

**Fix**: run a `recoverFromPenetration` step at the very top of `move()`, before any sweep, using
Bullet's discrete `btCollisionWorld.contactTest(collisionObject, resultCallback)` (a same-instant
overlap query, unaffected by the sweep's start-outside limitation since it isn't a cast at all) to
find the deepest current penetration and push the character back out along its normal before
proceeding - the same "recover from penetration" step `btKinematicCharacterController` runs
internally (and the reason this class needs its own copy, having dropped that class - see above).
Two more embind quirks specific to wiring this up in Ammo.js, found empirically, neither documented
in `ammo-ambient.d.ts`:
- `ConcreteContactResultCallback`/`RayResultCallback`-style "JS-overridable" classes require the
  override to be an **own property of the instance**, not a prototype method - `class X extends
  Ammo.ConcreteContactResultCallback { addSingleResult() {...} }` fails at the very first call with
  `"a JSImplementation must implement all functions, you forgot
  ConcreteContactResultCallback::addSingleResult"`, even though the method is right there, because
  the generated glue checks `instance.hasOwnProperty('addSingleResult')` and an ES6 class method
  lives on the prototype, not the instance. Fix: `const cb = new
  Ammo.ConcreteContactResultCallback(); cb.addSingleResult = function(...) {...};` (plain assignment
  after construction, not a subclass).
- Every object parameter a callback like this receives (`cp: btManifoldPoint`,
  `colObj0Wrap/colObj1Wrap: btCollisionObjectWrapper`) arrives as a **raw numeric handle**, not a
  wrapped instance, despite what the ambient types say - call the undeclared-but-present
  `Ammo.wrapPointer(ptr, Ammo.ClassName)` on each one before using any of its methods, or every
  method call throws `TypeError: ... is not a function`.
- `m_normalWorldOnB` always points from collision object B towards object A - which of the pair is
  "this character" depends on Bullet's own internal ordering of the two bodies for that pair, not
  call order, so compare `Ammo.getPointer(wrap0.getCollisionObject())` against
  `Ammo.getPointer(this.nativeBody)` to orient the push-out direction correctly instead of assuming
  a fixed side.
- Wrap the `contactTest` call in the same remove-self/`try`/re-add-self-in-`finally` pattern as
  `sweep()` above, for the same self-collision reason.

**Pitfall: a step-up assist that only checks "did this clear more horizontal distance" will
incrementally climb any smooth, tall, non-walkable obstacle it's pressed against.** A step-up-and-
retry pass (see the fix above) accepts stepping up whenever the retried horizontal sweep at the
raised height clears strictly more distance than staying flat. That comparison alone is not enough:
sweeping a capsule's rounded profile against a curved or perfectly vertical surface (a cylinder, a
sphere) can yield a *slightly* larger clearance fraction a few centimeters higher up for reasons
that have nothing to do with there being a step there - pure curvature/contact-point drift. Accepting
the step on that basis alone means every tick spent walking along such a surface nudges the character
up by a small fraction of `maxStepHeight`, compounding into visibly "climbing" a wall that is, by
construction, unclimbable (found by walking the character along a tall vertical cylinder in the
example scene - it slowly walked right up the side). Fix: after tentatively raising and re-sweeping
horizontally, also sweep straight back down by the raised amount from the new position and require
that settle-down actually lands on a normal within `maxSlopeClimbAngleRad` of `up` (reuse the same
`isWalkableNormal` helper used for grounding) before committing to the step at all; otherwise fall
back to the ordinary flat-sweep-and-slide result as if no step had been attempted.

**Pitfall: a vertical-only sweep with no slide-along-tangent leaves a character stuck jittering
against a too-steep slope instead of sliding down it.** The horizontal movement leg already slides
the remaining blocked distance along the hit surface's tangent when obstructed (see the self-
collision pitfall above); the vertical leg (gravity/jump/falling) originally did not - it just
stopped dead at whatever fraction the sweep allowed. Combined with `CharacterController3dEntity`
correctly refusing to treat a too-steep contact as "resting" (see its `isWalkableGround`, which keeps
integrating gravity in that case instead of zeroing it), the two together should make a character
slide off a steep slope under gravity - but without a slide step on the vertical leg too, the
character just gets re-blocked at (almost) the same point every tick, never actually going anywhere.
Fix: mirror the horizontal leg's slide logic on the vertical leg too - whenever the vertical sweep
hits something that isn't a walkable floor, project the remaining vertical distance onto the plane
perpendicular to the hit normal and sweep that as a second pass, same as an obstacle-blocked
horizontal move already does.

**Pitfall (Ammo only): a ghost-object character controller's native Bullet contact response "pushes"
dynamic bodies, but is mass-blind and never spins them - it must be disabled, not built on.** A
kinematic character built as a `btPairCachingGhostObject` (see the note above on why
`btKinematicCharacterController` itself is unusable here) is never added via `addRigidBody`, so it's
never actually integrated by the constraint solver - but `performDiscreteCollisionDetection` still
generates manifolds between it and any dynamic body it overlaps during `stepSimulation`, and the
solver still processes those manifolds: `btRigidBody::upcast()` on a non-rigid-body collision object
returns null, so the solver falls back to treating that side of the manifold as a fixed/immovable
body. The resulting correction lands entirely on the dynamic body, but since it's driven by the
manifold's penetration depth and Bullet's own Baumgarte/split-impulse recovery-speed cap - not by any
real momentum transfer from the "immovable" side - it comes out at *roughly the same magnitude
regardless of the dynamic body's own mass*, and carries no friction/tangential component (so it never
spins a pushed sphere). Confirmed empirically (`player-character-three-ammo`, added while building
`pushDynamicBody`): a light and a heavy dynamic box both got shoved at effectively the same ~0.8 m/s
by an identical walk-into, even with a hand-rolled, explicitly mass-aware push additionally disabled -
i.e. this native response was the actual (mass-blind, non-rotating) source of "pushing" the whole
time, silently drowning out anything a mass-aware push tries to add on top. Fix: set
`CF_NO_CONTACT_RESPONSE` (4) alongside `CF_CHARACTER_OBJECT` (16) on the ghost object's collision
flags at construction (`ghostObject.setCollisionFlags(CF_CHARACTER_OBJECT | CF_NO_CONTACT_RESPONSE)`)
so Bullet's own dynamics never generates a response for it at all, then implement pushing entirely by
hand as its own step: reuse the hit info an existing horizontal sweep already produces (extend the
sweep helper's result type with the hit `Ammo.getPointer()`, look it up in
`AmmoBodyComponent.nativeBodyReverseMap` to recover the wrapping component), model the contact as a
simple inelastic collision against a virtual character mass (`bodySpeedAlongPush = characterSpeed *
pushMass / (pushMass + bodyMass)`, only ever *adding* velocity along the push direction, never
subtracting) - set linear velocity only, no shape-specific handling needed. Computing `characterSpeed`
itself needs real `desiredTranslation / dt`, not the raw per-tick translation distance alone (which is
off by a factor of the tick's own timestep) - `ICharacterController3dComponent.move()` takes an
optional trailing `dt` argument for exactly this, which `CharacterController3dEntity` always passes
(its own tick delta); a backend that doesn't push dynamic bodies is free to ignore the parameter
entirely. A backend that *does* push dynamic bodies, however, must not fall back to treating the raw
per-tick distance as if it were already a speed when a caller omits `dt` (found live in both
`AmmoCharacterControllerComponent` and `Rapier3dCharacterControllerComponent`, which had copy-pasted
the identical fallback: `dt && dt > 1e-9 ? len / dt : len`) - `CharacterController3dEntity` always
passes `dt`, so this only bites a caller going through `ICharacterController3dComponent` directly
without it, but when it does, it silently understates push force by roughly a factor of `dt` (a 16ms
tick's displacement is ~60x smaller than the equivalent m/s figure) rather than erroring or visibly
misbehaving, which is exactly the kind of wrong-but-plausible-looking physics that goes unnoticed.
Fix: skip the push for that tick entirely when `dt` is missing/non-positive, guarded by a one-time
`console.warn` (module-level flag, not per-instance, so a scene with several such characters logs
once total) rather than per-tick spam.

**Related pitfall (Ammo only, easy to misdiagnose as "friction can't induce rotation" - it can): a
pushed sphere given pure linear velocity looked like it would never start rolling on its own, but the
real cause was `m_rollingFriction` being set equal to sliding friction, not any inability to generate
spin from sliding contact.** First measured while chasing the pitfall above: giving a resting sphere
pure linear velocity and letting it slide across a static floor for dozens of ticks decelerated it as
expected, but its angular velocity never left exactly zero the whole time - which looks exactly like
"this Bullet build's contact solver just doesn't generate the friction torque that would spin a
sliding sphere up into rolling." The actual cause was `AmmoFactory.createRigidBodyFromShape` calling
`environmentBodyCI.set_m_rollingFriction(options.friction)` - reusing the *sliding*-friction value
(0.5 by default, via `defaultBodyOptions`) as *rolling* friction too, a physically distinct and
normally much smaller quantity (real-world rolling-resistance coefficients run roughly two orders of
magnitude below typical sliding-friction ones; Bullet's own construction-info default is `0`, i.e. no
rolling resistance at all). At `rollingFriction: 0.5`, the same manifold's rolling-friction constraint
damped any spin the sliding-friction contact *did* generate back out within the same solver step it
was generated in, before anything outside the solver ever read a nonzero value - so it wasn't that the
inducing torque was missing, it was being cancelled in the same step it appeared. Confirmed by
isolating the two: reverting sliding friction back to its old value while leaving `rollingFriction` at
a small fixed default (decoupled from `options.friction` entirely) was enough on its own to restore
natural slide-to-roll spin-up - no sliding-friction change needed. This means a project that first
"fixes" the symptom by manually setting a pushed sphere's angular velocity to the
rolling-without-slipping value (`ω = (speed / radius) · (up × pushDirection)`, the `ω` that makes the
contact point's velocity `v_com + ω × (-radius·up)` exactly zero) is treating the wrong layer - once
`m_rollingFriction` is fixed at the factory level, that per-push workaround becomes redundant (rolling
now emerges from ordinary floor contact, the same way it would for any other shape/interaction, not
just a character's push) and should be removed rather than layered on top; a workaround like this is
also easy to get backwards on the *sign* of `ω` (an earlier version of it used `direction × up`, which
Bullet's own naturally-induced spin - the actual ground truth once compared - showed to be exactly
opposite: `up × direction`), one more reason to prefer removing it over trying to keep it "correct"
once it's no longer needed for anything. Picking the actual *magnitude* for that small rolling-friction
default matters too, not just getting it away from `options.friction` - too small (an initial `0.02`)
undershoots badly, giving a pushed sphere 8+ *simulated* seconds to coast to a stop (bounces off
several walls in a room-sized space first, reading as "never stops" even though it technically does
eventually); this repo settled on `0.05` after measuring stop time across a spread of values by giving
a resting sphere realistic rolling-without-slipping velocity and counting simulated ticks to rest.

**Related pitfall (Ammo only): fixing `m_rollingFriction` above still leaves a sphere spinning about
the contact-normal axis (a "top" spin, not a "rolling" spin) undamped *forever*, not just slowly -
`m_rollingFriction` and sliding friction only ever touch spin about axes *tangent* to the contact
normal.** A sphere's contact point velocity is `ω × r_contact` (`r_contact` pointing from center to
the single contact point, i.e. straight down for a sphere on flat ground) - this is exactly zero
whenever `ω` is parallel to `r_contact`, i.e. spin purely about the vertical/contact-normal axis, no
matter how fast that spin is. Neither sliding friction nor `m_rollingFriction` (which only opposes the
kind of spin that couples to translation via the rolling condition) generates any torque against that
axis, since there's no relative sliding at the contact point to oppose. Confirmed empirically: a sphere
given *only* vertical-axis angular velocity (zero linear velocity, zero other-axis spin) held that
exact spin speed, completely undiminished, for 12+ simulated seconds with the `m_rollingFriction` fix
above already in place - not a slow decay, no decay at all. A straight-on push (character running
directly behind a body) only ever imparts rolling-axis spin, which is why this can go unnoticed for a
while, but any off-center/glancing contact (brushing something at an angle, a wall bounce that isn't
perfectly square) puts some spin on the vertical axis too, which would otherwise persist literally
forever once everything else has settled. Bullet models resistance to *this* axis as a third, separate
quantity, `m_spinningFriction` - unlike `m_rollingFriction`, `btRigidBodyConstructionInfo` has no field
for it at all, so it can't be set via the construction-info object during body construction; it's only
ever settable on the already-constructed `btRigidBody` itself, via `nativeBody.setSpinningFriction(x)`
(`AmmoFactory.createRigidBodyFromShape` calls this right after `new Ammo.btRigidBody(...)`, before
wrapping it in `AmmoRigidBodyComponent`). Reuses the same `0.05` magnitude as `m_rollingFriction` -
both are "resistance to spin" quantities of the same physical character, just about different axes.

## Factory — shape and body-options mapping

`IPhysicsBody(2d|3d)ComponentFactory.createRigidBody(descriptor, transform?)` and `createTrigger
(descriptor, transform?)` are the two required methods. The canonical mapping pattern (see
`Rapier2dFactory`):

1. `createColliderDescr(shapeDescriptor)` — `switch` over the shape discriminant
   (`Shape2DDescriptor`: `SQUARE`/`CIRCLE`; `Shape3DDescriptor`: `PLANE`/`BOX`/`CONE`/`CYLINDER`/
   `CAPSULE`/`SPHERE`/`COMPOUND`/`CONVEX_HULL`/`MESH` — see `packages/core/src/{2d,3d}/models/
   shapes.ts`) and build the native collider shape(s). Throw
   `Shape "<x>" not implemented for <Lib>` for anything unsupported instead of guessing.
2. `createRigidBodyDescr(bodyOptions, transform?)` — map `Partial<Body(2D|3D)Options>` (`mass`,
   `dynamic`, friction, restitution, collision groups — see `packages/core/src/base/models/
   body-options.ts`) onto the native rigid-body descriptor; a body is static/fixed when
   `dynamic === false` or `mass` is falsy, dynamic otherwise.
3. Merge in engine-reasonable defaults (e.g. `friction: 0.5, restitution: 0.1,
   ownCollisionGroups: [world.mainCollisionGroup], interactWithCollisionGroups:
   [world.mainCollisionGroup]`) before applying the caller's overrides, so bodies work out of the
   box without every caller specifying materials.

## Collision groups implementation detail

Groups are exposed to callers as opaque small integers (`CollisionGroup`) but must be packed into
whatever bitmask/group-and-mask representation the native engine uses — see `BitMask.pack` in
`packages/core/src/base/data-structures/bitmask.ts`, used by `AmmoWorldComponent.raycast` to build
`collisionFilterGroup`/`collisionFilterMask` from an array of `CollisionGroup`s.

## package.json conventions

Copy `packages/rapier2d/package.json` or `packages/matter/package.json` as a template:

- `name`: `@gg-web-engine/<lib>`, version kept in lockstep with `@gg-web-engine/core`.
- The native physics library goes in **both** `devDependencies` and `peerDependencies`, pinned to
  an exact version/build (e.g. `@dimforge/rapier3d-compat` is pinned to a specific compat build
  hash, matching what `rapier2d` uses for the 2D counterpart — keep sibling packages' native
  dependency versions aligned when they share an upstream project).
- Scripts: `"build": "tsc"` (or `"rm -rf ./dist/ && tsc"` if the lib ships non-JS assets to copy,
  as `ammo` does with its `ammo.js` WASM glue), `"test": "jest"`, `"prepublish"` cleaning `dist/`
  first.
- `tsconfig.json`: copy an existing adapter's (e.g. `packages/rapier2d/tsconfig.json`) rather than
  writing one from scratch — it must set `baseUrl`/`outDir`/`rootDir` all to `./src/`/`./dist/` and
  `tsBuildInfoFile: "./dist/tsconfig.tsbuildinfo"` explicitly (composite-project build orchestration
  is on repo-wide via `tsconfig.base.json`; leaving these to their defaults silently nests emitted
  output under a stray `dist/src/`, or drops `dist/index.js` entirely — see
  `gg-engine-core-development`'s local dev section for why), and `"references": [{ "path":
  "../core" }]` so root `npm run build:watch` (`tsc -b --watch`) picks up your package.

## Testing — write real tests, not mocks, against the native engine

Unlike rendering adapters, physics adapters in this repo **do** get jest test suites, because the
logic (shape/body-option mapping, collision groups, gravity, triggers) is meaningfully testable
against the real native engine headlessly. Mirror `packages/rapier2d/test/components/` or
`packages/matter/test/components/`:

- `<lib>-world.component.spec.ts` — init, simulate, gravity get/set, collision group
  register/deregister/exhaustion.
- `<lib>-trigger.component.spec.ts` — trigger creation and enter/exit event emission.
- For a 3D adapter that implements `IRaycastVehicleComponent`, also add
  `<lib>-raycast-vehicle.component.spec.ts` (see `packages/ammo/test/components/`): a basic
  vehicle-settles-on-a-floor sanity test, plus a collision-group regression test that spawns two
  vehicles with different collision groups over two stacked floors sharing those same two groups
  and simulates gravity — each vehicle must fall through the floor with the *other* group and come
  to rest only on the one sharing its own group. This exercises a failure mode that's easy to get
  wrong and easy to miss otherwise: collision-group filtering applied to the rigid body's own
  broadphase collision (which most engines give you for free) is not the same as collision-group
  filtering applied to the vehicle's own wheel/suspension raycasts (which the underlying engine may
  not filter at all unless the adapter explicitly threads the vehicle's groups into the raycast
  call, as `AmmoRaycastVehicleComponent` does via its own patched Bullet build - see
  `packages/ammo/build_gg_ammo/README.md`). A test that only drops a single vehicle onto a single
  matching-group floor cannot catch a raycast that silently ignores collision groups.
- A shape/body-option factory test (`<lib>-factory.spec.ts` or similar) that creates a rigid body
  and a trigger for every `Shape(2D|3D)Descriptor` variant the adapter implements is worth adding
  too — it catches a shape mapping that throws or silently no-ops without needing a physically
  meaningful scenario for each one (see `packages/ammo/test/ammo-factory.spec.ts`).
- For a 3D adapter that implements `ICharacterController3dComponent`, also add
  `<lib>-character-controller.component.spec.ts` (see
  `packages/rapier3d/test/components/rapier-3d-character-controller.component.spec.ts`): settling
  onto a flat floor with a correct grounded state/ground normal, sliding to a stop against a wall
  instead of passing through it, stepping up a ledge shorter than `maxStepHeight`, and — the most
  important one, since it's a regression test for the interface's core contract — asserting
  `position`/`isGrounded` are already fully resolved right after a `move()` call with **no**
  `world.simulate()` call anywhere near it. Remember the broad-phase-registration pitfall above:
  call `world.simulate(0)` once after creating geometry/the character and before the first `move()`
  in each test (representing "the world was already running"), but never in between/after `move()`
  calls, or the synchronous-contract regression test stops actually testing anything.

Use `jest` + `jest-environment-jsdom` (see any adapter's `package.json` devDependencies) — WASM
engines run fine in that environment.

## Wiring a new adapter into the repo

1. Add a `build`/`test` step to `.github/workflows/pull_request_build.yml` (note CI runs a plain
   `npm install` at the repo root first, which — since `packages/*` is an npm workspace — is enough
   to link every adapter against the local core; PR changes to core are exercised by every
   adapter's real test suite, not a pinned npm version of core).
2. Add `{ "path": "../<lib>" }` to the root `tsconfig.json`'s `references` array (so `npm run
   build:watch` picks it up) and the package name to the `libs` array in
   `etc/publish_new_version.sh` (so releases include it) — see `gg-engine-release`. You do **not**
   need to register it anywhere for local dev linking: a new directory under `packages/` joins the
   workspace automatically on the next `npm install`.
3. Add at least one example under `examples/` (see `gg-engine-examples`), ideally reusing an
   existing visual package so the example isolates your new physics backend.
4. Add the package to the root `README.md` "Integrations" list and give it its own
   `packages/<lib>/README.md`.
5. Use `npm install` at the repo root to develop against a local (unpublished)
   `@gg-web-engine/core`, plus `npm run build:watch` for the live-reload loop — see
   `gg-engine-core-development`'s local dev workflow section.

## Don't import a WASM-bindgen native library's internal file paths

`packages/rapier3d/src/components/rapier-3d-rigid-body.component.ts` imported `InteractionGroups`
via `@dimforge/rapier3d-compat/geometry/interaction_groups` (a deep subpath into the package's
internal file layout) instead of the package's own root export. This happened to keep resolving
under `moduleResolution: "node"` (classic resolution ignores a package's `exports` map and does a
raw filesystem lookup) for a while after the `0.0.0-...` prerelease → `0.20.0` upgrade, because a
stale copy of the old package layout lingered in `node_modules` across several `npm install` runs
— `npx tsc -b` only started failing with `TS2307: Cannot find module` once a fully fresh install
actually replaced it, well after the adapter's own build/test pass had already been signed off as
green. `0.20.0`'s package.json `exports` map only declares the root `"."` entry point; the deep
path doesn't exist at that location any more (everything moved under `dist/geometry/...`), but the
type is re-exported from the package root regardless (`export * from "./geometry"` in the
compat package's own root barrel). Fix: `import { InteractionGroups } from
'@dimforge/rapier3d-compat'` (merge into whatever other symbols are already imported from the
package root) — never import a native/WASM-bindgen dependency's internal subpaths; only import
what its own root barrel/exports map actually re-exports, and re-check this specifically after any
version bump of such a dependency, since a lucky stale-`node_modules` resolution can hide the
breakage for a while.

## Jest 30 / WASM-backed adapter pitfalls (hit upgrading `rapier2d`/`rapier3d` off a 2024 prerelease build)

- **jsdom + `jest-environment-jsdom` 30 no longer exposes `TextEncoder`/`TextDecoder` as globals
  inside the jsdom sandbox.** `@dimforge/rapier{2,3}d-compat`'s wasm-bindgen-generated glue calls
  `new TextDecoder(...)` at module top level (unconditionally, at import time), so merely importing
  anything from the adapter package inside a jsdom test throws `ReferenceError: TextDecoder is not
  defined` before any test body runs. Fix: add a `test/jest-polyfills.ts` (or
  `test/jest.polyfills.ts`) that copies `TextEncoder`/`TextDecoder` from Node's `util` module onto
  `globalThis`, and wire it in via `"setupFiles": ["<rootDir>/test/jest-polyfills.ts"]` in the
  package's `jest` config block — it must run before anything requires the WASM glue. Any
  wasm-bindgen-based native library (not just rapier) is liable to hit this the same way.
- **Never drive a rapier `EventQueue`/trigger-overlap test with one giant `world.simulate(bigMs)`
  step.** `world.step()` computes collision/intersection events from body positions as of the
  *start* of that step and integrates positions at the very end, so a single huge timestep produces
  a visible one-step detection lag for anything that both enters and needs to be observed within
  that same call — this became visible upgrading `@dimforge/rapier{2,3}d-compat` from a mid-2024
  prerelease build to the `0.20.0` stable release (verified empirically against the real WASM
  engine; not a bug in `Rapier{2,3}dTriggerComponent`). Relatedly, `EventQueue` constructed with
  `autoDrain: true` clears any undrained events right before the *next* `step()` call, so
  `checkOverlaps()`/`drainCollisionEvents` must be called after **every** `simulate()`, not once
  after a batch of steps, or interior events are silently lost — this is a correctness requirement
  for any real consumer of this API (a per-frame game loop already does this naturally), not just a
  test artifact. Write trigger tests as small (e.g. 10ms) simulate-then-check steps in a loop rather
  than jumping to a checkpoint with one large timestep.
- **A shared "native body options" object passed to multiple factory functions must be typed as the
  narrowest/most-derived type among all the call sites it's passed to.** Hit bumping
  `@types/matter-js` 0.19.7 → 0.20.2: `Matter.Bodies.circle` still types its options as the base
  `IBodyDefinition`, but `Matter.Bodies.rectangle` narrowed to `IChamferableBodyDefinition extends
  IBodyDefinition` (which drops `null` from `chamfer`'s type). `MatterFactory.transformOptions()`
  builds one options object shared across both calls — typing it as the base interface no longer
  satisfies the narrower one under TS 6's stricter structural checking, even though the object
  literal never actually sets the property causing the mismatch. Type the shared object as the most
  derived/narrow type instead of the common base.

## Keep this skill current

This file is read by future agents building/maintaining physics adapters, not by end users of the
engine. If a native engine's API fights the mapping described here (a shape/body-option that
doesn't translate the way expected, a collision-group limit, an async-init or disposal quirk that
caused leaks or flaky tests), or something written here turns out wrong or incomplete once you've
actually implemented it, add a short note (what went wrong, why, the fix) before finishing —
folded into the relevant section rather than left as a loose log entry.
