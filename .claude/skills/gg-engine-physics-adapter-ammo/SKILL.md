---
name: gg-engine-physics-adapter-ammo
description: Known, already-solved implementation pitfalls specific to packages/ammo (the Ammo/Bullet physics adapter) - character-controller sweep mechanics, native push/friction quirks, embind gotchas, removeFromWorld/dispose leaks. Use when fixing or extending packages/ammo itself, not when building a new physics adapter from scratch (see gg-engine-physics-adapter for the general contract every adapter implements).
---

# packages/ammo implementation notes

This file is Ammo/Bullet-specific history: real bugs hit and fixed while building `packages/ammo`,
kept here so nobody re-discovers them from scratch while touching that package again. Read
`gg-engine-physics-adapter` first for the general interface contract (`IPhysicsWorldComponent`,
`ICharacterController3dComponent`, the `removeFromWorld(dispose)` contract, etc.) - everything below
assumes that contract and only covers where Ammo's own native API/build made it non-obvious to
satisfy.

## The `removeFromWorld(dispose)` contract, Ammo specifics

Ammo is WASM/Bullet with manually-tracked native handles (`Ammo.destroy(...)` per allocation) - the
leak `gg-engine-physics-adapter`'s general contract section warns about was real here:
`AmmoCharacterControllerComponent.removeFromWorld` only called `removeCollisionObject` and never
freed the ghost object or its capsule shape. Fixed by having `AmmoBodyComponent.removeFromWorld` call
`this.dispose()` when `dispose` is `true` (every Ammo body/trigger/character-controller subclass
already had a working `dispose()` for its own native body - it just was never wired to
`removeFromWorld`), and by giving `AmmoCharacterControllerComponent` its own `dispose()` override that
additionally frees `nativeShape` (the capsule shape `AmmoBodyComponent.dispose()` alone can't reach,
since Bullet shapes aren't owned by the collision object referencing them).
`AmmoRaycastVehicleComponent` had the same class of gap independently:
`nativeVehicle`/`vehicleTuning`/`raycaster`/`wheelDirectionCS0`/`wheelAxleCS` had no `dispose()` at all
and were never freed on removal, `dispose` or not - fixed the same way. Its `nativeBody` is shared
with the `chassisBody` passed into its constructor (same native handle, not a copy); only the
vehicle's own `removeFromWorld`/`dispose()` frees it - never pass `dispose: true` down into
`chassisBody.removeFromWorld` too, or the shared handle gets double-freed.

## Sleeping bodies silently ignored programmatic transform/velocity writes

See `gg-engine-physics-adapter`'s general contract note on this (the cross-adapter version of the
bug, with the regression-test recipe) - the Ammo-specific fact worth recording here is exactly which
calls needed it and why it was easy to miss: `AmmoBodyComponent.position`/`.rotation` (`setWorldTransform`)
and `AmmoRigidBodyComponent.linearVelocity`/`.angularVelocity` (`setLinearVelocity`/`setAngularVelocity`)
all wrote straight into a sleeping `btRigidBody`'s state with zero indication anything was wrong - no
exception, no warning, `getLinearVelocity()` even read back the value that was just set. The only
observable symptom was the body's `position` never actually changing tick over tick despite
`simulate()` running normally for everything else in the world. Fix: call `this.nativeBody.activate(true)`
at the end of all four setters. `activate(true)` (forced activation) is unconditionally safe to call
even on a static/kinematic body - Bullet's own implementation already no-ops for `CF_STATIC_OBJECT`
internally, so there's no need to guard the call with `isStaticOrKinematicObject()` first.


**A leak that was consciously left alone**: `AmmoRigidBodyComponent`/`AmmoTriggerComponent` never
capture or free their collision shape (`this._nativeBody.getCollisionShape()`) anywhere, including in
`dispose()` - only the character controller's capsule (which owns a private, never-shared shape) was
fixed here, since that was the concretely reported leak. Ammo/Bullet shapes are shareable across
multiple bodies by design, and this package's factory (`ammo-factory.ts`) doesn't currently track
whether a given native shape is exclusively owned by the one body that created it or reused elsewhere
- freeing it unconditionally in `dispose()` risks a use-after-free for a shared shape. Fixing this
properly needs that ownership question answered first; treat it as a known, separate, unresolved gap
rather than assuming `dispose()` on an ordinary Ammo rigid body/trigger is fully leak-free.

## A freshly-created collider not being visible to a query the very same tick

The exact same broad-phase-registration lag `gg-engine-physics-adapter-rapier` documents in detail
for Rapier also exists in this package's pinned Ammo.js build: every existing
`AmmoRaycastVehicleComponent`/`world.raycast()` test already calls `world.simulate(1)` once after
`addToWorld()` for exactly this reason. The `settleWorld()` no-simulate-in-between-moves test pattern
described there applies equally here.

## `world.raycast()` missing a hit when `from` starts inside (or has passed through) the target

Bullet's `rayTest` can only compute an entry point when the ray *starts outside* its target - once
`options.from` lands inside a convex shape (or has flown all the way through it and out the other
side), it finds nothing for that shape at all, from any distance further along the same direction,
not just while still inside it. `Rapier3dWorldComponent.raycast` doesn't have this gap (it calls
`castRay` with `solid: true`, Rapier's own explicit "report a hit at zero distance on whatever
contains the ray's origin" mode), so the exact same query behaves differently depending on which
physics adapter a world is built with - purely an adapter-parity bug, invisible from `packages/core`
alone.

Found from a real, reproducible gameplay report, not from reading Bullet's source first: a
Portal-style demo's `ObjectGrabController.tryGrab()` (core, shared across every adapter)
deliberately starts its pick-up ray a fixed distance in front of the holder's camera to dodge a
self-hit on the holder's own capsule - fine for a target further away than that offset, but that
same fixed offset lands *inside* a small grabbable prop sitting closer than it, which this gap then
makes silently ungrabbable - reproduced on Ammo specifically (Rapier handled the identical query
fine) only once the player stood close enough to the prop, matching the report exactly ("works fine
until I step back a bit").

**Fix**: `AmmoWorldComponent.raycast` now falls back to a discrete point-overlap probe
(`btCollisionWorld.contactTest`, the same discrete-overlap primitive
`AmmoCharacterControllerComponent.recoverFromPenetration` already uses for an unrelated reason)
whenever the plain `rayTest` found nothing - construct a throwaway zero-size `btGhostObject` (a
bare `btCollisionObject` has no public constructor in this build, "no constructor in IDL";
`btGhostObject` is a plain collision object with a real one, and nothing about it being a ghost
type matters since it's never added to the world) at `options.from`, run `contactTest`, and report
whatever it overlaps as a hit at distance 0 - mirroring Rapier's `solid` result shape exactly.

**A real filtering limitation, verified empirically rather than assumed**: `options
.collisionFilterGroups`/`collisionFilterMask` can only ever *narrow* what this fallback reports,
never widen it past whatever Bullet's own default pair filtering already lets through.
`ContactResultCallback`'s internal `needsCollision` check runs against a candidate's *real*
broadphase proxy and the callback's own `m_collisionFilterGroup`/`m_collisionFilterMask` fields
(fixed at Bullet's stock `DefaultFilter`/`AllFilter` values) - but `ConcreteContactResultCallback`
has no exposed setter for either field in this Ammo.js build (`set_m_collisionFilterGroup`/
`set_m_collisionFilterMask` are simply `undefined` on a constructed instance, unlike the same two
setters on `ClosestRayResultCallback`, which do exist and are what the plain `rayTest` above already
uses). Registering the probe itself in the broadphase with explicit group/mask bits via
`addCollisionObject` doesn't help either (tried and measured no effect - only the *candidate's* own
proxy is ever consulted). Net effect: a candidate whose `interactWithCollisionGroups` excludes this
world's default/main group (`mainCollisionGroup`, always group `0`) never reaches this fallback's
JS callback at all, no matter what `options` asks for - an unusual configuration in practice (most
bodies keep interacting with the default group even after adding custom ones), and not one the
reported bug hits (`tryGrab()` passes no filter at all, against a body left at the engine-wide
default `ownCollisionGroups`/`interactWithCollisionGroups: 'all'`). The fallback's own JS-side
group/mask check (reading each candidate's public `ownCollisionGroups`/`interactWithCollisionGroups`
getters) still meaningfully narrows *down* from whatever Bullet's fixed default let through - it
just can't rescue a candidate Bullet's own default already excluded upstream.

**A second, more severe regression this fix created and had to be paired with a fix for**:
`AmmoCharacterControllerComponent.trySnapToGround`'s ground-snap ray deliberately starts its `from`
point a hair inside this character's own capsule (moving "up" from the capsule's own lowest point
moves towards its center, not away from it) - previously a safe trick, since a ray starting inside
its own shape simply found nothing via plain `rayTest` and self-hits were never a concern. Once the
solid-ray fallback above started reporting a hit for exactly that "starts inside a shape" case, this
ray began self-hitting the character's own capsule on every tick instead of finding no ground -
confirmed by a full test-suite run after landing the fallback: a "free fall in empty space, no floor
at all" character-controller regression test failed with the character's fall arrested almost
immediately, because it was being reported as standing on itself. Fixed by wrapping
`trySnapToGround`'s `this.world.raycast(...)` call with the exact same temporary self-detach
`sweep()` already uses for its own `convexSweepTest` call (`collisionWorld.removeCollisionObject
(this.nativeBody)` / `detachIgnoredBodies()` before, `addCollisionObject`/`reattachIgnoredBodies`
after, in a `try`/`finally`) - `trySnapToGround` is the *only* internal caller of `world.raycast()`
in this package, so no other call site needed the same treatment, but the lesson generalizes: any
future internal raycast call in this package that relies on "my `from` point happens to be inside my
own shape, so it can't self-hit" needs the same explicit self-exclusion now, not just an assumption
about `rayTest`'s own limitation.

Regression coverage: `packages/ammo/test/components/ammo-world.component.spec.ts`'s `Raycast`
describe block has the solid-ray-hit-at-distance-0 case, the filter-narrowing case (candidate kept
in the default/main group alongside a custom one), and a close-range reproduction of the exact
`ObjectGrabController`-shaped query against a small prop resting on a pedestal;
`ammo-character-controller-freefall.spec.ts`'s existing "falls under gravity in empty space" test is
what caught the `trySnapToGround` regression.

**This fix alone did not resolve the original gameplay report - it was real and worth keeping (see
the regression coverage above), but the report's actual root cause turned out to be a different,
adapter-agnostic bug in `ObjectGrabController.tryGrab()` itself, fixed in `packages/core` instead -
see `gg-engine-core-development`'s own notes on it.** Found by reproducing the user's *exact*
reported failing position (read from the in-game dev console's entity inspector, not guessed) in a
jest harness matching the real scene geometry: the fixed `holderClearance()`-sized forward skip this
adapter fix was built to accommodate landed the ray not *inside* the small prop (this fix's case) but
*past* it entirely and into the pedestal the prop was resting on - a real, legitimate hit on a
non-grabbable body, which the "starts inside a shape" fallback above has no way to help with, since
the plain `rayTest` already succeeds (on the wrong target) and never reaches the fallback at all.
Worth remembering next time a raycast-adjacent gameplay bug report comes in only *partially*
resolved by an adapter-level fix: re-test with the reporter's own exact numbers before considering it
closed, rather than assuming a plausible-looking mechanism was the whole story once one real bug in
the vicinity has been found and fixed.

## Pitfall: `btKinematicCharacterController` produced zero collision response in this build

Implementing `AmmoCharacterControllerComponent`, the "obvious" approach - a `btPairCachingGhostObject`
+ capsule shape driven by Bullet's own `btKinematicCharacterController` via `setWalkDirection()` then
directly calling `preStep(collisionWorld)`/`playerStep(collisionWorld, dt)` (never `world.addAction`/
`stepSimulation`, to keep `move()` synchronous per the interface contract) - compiled and ran, but
produced **no collision response at all**, for both vertical (falling through a static floor) and
horizontal (walking straight through a wall) motion, verified empirically with a minimal standalone
repro against this package's actual pinned Ammo.js WASM build. `controller.onGround()` also reported
stale/incorrect state throughout (`true` immediately at construction, in mid-air, before any `preStep`
ever ran). The ghost object's own `getNumOverlappingObjects()` stayed at `0` before and after
`preStep` in every case, suggesting the class's internals depend on its `btGhostObject`
overlapping-pairs cache (populated by broadphase pair maintenance, which nothing here ever triggers,
matching the "no `world.addAction`" design) even though its main step logic is documented/believed to
use `btCollisionWorld::convexSweepTest` - a **direct** `convexSweepTest` call against the identical
shape/world/transforms, by contrast, correctly detected the same floor/wall every time. Root cause not
fully isolated (plausibly that dependency, or a build-specific issue with this class in the vendored
WASM binary) - not worth chasing further given a working alternative exists.

**Fix used**: drop `btKinematicCharacterController` entirely and implement the mover directly as a
sequence of `btCollisionWorld.convexSweepTest` calls (`AmmoCharacterControllerComponent`'s `sweep()`
helper - construct `btTransform` from/to, a `ClosestConvexResultCallback` with the character's own
`_ownCGsMask`/`_interactWithCGsMask` copied onto `set_m_collisionFilterGroup`/`set_m_collisionFilterMask`,
read `hasHit()`/`get_m_closestHitFraction()`/`get_m_hitNormalWorld()`, destroy all three Ammo objects
after). Movement is split into a horizontal sweep (with one step-up-and-retry pass for ledges up to
`maxStepHeight`, and one slide bounce along the hit plane's tangent when blocked) and a vertical sweep
(gravity/jump, also used to detect ground), plus a fallback downward raycast (via the existing
`IPhysicsWorld3dComponent.raycast()`, which already works reliably) approximating `snapToGroundDistance`
for a stationary/near-ground character with no explicit vertical input that tick. The ghost object is
still created and added to the collision world - it's just a transform/collision-object identity now,
not driven by the removed class. A `btPairCachingGhostObject` is not actually required for this
approach (a plain `btGhostObject` would do), but there's no reason to change it once a
`btPairCachingGhostObject` is already in hand.

**Pitfall inside that fix**: `convexSweepTest`'s `allowedCcdPenetration` parameter (passed as this
component's `offset`/skin value) lets the capsule end up resting *already slightly inside* whatever it
swept into - by exactly that amount (e.g. a resting `z` of `0.89` instead of the geometrically exact
`0.9` for a `0.01` offset). A ground-snap raycast whose `from` point is derived from that
already-slightly-penetrating position (even nudged up by only the same skin amount) starts *inside*
the floor's collision shape - and a ray that begins inside a shape does not register an entry hit
against it, so the snap silently always missed (character correctly fell/settled once via the main
vertical sweep, then immediately read back `isGrounded: false` on the very next horizontal-only move,
since nothing re-derives groundedness from a stale sweep result). Fix: start the snap ray comfortably
above the theoretical resting bottom (`max(skin * 4, 0.02)`, not just `skin`) - enough margin to clear
the sweep's own allowed penetration in the worst case - before sweeping down through
`snapToGroundDistance`.

**The same embedded-landing quirk also affects a core-level query that runs *after* `move()`, not just
this component's own ground-snap ray - worth backing the landing position off proactively rather than
trusting every future caller to add its own margin, even though (see the note at the end of this entry)
it turned out not to be the whole story.** The ground-snap fix above only patched the one ray inside
this file that happened to trip over `allowedCcdPenetration`'s embedding first; `position` itself was
still left embedded after any blocked vertical sweep, ceiling or floor alike. That looked, at first, like
the cause of a second, unrelated symptom: `CharacterController3dEntity.tryStandUp` (core, shared across
every backend) casts a headroom ray starting only `max(offset * 2, 0.02)` above the character's *current*
top to decide whether standing up from a crouch is clear, and jumping while crouched under a ceiling too
low to stand under was standing the character up mid-jump and clipping it into the ceiling. `move()` now
backs the landing position off by a shared `contactClearance` getter (`max(offset * 4, 0.02)` - the same
formula the ground-snap ray above already used, now factored out) whenever the vertical sweep is blocked
by something that *isn't* walkable ground underfoot (a ceiling while ascending, or a too-steep slope
pressed straight into) - deliberately **not** applied to the ordinary floor-landing branch, to avoid
perturbing that branch's established, tightly-tested embedded-by-`skin` resting precision. This is a
real fix worth keeping (it does make every consumer of `position` - not just `tryStandUp` - see a
non-embedded landing spot after a blocked vertical sweep), but **it did not fix the reported bug on its
own** - see the note below and `gg-engine-physics-adapter`'s "pitfall inside `tryStandUp`" style entry in
`character-controller-3d.entity.ts` for the actual root cause and fix, which landed in core instead.
Confirmed via a real end-to-end repro (`ammo-player-character-controller-integration.spec.ts`'s "crouch +
ceiling + jump" test - drives the real `CharacterController3dEntity` + `PlayerCharacterController` +
`AmmoWorldComponent` together, no mocks) that the character still stood up and clipped into the ceiling
with only this fix in place: the failure tick wasn't even touching the ceiling yet (still ~1.5cm below
it) - `move()`'s own sweep hadn't engaged at all, so there was no embedded landing position for this fix
to correct. The character's own natural, entirely legitimate per-tick rise had simply landed within
`tryStandUp`'s own ray margin of the ceiling for one tick, which is a category of bug this component's
`position` can't fix by itself no matter how clean it's kept - see core's fix (gate `tryStandUp` on
`isGrounded`) for why. Lesson for next time a core-level raycast/query fed by this component's `position`
behaves differently on Rapier than on Ammo: checking whether the Ammo-side position is quietly embedded
is a reasonable first hypothesis, but confirm it with a real end-to-end regression test before declaring
victory - a component-level test that only checks the position/raycast machinery in isolation (as the
first version of this fix's own test did) can pass while the actual reported symptom, driven through the
real entity, still reproduces.

Once core's actual fix (gate `tryStandUp` on `isGrounded`) was in place, this Ammo-side backoff was
re-checked for redundancy by reverting it alone and re-running the same end-to-end test: the character
correctly never stood up (core's gate alone is enough for *that*), but the resting `position` after the
blocked sweep was still measurably embedded in the ceiling for one tick. So this fix earns its keep for a
real, independently-confirmed reason - keeping every consumer of `position` honest, not just
`tryStandUp` - even though it wasn't the fix for the headline symptom. Worth re-running a check like this
(temporarily revert one candidate fix, keep the other, re-run the regression test) whenever two fixes for
the same bug report land in the same session, rather than assuming both are still pulling weight.

**Pitfall: an unconditional ground-snap fallback silently cancels every jump.** If `move()` falls back
to an extra downward ray/sweep whenever the main vertical sweep didn't already confirm grounded (e.g.
because the vertical component this tick was zero, or too small to register a floor hit), that
fallback must skip entirely whenever the desired vertical component is **upward** (jumping/rising) -
otherwise it pulls the character straight back down to the floor it just launched from, since a jump's
first tick or two moves it only a few centimeters up, well within any reasonable snap distance. Found
exactly this way: `jump()` visibly set the right internal state and the very first `move()` afterward
even integrated gravity correctly, but the character's height never changed frame to frame at all - the
snap fallback was undoing the small rise every single tick before it could accumulate. Fix: gate the
fallback on `dot(desiredVertical, up) <= 0` (falling or stationary), never when moving away from the
ground.

**Pitfall (more severe, found after the above): `convexSweepTest` has no built-in "don't hit me"
concept, and a character sweeping its own shape self-collides.** Unlike `btKinematicCharacterController`
(which excludes its own ghost object from its internal sweeps by identity, via a callback subclass
`needsCollision` override that JS can't replicate against the embind-exposed `ClosestConvexResultCallback`),
a hand-rolled `collisionWorld.convexSweepTest(shape, from, to, callback, ...)` happily reports the
character's **own** collider as the closest hit - a resting capsule always geometrically overlaps its
own ghost object's collider, by definition, at the sweep's `from` transform. Symptom was severe and
easy to misdiagnose as something else entirely: ordinary WASD movement on a completely flat, empty
floor (no walls, no other bodies at all) was capped to a small, *direction-dependent* fraction of the
intended speed (e.g. one strafe direction covering roughly half the expected distance while the exact
opposite direction was unaffected) - the self-hit's reported fraction/normal are essentially
floating-point noise from the exact geometry of the self-overlap, so different sweep directions "lose"
by different, inconsistent amounts. Do not try to fix this by filtering the hit normal (e.g. "discard
hits whose normal looks floor-like/walkable") - that was tried first and made things worse in a
different way: it also discards genuine ledge/step-corner hits whose blended normal (from sweeping into
a box's edge, not a clean face) happens to fall within the walkable-slope threshold, silently letting
the character glide through a real step instead of climbing it. The actual fix: exclude the character's
own collision object from the collision world for the duration of each sweep call -
`collisionWorld.removeCollisionObject(this.nativeBody)`, run `convexSweepTest`, then
`collisionWorld.addCollisionObject(this.nativeBody, ownMask, interactMask)` in a `finally` block. This
is the one case where filtering by collision group/mask isn't a viable alternative either: a
character's own group is generally not exclusive to it (it commonly shares the default/main group with
ordinary static geometry like the floor itself), so masking the query to exclude "my own group" would
also hide real obstacles that happen to share it, not just self. When implementing a from-scratch
sweep-based mover (here, or for any future adapter whose engine's native character controller turns out
unusable the same way `btKinematicCharacterController` did), write an end-to-end test that drives
continuous movement in **all four horizontal directions** (not just one) over a plain floor with
nothing else in the scene, asserting each covers the same, undiminished distance - a single-direction
test is exactly the kind of test that keeps this bug hidden (it happened to still look correct in the
direction that was tested first).

**Pitfall (most severe of all: silent, permanent tunneling through geometry, not just a jitter):
`convexSweepTest` finds nothing once this character's shape is even slightly embedded in a body,
forever after.** `convexSweepTest` is a conservative-advancement/GJK-based cast, which can only compute
a time-of-impact when it *starts* outside the target - a well-documented Bullet limitation, not a bug
specific to this package. The moment this character's shape ends up penetrating another body by even a
hair - from ordinary `allowedCcdPenetration`/skin tolerance on a settle, or a per-tick step distance
simply overshooting the exact contact point - **every subsequent `convexSweepTest` against that
specific body silently returns no hit at all, from any position, in any direction, permanently** (not a
one-tick glitch: this is a standing blind spot to that body until the character moves away and back).
Symptom that made this hard to trace: walking toward a low overhead beam correctly slowed the character
down tick over tick as it approached (a legitimate, not-yet-penetrating sweep hit each time) - then, the
instant it got close enough to end up a hair inside the beam, the very next `move()` found nothing there
at all and the character sailed straight through, at full speed, with zero further resistance. A test
that only checks "is progress blocked while approaching" (e.g. `is slowed/stopped when walking directly
into a wall` in this package's own suite) cannot catch this - it only shows up as a **failure to still
be blocked after having already made contact**; write the regression test as "walk *through* the
obstacle's full footprint" and assert final position never got picked up.

**Fix**: run a `recoverFromPenetration` step at the very top of `move()`, before any sweep, using
Bullet's discrete `btCollisionWorld.contactTest(collisionObject, resultCallback)` (a same-instant
overlap query, unaffected by the sweep's start-outside limitation since it isn't a cast at all) to find
the deepest current penetration and push the character back out along its normal before proceeding -
the same "recover from penetration" step `btKinematicCharacterController` runs internally (and the
reason this class needs its own copy, having dropped that class - see above). Two more embind quirks
specific to wiring this up in Ammo.js, found empirically, neither documented in `ammo-ambient.d.ts`:

- `ConcreteContactResultCallback`/`RayResultCallback`-style "JS-overridable" classes require the
  override to be an **own property of the instance**, not a prototype method - `class X extends
  Ammo.ConcreteContactResultCallback { addSingleResult() {...} }` fails at the very first call with
  `"a JSImplementation must implement all functions, you forgot
  ConcreteContactResultCallback::addSingleResult"`, even though the method is right there, because the
  generated glue checks `instance.hasOwnProperty('addSingleResult')` and an ES6 class method lives on
  the prototype, not the instance. Fix: `const cb = new Ammo.ConcreteContactResultCallback();
  cb.addSingleResult = function(...) {...};` (plain assignment after construction, not a subclass).
- Every object parameter a callback like this receives (`cp: btManifoldPoint`,
  `colObj0Wrap/colObj1Wrap: btCollisionObjectWrapper`) arrives as a **raw numeric handle**, not a
  wrapped instance, despite what the ambient types say - call the undeclared-but-present
  `Ammo.wrapPointer(ptr, Ammo.ClassName)` on each one before using any of its methods, or every method
  call throws `TypeError: ... is not a function`.
- `m_normalWorldOnB` always points from collision object B towards object A - which of the pair is
  "this character" depends on Bullet's own internal ordering of the two bodies for that pair, not call
  order, so compare `Ammo.getPointer(wrap0.getCollisionObject())` against
  `Ammo.getPointer(this.nativeBody)` to orient the push-out direction correctly instead of assuming a
  fixed side.
- Wrap the `contactTest` call in the same remove-self/`try`/re-add-self-in-`finally` pattern as
  `sweep()` above, for the same self-collision reason.

**Pitfall: a step-up assist that only checks "did this clear more horizontal distance" will
incrementally climb any smooth, tall, non-walkable obstacle it's pressed against.** A step-up-and-retry
pass (see the fix above) accepts stepping up whenever the retried horizontal sweep at the raised height
clears strictly more distance than staying flat. That comparison alone is not enough: sweeping a
capsule's rounded profile against a curved or perfectly vertical surface (a cylinder, a sphere) can
yield a *slightly* larger clearance fraction a few centimeters higher up for reasons that have nothing
to do with there being a step there - pure curvature/contact-point drift. Accepting the step on that
basis alone means every tick spent walking along such a surface nudges the character up by a small
fraction of `maxStepHeight`, compounding into visibly "climbing" a wall that is, by construction,
unclimbable (found by walking the character along a tall vertical cylinder in the example scene - it
slowly walked right up the side). Fix: after tentatively raising and re-sweeping horizontally, also
sweep straight back down by the raised amount from the new position and require that settle-down
actually lands on a normal within `maxSlopeClimbAngleRad` of `up` (reuse the same `isWalkableNormal`
helper used for grounding) before committing to the step at all; otherwise fall back to the ordinary
flat-sweep-and-slide result as if no step had been attempted.

**Pitfall: a vertical-only sweep with no slide-along-tangent leaves a character stuck jittering against
a too-steep slope instead of sliding down it.** The horizontal movement leg already slides the
remaining blocked distance along the hit surface's tangent when obstructed (see the self-collision
pitfall above); the vertical leg (gravity/jump/falling) originally did not - it just stopped dead at
whatever fraction the sweep allowed. Combined with `CharacterController3dEntity` correctly refusing to
treat a too-steep contact as "resting" (see its `isWalkableGround`, which keeps integrating gravity in
that case instead of zeroing it), the two together should make a character slide off a steep slope
under gravity - but without a slide step on the vertical leg too, the character just gets re-blocked at
(almost) the same point every tick, never actually going anywhere. Fix: mirror the horizontal leg's
slide logic on the vertical leg too - whenever the vertical sweep hits something that isn't a walkable
floor, project the remaining vertical distance onto the plane perpendicular to the hit normal and sweep
that as a second pass, same as an obstacle-blocked horizontal move already does.

**Pitfall: a ghost-object character controller's native Bullet contact response "pushes" dynamic
bodies, but is mass-blind and never spins them - it must be disabled, not built on.** A kinematic
character built as a `btPairCachingGhostObject` (see the note above on why `btKinematicCharacterController`
itself is unusable here) is never added via `addRigidBody`, so it's never actually integrated by the
constraint solver - but `performDiscreteCollisionDetection` still generates manifolds between it and
any dynamic body it overlaps during `stepSimulation`, and the solver still processes those manifolds:
`btRigidBody::upcast()` on a non-rigid-body collision object returns null, so the solver falls back to
treating that side of the manifold as a fixed/immovable body. The resulting correction lands entirely on
the dynamic body, but since it's driven by the manifold's penetration depth and Bullet's own
Baumgarte/split-impulse recovery-speed cap - not by any real momentum transfer from the "immovable" side
- it comes out at *roughly the same magnitude regardless of the dynamic body's own mass*, and carries no
friction/tangential component (so it never spins a pushed sphere). Confirmed empirically
(`player-character-three-ammo`, added while building `pushDynamicBody`): a light and a heavy dynamic box
both got shoved at effectively the same ~0.8 m/s by an identical walk-into, even with a hand-rolled,
explicitly mass-aware push additionally disabled - i.e. this native response was the actual (mass-blind,
non-rotating) source of "pushing" the whole time, silently drowning out anything a mass-aware push tries
to add on top. Fix: set `CF_NO_CONTACT_RESPONSE` (4) alongside `CF_CHARACTER_OBJECT` (16) on the ghost
object's collision flags at construction (`ghostObject.setCollisionFlags(CF_CHARACTER_OBJECT |
CF_NO_CONTACT_RESPONSE)`) so Bullet's own dynamics never generates a response for it at all, then
implement pushing entirely by hand as its own step: reuse the hit info an existing horizontal sweep
already produces (extend the sweep helper's result type with the hit `Ammo.getPointer()`, look it up in
`AmmoBodyComponent.nativeBodyReverseMap` to recover the wrapping component), model the contact as a
simple inelastic collision against a virtual character mass (`bodySpeedAlongPush = characterSpeed *
pushMass / (pushMass + bodyMass)`, only ever *adding* velocity along the push direction, never
subtracting) - set linear velocity only, no shape-specific handling needed. Computing `characterSpeed`
itself needs real `desiredTranslation / dt`, not the raw per-tick translation distance alone (which is
off by a factor of the tick's own timestep) - `ICharacterController3dComponent.move()` takes an optional
trailing `dt` argument for exactly this, which `CharacterController3dEntity` always passes (its own tick
delta); a backend that doesn't push dynamic bodies is free to ignore the parameter entirely. A backend
that *does* push dynamic bodies, however, must not fall back to treating the raw per-tick distance as if
it were already a speed when a caller omits `dt` (found live in both `AmmoCharacterControllerComponent`
and `Rapier3dCharacterControllerComponent`, which had copy-pasted the identical fallback: `dt && dt >
1e-9 ? len / dt : len`) - `CharacterController3dEntity` always passes `dt`, so this only bites a caller
going through `ICharacterController3dComponent` directly without it, but when it does, it silently
understates push force by roughly a factor of `dt` (a 16ms tick's displacement is ~60x smaller than the
equivalent m/s figure) rather than erroring or visibly misbehaving, which is exactly the kind of
wrong-but-plausible-looking physics that goes unnoticed. Fix: skip the push for that tick entirely when
`dt` is missing/non-positive, guarded by a one-time `console.warn` (module-level flag, not per-instance,
so a scene with several such characters logs once total) rather than per-tick spam.

**Related pitfall, easy to misdiagnose as "friction can't induce rotation" - it can: a pushed sphere
given pure linear velocity looked like it would never start rolling on its own, but the real cause was
`m_rollingFriction` being set equal to sliding friction, not any inability to generate spin from sliding
contact.** First measured while chasing the pitfall above: giving a resting sphere pure linear velocity
and letting it slide across a static floor for dozens of ticks decelerated it as expected, but its
angular velocity never left exactly zero the whole time - which looks exactly like "this Bullet build's
contact solver just doesn't generate the friction torque that would spin a sliding sphere up into
rolling." The actual cause was `AmmoFactory.createRigidBodyFromShape` calling
`environmentBodyCI.set_m_rollingFriction(options.friction)` - reusing the *sliding*-friction value (0.5
by default, via `defaultBodyOptions`) as *rolling* friction too, a physically distinct and normally much
smaller quantity (real-world rolling-resistance coefficients run roughly two orders of magnitude below
typical sliding-friction ones; Bullet's own construction-info default is `0`, i.e. no rolling resistance
at all). At `rollingFriction: 0.5`, the same manifold's rolling-friction constraint damped any spin the
sliding-friction contact *did* generate back out within the same solver step it was generated in, before
anything outside the solver ever read a nonzero value - so it wasn't that the inducing torque was
missing, it was being cancelled in the same step it appeared. Confirmed by isolating the two: reverting
sliding friction back to its old value while leaving `rollingFriction` at a small fixed default
(decoupled from `options.friction` entirely) was enough on its own to restore natural slide-to-roll
spin-up - no sliding-friction change needed. This means a project that first "fixes" the symptom by
manually setting a pushed sphere's angular velocity to the rolling-without-slipping value (`ω = (speed /
radius) · (up × pushDirection)`, the `ω` that makes the contact point's velocity `v_com + ω ×
(-radius·up)` exactly zero) is treating the wrong layer - once `m_rollingFriction` is fixed at the
factory level, that per-push workaround becomes redundant (rolling now emerges from ordinary floor
contact, the same way it would for any other shape/interaction, not just a character's push) and should
be removed rather than layered on top; a workaround like this is also easy to get backwards on the
*sign* of `ω` (an earlier version of it used `direction × up`, which Bullet's own naturally-induced spin
- the actual ground truth once compared - showed to be exactly opposite: `up × direction`), one more
reason to prefer removing it over trying to keep it "correct" once it's no longer needed for anything.
Picking the actual *magnitude* for that small rolling-friction default matters too, not just getting it
away from `options.friction` - too small (an initial `0.02`) undershoots badly, giving a pushed sphere
8+ *simulated* seconds to coast to a stop (bounces off several walls in a room-sized space first, reading
as "never stops" even though it technically does eventually); this repo settled on `0.05` after measuring
stop time across a spread of values by giving a resting sphere realistic rolling-without-slipping
velocity and counting simulated ticks to rest.

**Related pitfall: fixing `m_rollingFriction` above still leaves a sphere spinning about the
contact-normal axis (a "top" spin, not a "rolling" spin) undamped *forever*, not just slowly -
`m_rollingFriction` and sliding friction only ever touch spin about axes *tangent* to the contact
normal.** A sphere's contact point velocity is `ω × r_contact` (`r_contact` pointing from center to the
single contact point, i.e. straight down for a sphere on flat ground) - this is exactly zero whenever
`ω` is parallel to `r_contact`, i.e. spin purely about the vertical/contact-normal axis, no matter how
fast that spin is. Neither sliding friction nor `m_rollingFriction` (which only opposes the kind of spin
that couples to translation via the rolling condition) generates any torque against that axis, since
there's no relative sliding at the contact point to oppose. Confirmed empirically: a sphere given *only*
vertical-axis angular velocity (zero linear velocity, zero other-axis spin) held that exact spin speed,
completely undiminished, for 12+ simulated seconds with the `m_rollingFriction` fix above already in
place - not a slow decay, no decay at all. A straight-on push (character running directly behind a body)
only ever imparts rolling-axis spin, which is why this can go unnoticed for a while, but any
off-center/glancing contact (brushing something at an angle, a wall bounce that isn't perfectly square)
puts some spin on the vertical axis too, which would otherwise persist literally forever once everything
else has settled. Bullet models resistance to *this* axis as a third, separate quantity,
`m_spinningFriction` - unlike `m_rollingFriction`, `btRigidBodyConstructionInfo` has no field for it at
all, so it can't be set via the construction-info object during body construction; it's only ever
settable on the already-constructed `btRigidBody` itself, via `nativeBody.setSpinningFriction(x)`
(`AmmoFactory.createRigidBodyFromShape` calls this right after `new Ammo.btRigidBody(...)`, before
wrapping it in `AmmoRigidBodyComponent`). Reuses the same `0.05` magnitude as `m_rollingFriction` - both
are "resistance to spin" quantities of the same physical character, just about different axes.

## `ignoredBodies`: excluding a specific body from this character's own sweeps *and* penetration recovery

`AmmoCharacterControllerComponent.ignoredBodies` (a `Set<AmmoRigidBodyComponent>`) is implemented by
temporarily removing each currently-ignored body from `dynamicAmmoWorld` via
`AmmoRigidBodyComponent.detachFromBroadphaseTemporarily()`/`reattachToBroadphase()` - two small public
methods on that class using its own `addRigidBody`/`removeRigidBody` pair (not
`addCollisionObject`/`removeCollisionObject`, which is for ghost objects like the character's own
shape, not full rigid bodies) - right alongside the character's own self-exclusion in **both**
`sweep()` and `recoverFromPenetration()`, via a shared `detachIgnoredBodies()`/
`reattachIgnoredBodies()` helper pair. Both call sites matter equally: excluding a body from `sweep()`
alone stops it from blocking *movement*, but `recoverFromPenetration()` runs independently (at the top
of every `move()`, regardless of whether that tick's sweep would have hit anything) and reacts to
*any* overlap by shoving the character out - so a body excluded only from `sweep()` still gets treated
as a solid obstacle the instant it overlaps the character (e.g. a currently-held prop the holder walked
into before the hold spring moved it away), reintroducing the exact "held prop blocks/launches its own
holder" bug `ignoredBodies` exists to fix, just via the other code path. `detachFromBroadphaseTemporarily()`
returns `false` (no-op) for a body that isn't currently `addedToWorld`, so `reattachIgnoredBodies()` is
only ever called with the subset that was actually detached - reattaching a body that was never removed
would double-add it to the broadphase.

`CharacterController3dEntity.recreateCapsule()` (core, shared across every adapter) copies the old
capsule's `ignoredBodies` into the freshly-created replacement itself before discarding the old one -
this is a core-level fix, not an Ammo-specific one, but worth knowing when debugging a crouch/stand
transition that appears to silently drop a held-object exclusion: without it, every capsule swap (e.g.
`recreateCapsule`) would reset to an empty set and re-enable collision with whatever was being ignored.

## `AmmoWorldComponent.simulate()`'s fixed-substep accumulator drifting against the render loop

`stepSimulation(timeStep, maxSubSteps, fixedTimeStep)` with a non-zero `maxSubSteps` puts Bullet into
its own built-in fixed-timestep-with-accumulator mode: it keeps a running `m_localTime` counter,
adds each call's `timeStep` to it, then consumes as many whole `fixedTimeStep`-sized chunks as fit,
carrying the leftover fraction into the *next* call. `AmmoWorldComponent.simulate(delta)` used to hand
`fixedTimeStep`/`maxSubSteps` straight through as those two arguments - which means the amount of
physics time actually simulated in a given call is `floor(accumulated / fixedTimeStep) *
fixedTimeStep`, not `delta` itself. At a real, variable render `delta` (~16.7ms at 60fps, essentially
never an exact multiple of the default `fixedTimeStep: 0.01`), that accumulator alternates between
consuming 10ms and 20ms of simulated time call to call while the true elapsed time stayed ~16.7ms
both times - confirmed by isolating the arithmetic outside Ammo entirely: a realistic jittery ~60fps
delta stream fed through the old accumulator formula showed simulated-time error alternating roughly
±3-7ms in sign every other call, versus exactly `0` every call once fixed (see the fix below).

Nothing else in this engine's tick loop goes through that same accumulator -
`CharacterController3dEntity.move(desiredTranslation, dt)` (core, every adapter) applies the real,
un-quantized per-tick `dt` directly, and `AmmoBodyComponent.position` reads
`nativeBody.getWorldTransform()` straight off the rigid body with no render-time interpolation of its
own. So a camera driven off the character controller advances by the exact real `delta` every tick,
while a dynamic body's reported position advances by the accumulator's quantized, drifting amount -
the mismatch alternates sign frame to frame and scales with the body's own speed (bigger speed ->
bigger position error for the same few-millisecond timestep mismatch). Real, reported, reproduced
symptom: grab a `Grabbable3dEntity`, walk sideways while looking forward - the held object visibly
flickers back and forth along the strafe axis instead of settling into a smooth, linearly-closing
offset from the camera; the same mechanism produces a fixed camera flickering relative to a moving
raycast vehicle, or a chase camera's target flickering relative to its own spinning chassis.
`Rapier3dWorldComponent.simulate` has no equivalent bug at all (confirmed reproducible on Ammo,
never on Rapier3d) - it just sets its own `timestep` to `delta` and steps once, so simulated time
always exactly equals real elapsed time, with no accumulator to drift.

**Fix**: don't hand `fixedTimeStep`/`maxSubSteps` to Bullet's own accumulator at all - compute the
substep count/size in JS instead, every call: `n = max(1, ceil(dt / fixedTimeStep))` (clamped by
`maxSubSteps`, which is now purely a hard ceiling protecting against one huge catch-up call - e.g. a
backgrounded tab - grinding through an enormous number of substeps), then call `stepSimulation(dt, n,
dt / n)`. `n` equal-sized substeps of `dt / n` always sum to exactly `dt`, so nothing is ever left for
Bullet's accumulator to carry into the next call - for any `delta` that already divides evenly by
`fixedTimeStep` (every synthetic test in this package's own suite uses one) this reproduces the old
accumulator's result exactly bit for bit; for a real, non-round render `delta` it's what actually
removes the drift.

**A first attempt at fixing this - `stepSimulation(dt, 0)`, Bullet's own single-step "variable
timestep" mode, mirroring `Rapier3dWorldComponent.simulate` literally - also removed the drift, but
was a real regression, not just a hypothetical stability concern, confirmed by running this package's
own test suite against it: `ammo-raycast-vehicle.component.spec.ts`'s vehicle stopped settling
correctly on its suspension, and `ammo-trigger.component.spec.ts`'s exit-detection test stopped firing,
from nothing more extreme than those tests' own existing `world.simulate(60)`-per-frame loops - not a
huge one-off catch-up delta.** Substep chunking turned out to be load-bearing for ordinary per-tick
solver accuracy (suspension springs, narrow-phase overlap updates), not just a tunneling safeguard for
rare large deltas, so a fix that removes all substepping to fix the accumulator drift trades one real
bug for another. The `n = ceil(dt / fixedTimeStep)` scheme above keeps every substep bounded by
`fixedTimeStep` unconditionally (not just above some delta threshold) while still eliminating the
cross-call drift, which is why it - not plain variable-timestep mode - is the fix that shipped.
`examples/shooter-three-ammo`/`examples/collision-groups-pool-three-ammo`, which both raise
`maxSubSteps` explicitly for their own fast-shape/many-body stability needs, are unaffected by this
change: their override still just clamps `n` the same way it clamped Bullet's own substep count before.

Regression coverage: this package's full existing suite (particularly the two round-`delta`-driven
tests above, which pin the new scheme to reproduce the old accumulator's result exactly for exact
multiples of `fixedTimeStep`) is what caught the plain-variable-timestep regression and confirms the
shipped fix doesn't reintroduce it - no dedicated jitter regression test was added, since the drift
itself only manifests as an accumulating position disagreement against a separate, non-quantized
camera/controller across many non-round-delta ticks, not as a single-call assertion this package's
existing per-component test style is set up to express.

## `onCollisionStart`/`onCollisionEnd`: manifold polling, not a native callback

`AmmoRigidBodyComponent.onCollisionStart`/`onCollisionEnd` (backing `IRigidBody3dComponent`'s
contract) are driven entirely by `AmmoWorldComponent.simulate()`'s own `processCollisionEvents()`,
called once per tick right after `stepSimulation` - Ammo/Bullet has no native "collision
started/ended" callback usable from this embind build, so this package uses the standard polling
technique instead: walk `dispatcher.getNumManifolds()`/`getManifoldByIndexInternal(i)` (both
declared directly on the `btDispatcher` base class - `_dynamicAmmoWorld.getDispatcher()` returns
one), and for each manifold with `getNumContacts() > 0`, resolve `manifold.getBody0()`/
`getBody1()` back to components via the existing `AmmoBodyComponent.nativeBodyReverseMap` (no
second reverse-map needed). A `Map<string, [AmmoRigidBodyComponent, AmmoRigidBodyComponent]>` keyed
by a sorted `"${lowerPtr}:${higherPtr}"` string, diffed frame to frame, is what turns "which pairs
have contacts this tick" into "started"/"stopped" events - present now but not last frame = start,
present last frame but not now = end.

**A manifold existing is not the same as two bodies touching** - Bullet keeps a manifold alive for a
mere broad-phase AABB overlap with zero narrow-phase contact points, so gating on
`getNumContacts() > 0` (not manifold presence alone) is required, exactly as the general skill's
task description warns.

**Triggers and the character controller need no special-casing at all, because they already fail a
simpler check.** Both `AmmoTriggerComponent` (a `CF_NO_CONTACT_RESPONSE` ghost object) and
`AmmoCharacterControllerComponent` (also a ghost object) still generate ordinary manifolds/contact
points against anything they overlap - `CF_NO_CONTACT_RESPONSE` only suppresses the *solver*'s
response, not narrow-phase manifold generation, confirmed by this package's own dedicated test
(`ammo-rigid-body-collision.spec.ts`'s trigger-overlap case: a real floor collision fires
`onCollisionStart` while a trigger occupying the same overlap volume never does). Rather than
checking collision flags/instance type against two separate classes, one `instanceof
AmmoRigidBodyComponent` check on **both** resolved components is sufficient and simpler - a trigger
or character controller's ghost object resolves to its own, different component class via the same
reverse map, so it's excluded automatically without needing to know that CF_NO_CONTACT_RESPONSE is
even involved.

**Contact geometry/impulse API surface used** (none of this is declared in `ammo-ambient.d.ts` as a
single documented group, so recording the exact combination here): `btManifoldPoint
.getPositionWorldOnA()`/`.getPositionWorldOnB()` (contact point on each side, in world space),
`.get_m_normalWorldOnB()` (contact normal - **always points from the manifold's body1 ("B") towards
its body0 ("A")**, the same convention `AmmoWorldComponent.solidRayFallback` already documented and
relies on; orient it per-body by negating for whichever side is body0), and
`.getAppliedImpulse()` (solved impulse magnitude for that contact point, already non-negative in
practice - picking the contact with the largest one is enough to pick "the" contact when a manifold
has several, e.g. a box resting flush on a floor with 4 corner contacts).

**`relativeVelocity` is necessarily an approximation, not the literal pre-collision approach
vector.** Bullet resolves contact response within the same `stepSimulation` call that first
generates a manifold's contact points, so by the time `processCollisionEvents()` runs (right after
`stepSimulation` returns) and reads `self.linearVelocity`/`other.linearVelocity`, both are already
post-response - there's no embind hook exposed in this build for a pre-solve velocity snapshot.
This is fine in practice: the two reciprocal events remain exact negations of each other by
construction (both read the same two velocities at the same instant), which is the property the
core contract and this package's own reciprocal-event test actually check, rather than bit-exact
physical precision.

**`onCollisionEnd`'s `null` case is not just "best-effort via dispose"** - `processCollisionEvents`
checks `this.children.includes(...)` for the other side of an ended pair, which flips to `null`
for a plain `removeFromWorld()` (dispose or not), not only an actually-disposed component. No
dedicated test exercises the disposed-while-touching sub-case specifically (removed-while-touching
is the one path this package's own suite doesn't happen to need for its reported scenarios), but the
mechanism naturally covers both since `children` reflects `removed$`/`added$` regardless of whether
`dispose()` was also requested.

Regression coverage: `packages/ammo/test/components/ammo-rigid-body-collision.spec.ts` - a falling
box landing on a static floor (start event, `impulse > 0`, roughly-vertical normal), the reciprocal
event on the floor with a negated normal and negated `relativeVelocity`, no re-firing of
`onCollisionStart` for a pair that has settled at rest across many further `simulate()` calls, an
end event when a settled box is knocked straight up and separates, and a trigger overlapping a real
floor collision never producing a rigid-body collision event for that overlap (only its own
`onEntityEntered`).

**Performance: don't extract contact-point/impulse data for a pair that was already touching last
frame.** The first version of `processCollisionEvents()` ran its per-contact `getContactPoint(j)`/
`.getAppliedImpulse()` loop for *every* manifold with contacts, every tick, unconditionally - but
that data is only ever used to build a `CollisionEvent` for a pair transitioning into contact
(`onCollisionStart`); for a pair already present in `previousContactPairs` (still resting on
something from a prior tick) it was computed and immediately discarded, every single frame. In a
scene with many settled bodies - stacked crates, a car's wheels on the ground, static level geometry
resting on other static geometry - that's the steady-state common case, not the rare one, so this
was real, always-on wasted cost: `getContactPoint`/`getAppliedImpulse` each cross the embind/WASM
boundary, which is measurably more expensive per call than plain JS. Fix: check
`this.previousContactPairs.has(key)` (cheap - just the two `Ammo.getPointer()` calls and a string
key, already needed anyway to track `currentPairs`) and `continue` before ever touching a contact
point, for any pair already known to be touching. This shrinks the *unconditional* per-tick cost of
collision polling for an already-settled scene down to "one manifold walk, cheap
pointer/map-lookup work per manifold, no embind contact/impulse calls at all" - the expensive path
now only runs proportionally to how many pairs are *newly* touching this tick, not how many are
touching in total. Worth checking for the same shape of waste in any future adapter that polls
native per-contact data every tick rather than reacting to a native start/stop event directly
(Rapier/matter-js don't have this problem at all - their own `onCollisionStart`/`onCollisionEnd`
implementations are driven by the native engine's own edge-triggered event queue/callback, which
simply never fires for a continuing contact in the first place).

**`AmmoWorldComponent.enableCollisionEvents` (default `true`) lets an app opt out of the manifold
walk entirely.** Even after the above optimization, `processCollisionEvents()` still does one cheap
pass over every manifold every `simulate()` call - unconditionally, regardless of whether anything is
subscribed - to know which pairs are currently touching. For an app that never reads
`onCollisionStart`/`onCollisionEnd` at all, and has a very large number of simultaneously-resting
bodies (a big debris field, a dense physics playground), that per-manifold bookkeeping is pure
overhead with nothing to show for it. Setting `enableCollisionEvents = false` skips the `simulate()`
call into `processCollisionEvents()` outright, removing the cost completely; `onEntityEntered`/
`onEntityLeft` on triggers are a separate, already-existing mechanism (each trigger's own
`checkOverlaps()`) and are unaffected either way. Toggling this back to `true` later resumes
normally without needing to clear any state first: `previousContactPairs` is simply never advanced
while disabled, so the first `processCollisionEvents()` call after re-enabling diffs the world's
actual current contacts against whatever `previousContactPairs` last held (empty, if collision
events were never enabled before) - any pair already touching at that point is (re-)reported as a
fresh `onCollisionStart`, which is the correct, if slightly delayed, way to surface a transition that
happened while nobody was watching, rather than silently losing it. This flag is Ammo-specific by
design (see the flag's own doc comment) - Rapier2d/3d and matter-js derive these events from a native
start/stop event rather than polling, so they have no equivalent always-on cost and don't need (and
should not get) a matching setting.

## Wiring `bodyType: 'static'`/`'kinematic_pos'`/`'kinematic_vel'` and `ccd`

`AmmoFactory.createRigidBodyFromShape` is the one place all of this is set up - see
`gg-engine-physics-adapter`'s own section on the general `bodyType`/`ccd` contract first.

**Every one of these is a `btCollisionObject` collision *flag* or activation *state*, not something
Bullet derives from `mass` on its own.** `mass === 0` alone (what `bodyType !== 'dynamic'` already
zeroes) makes a body immovable by forces, but `isStaticObject()`/`isKinematicObject()` are backed by
`CF_STATIC_OBJECT`/`CF_KINEMATIC_OBJECT`, two completely separate bits nothing in this package used to
set at all - confirmed empirically (and worth re-checking if this ever regresses): before this was
added, every "static" body in the engine reported `isStaticObject() === false`, so anything reading
that flag (this component's own `debugBodySettings`, `clone()`) silently mislabeled every static body
as dynamic. Fix, both inlined as local numeric constants in `ammo-factory.ts` following the existing
`CF_CHARACTER_OBJECT`/`CF_NO_CONTACT_RESPONSE` convention (Ammo.js's embind bindings only expose these
as a string-keyed type, not real numeric exports - see those two constants' own doc comments):
`CF_STATIC_OBJECT = 1` for `bodyType: 'static'`, `CF_KINEMATIC_OBJECT = 2` for either kinematic
variant. A kinematic body additionally needs `setActivationState(DISABLE_DEACTIVATION)` (`= 4`, same
activation-state constant `AmmoRaycastVehicleComponent`'s chassis body already uses) - without it,
Bullet eventually deactivates a kinematic body that's gone motionless for a while exactly like it would
a resting dynamic one, and a deactivated body ignores further `setWorldTransform` writes.

**The `position`/`rotation` setters (`AmmoBodyComponent`, shared by every body type) DO need to
change for kinematic bodies - a real, reproduced regression, not a hypothetical.** `AmmoRigidBodyComponent`
overrides both setters: for `kinematic_pos`/`kinematic_vel` it writes the new transform to *both*
`nativeBody.setWorldTransform(transform)` **and** `nativeBody.getMotionState().setWorldTransform(transform)`;
every other body type keeps using the base `AmmoBodyComponent` setter (`setWorldTransform` alone), via
`super.position = value`/`super.rotation = value`.

The reason: once `CF_KINEMATIC_OBJECT` is set, Bullet's own `btRigidBody::saveKinematicState` runs once
per internal substep for that body and **overwrites `m_worldTransform` by reading it back out of the
body's motion state** (`getMotionState()->getWorldTransform(m_worldTransform)`) - not from whatever
`btRigidBody::setWorldTransform` was called with directly; those are two independent pieces of state,
and only the motion-state one feeds `saveKinematicState`'s velocity computation (the delta between this
read and the previous step's is what lets the kinematic body correctly push/wake dynamic bodies it
sweeps into). Writing only `nativeBody.setWorldTransform(...)` - correct for `dynamic`/`static` bodies,
since neither of those ever call `saveKinematicState` - is silently overwritten back to whatever the
motion state's *own* stale transform still says (unchanged since the body's construction, since nothing
else ever calls the motion state's `setWorldTransform`) the moment the next `stepSimulation` runs.
Confirmed empirically: a slider-driven moving-platform floor (`bodyType: 'kinematic_pos'`, position
written every tick from a UI slider) switched from `static` to `kinematic_pos` and appeared to fight/
ignore position writes in one direction - the floor could be dragged down but not back up - because
each tick's write was getting silently reverted by the very next physics step. Writing the *same*
transform to both the body and its motion state keeps the synchronous `position`/`rotation` getters
(which read `nativeBody.getWorldTransform()` directly, unaffected by the motion state) consistent
immediately, while giving `saveKinematicState` a real, non-stale delta to compute kinematic velocity
from. There is still no separate "next kinematic transform" API to reach for (unlike Rapier's
`setNextKinematicTranslation`) - the fix is which of Bullet's *two* existing transform slots gets
written, not a different API.

**`kinematic_vel` has no native Bullet equivalent at all** - a `CF_KINEMATIC_OBJECT` body's transform
is only ever moved by explicit `setWorldTransform` writes; Bullet's dynamics solver never integrates a
kinematic body's `linearVelocity`/`angularVelocity` into its position the way it does for a dynamic
body (those fields are still stored and readable, and still matter for contact response - a dynamic
body pushed by a moving kinematic one reads a sensible relative velocity - but nothing auto-advances
the kinematic body's own position from them). Emulated instead by `AmmoWorldComponent.simulate()`,
which keeps its own `kinematicVelBodies: Set<AmmoRigidBodyComponent>` (registered/unregistered by
`AmmoRigidBodyComponent.addToWorld`/`removeFromWorld`) and, once per `simulate()` call - not per
internal substep, since `linearVelocity`/`angularVelocity` are a per-second rate for the whole call
regardless of how many substeps `stepSimulation` splits it into - integrates
`position += linearVelocity · dt` and rotates by `angularVelocity`'s axis/magnitude via `Qtrn
.rotAround`, writing through the same `position`/`rotation` setters an app would use. Because
`kinematic_pos` vs `kinematic_vel` collapse to the identical `CF_KINEMATIC_OBJECT` flag natively,
Bullet has no way to report back which one a body was created as - `AmmoRigidBodyComponent` stores its
own `bodyType` explicitly rather than trying to re-derive it, which `clone()` also depends on.

**`ccd` (dynamic bodies only) uses Bullet's swept-sphere CCD**, `setCcdMotionThreshold`/
`setCcdSweptSphereRadius` - cruder than Rapier's conservative-advancement sweep of the real shape (see
`gg-engine-physics-adapter-rapier`), since Bullet only sweeps an approximating sphere, but it's the
only CCD Bullet has. Both values are derived from the constructed body's own world-space AABB
(`nativeBody.getAabb(aabbMin, aabbMax)`, called right after construction so it's still at the body's
starting transform) rather than hand-computing a shape-specific bounding radius per `Shape3DDescriptor`
variant (`MESH`/`CONVEX_HULL`/`COMPOUND` would otherwise need real vertex-iteration math) - half the
AABB's diagonal as the radius, `motionThreshold = radius` (trigger the sweep once a step's motion
exceeds roughly the body's own size) and `sweptSphereRadius = radius * 0.5` (Bullet's own canonical
CCD setup convention, e.g. its `Kinematic`/`Chains` demos: the swept sphere approximating the moving
shape is smaller than the shape itself, not equal to it).

## Keep this skill current

This file is read by future agents fixing/extending `packages/ammo` specifically, not by end users of
the engine. If Ammo/Bullet's API fights the mapping described in `gg-engine-physics-adapter` in some
new way, or something written here turns out wrong/incomplete once you've actually worked with it, add
a short note (what went wrong, why, the fix) before finishing, folded into the relevant section rather
than left as a loose log entry.
