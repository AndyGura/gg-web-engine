---
name: gg-engine-physics-adapter-rapier
description: Known, already-solved implementation pitfalls specific to packages/rapier2d and packages/rapier3d (the @dimforge/rapier-compat physics adapters) - broad-phase registration timing, native character-controller feature interactions, WASM-bindgen import/build gotchas, Jest/jsdom setup. Use when fixing or extending packages/rapier2d or packages/rapier3d itself, not when building a new physics adapter from scratch (see gg-engine-physics-adapter for the general contract every adapter implements).
---

# packages/rapier2d and packages/rapier3d implementation notes

This file is Rapier-specific (`@dimforge/rapier2d-compat`/`@dimforge/rapier3d-compat`) history: real
bugs hit and fixed while building these two packages, kept here so nobody re-discovers them from
scratch while touching either one again. Read `gg-engine-physics-adapter` first for the general
interface contract (`IPhysicsWorldComponent`, `ICharacterController(2d|3d)Component`, the
`removeFromWorld(dispose)` contract, etc.) - everything below assumes that contract and only covers
where Rapier's own native API/build made it non-obvious to satisfy. `Rapier2dCharacterControllerComponent`
mirrors `Rapier3dCharacterControllerComponent` near-verbatim (Rapier's own
`KinematicCharacterController`/`computeColliderMovement`/`computedGrounded`/`computedCollision` API is
essentially identical between `@dimforge/rapier2d-compat` and `@dimforge/rapier3d-compat` - `Vector2`/a
plain scalar rotation instead of `Vector3`/`Quaternion`, otherwise the same method names and semantics)
- so most of the character-controller pitfalls below apply to both packages even though they were
each found on one specific side first; sections that genuinely don't apply to the other dimension say
so explicitly.

## The `removeFromWorld(dispose)` contract, Rapier specifics

Rapier's native handles are WASM objects reference-counted per-call, not something this package needs
to track manually across calls: every rigid-body/trigger/character-controller/raycast-vehicle
`removeFromWorld` unconditionally frees its native handles regardless of the `dispose` flag -
`addToWorld` always recreates them fresh from stored descriptors (or, for a raycast vehicle, from its
own wheel list - see below), so eager freeing on every removal is both safe and cheap to undo.
`dispose?: boolean` is accepted purely for interface conformance (and each `dispose()` passes `true`
through to `removeFromWorld` for self-documentation), but the parameter doesn't change behavior
anywhere in this package.
Because `addToWorld` rebuilds from the stored `RigidBodyDesc`, `removeFromWorld` first writes the
native body's live translation/rotation (and, for rigid bodies, linear/angular velocity) back into
`_bodyDescr`; the `position`/`rotation`/velocity getters read `_bodyDescr` while the body is out of
the world. Without that write-back the descriptor still holds the spawn pose, and a body that is
removed and added again (`IEntity.addChildren` reparenting an already-spawned entity, a network layer
hiding an entity) reappears where it was created. `test/components/rapier-*-rigid-body-readd.spec.ts`
in both packages cover it.
`Rapier3dRaycastVehicleComponent.removeFromWorld` is the one component whose native state includes a
handle beyond the ordinary rigid-body/collider pair - its vehicle controller needs both
`removeVehicleController` (unregisters it from the world) *and* an explicit `.free()` (releases its own
native handle, which nothing else ever reaches) every time, not only when `dispose` is `true`.

## Sleeping bodies silently ignored programmatic transform/velocity writes (3D; 2D shares the same native API and is worth checking too)

See `gg-engine-physics-adapter`'s general contract note on this (the cross-adapter version of the
bug, with the regression-test recipe). The Rapier-specific fact worth recording here: this package's
own rigid-body setters were the direct cause, not an oversight elsewhere - Rapier's `RigidBody.setTranslation`/
`setRotation`/`setLinvel`/`setAngvel` all take an explicit trailing `wakeUp: boolean` argument (the
native API makes the choice visible, unlike Bullet's - see `gg-engine-physics-adapter-ammo`), and
`Rapier3dRigidBodyComponent`'s four setters all passed `false`. A sleeping body's island is skipped
entirely by Rapier's own `step()` regardless of what its translation/velocity is set to, so this
silently no-opped every write to a body that happened to be asleep at the time - found live via
`Grabbable3dEntity` (core): a prop resting on a pedestal long enough to sleep completely ignored
every per-tick `updateHold()` velocity write and stayed frozen, even though the component's own
getters read back whatever was just (uselessly) set. Fix: pass `true` in all four setters.
`resetMotion()`'s own direct `setAngvel`/`setLinvel(..., false)` calls were deliberately left as
`false` - it's clearing a body's motion right before/after a teleport, not asking it to move, so
there's no obvious need to force a wake there; revisit only if a similar frozen-body symptom is ever
reported for a body going through `resetMotion` specifically.

## `IRigidBodyComponent.isSleeping`/`wakeUp()`/`sleep()`: native `RigidBody` methods, no adapter logic needed

Both packages' rigid-body components map these three straight onto `RigidBody.isSleeping()`/
`.wakeUp()`/`.sleep()`, which this pinned `@dimforge/rapier{2,3}d-compat` build already exposes with
exactly matching semantics - no polling/derivation needed the way some other interface members on
this component require. `isSleeping`/`wakeUp()`/`sleep()` are each gated on `this._bodyDescr.status
!== RigidBodyType.Fixed` (a `Fixed`/static body always reports `isSleeping: false`, and the other two
are no-ops on one, per the interface's own contract) rather than querying the native body for this -
`_bodyDescr.status` is already this component's own source of truth for `bodyType` elsewhere (see
`bodyOptions`'s own doc), and a body that hasn't been `addToWorld`'d yet has no `_nativeBody` to query
at all, so `isSleeping` also short-circuits to `false` whenever `_nativeBody` is still `null`.

`RigidBody.sleep()` forces the sleep flag immediately and unconditionally, regardless of whatever the
world's own automatic sleep-from-inactivity behavior is doing for other bodies at the time - useful
for testing this API directly (`sleep()` then assert `isSleeping`) without needing a body to actually
go idle long enough to fall asleep on its own first. `debugBodySettings`'s own `RIGID_DYNAMIC` variant
now reads `() => this.isSleeping` instead of calling `this._nativeBody?.isSleeping()` a second,
separate way - one source of truth for whether a body reads as asleep, whether from the debug view or
from `IRigidBodyComponent.isSleeping` directly.

## Pitfall: a freshly-created collider is invisible to sweeps/raycasts until the world steps once

Hit implementing `Rapier3dCharacterControllerComponent`: calling `move()` immediately after creating
both the character and its floor/wall geometry (no `world.step()`/`simulate()` ever having run) always
returned the full, uncollided desired translation - the sweep silently found nothing to hit. This is
not specific to character controllers: the exact same thing happens to `Rapier3dWorldComponent.raycast()`
against a same-tick-created collider (confirmed empirically; it's why the existing raycast tests in
`rapier-3d-world.component.spec.ts` all call `world.simulate(1)` before raycasting), and the same
quirk exists in `packages/ammo`'s pinned Ammo.js build too (see `gg-engine-physics-adapter-ammo`). In
this pinned `@dimforge/rapier3d-compat` build, a collider's AABB only actually enters the broad-phase
as part of running `World.step()` at least once - there is no `QueryPipeline`/`updateSceneQueries()`-
style "just rebuild the query structure" call exposed on this version (older Rapier releases and some
example code floating around *do* have a separate `QueryPipeline` object with an `update()`/
`updateSceneQueries()` method - that API does not exist on the version actually pinned here; check
`node_modules/@dimforge/rapier3d-compat/dist/pipeline/world.d.ts` directly rather than trusting an
example project's `node_modules`, which may have resolved a different/newer build under the same
version string). The fix used for keeping `move()` itself synchronous (re-propagating collider
transforms after directly setting a kinematic body's translation) is
`World.propagateModifiedBodyPositionsToColliders()` - but that call only re-syncs a collider's
position from its already-registered parent body; it does not newly register a collider that has
never been through a `step()` at all. Practical implication: a level's static geometry (or the
character itself) needs at least one `physicsWorld.simulate()` call - even `simulate(0)`, a
zero-length timestep works fine and moves nothing - sometime after being added and before the first
`move()`/`raycast()` that depends on seeing it; a normal per-frame game loop already satisfies this
after its first tick, so this only bites synthetic same-tick test setups (see the test file for how to
structure a `settleWorld()` no-simulate()-in-between-moves helper around it) or a character spawned and
moved on the very first frame before physics has ever ticked once.

## Pitfall: *two separate* native features silently cancel a jump - fixing only snap-to-ground isn't enough

Rapier's `KinematicCharacterController` has its own built-in `enableSnapToGround(distance)` (used to
follow slopes/stairs down without briefly going airborne each step - see the option-mapping guidance
in `gg-engine-physics-adapter`), left enabled unconditionally at construction. It applies inside
`computeColliderMovement` itself, with no notion of "this tick's movement is a deliberate jump takeoff,
don't snap it back down" - a jump's own per-tick rise (`jumpSpeed * dt`) starts out far smaller than
the default `0.3` snap distance, so every jump was silently cancelled the moment it started (visible
as: `jump()` correctly sets internal takeoff velocity, `move()` even receives a `desiredTranslation`
with the right upward component, but the character's height never actually changes tick to tick) -
this is the exact same failure mode `gg-engine-physics-adapter-ammo` documents for Ammo's own
hand-rolled ground-snap fallback, just triggered by a *native* engine feature instead of adapter-
written code, so it's easy to overlook that the same guard is still needed. Fix: mirror the Ammo
adapter's `movingUp` check - at the top of `move()`, before calling `computeColliderMovement`, check
whether `desiredTranslation` has a positive component along `up`; if so call `disableSnapToGround()`
for this call, otherwise `enableSnapToGround(snapToGroundDistance)` (skip entirely if that option is
`0`).

**This alone looked like the whole fix (an open-field jump - nothing to collide with horizontally -
worked perfectly with just this change) but wasn't**: `enableAutostep(maxStepHeight, minStepWidth,
...)`, also left enabled unconditionally, needs the identical guard for a related but distinct reason,
and only misbehaves under a second, easy-to-miss condition - jumping *while simultaneously blocked
horizontally* by something taller than `maxStepHeight` (running at a tall obstacle and jumping right as
you reach it, not jumping in open space, and not jumping stationary somewhere with nothing in front of
you either). Symptom with only the snap-to-ground fix in place: a jump attempted in the open arced
perfectly, but the *identical* jump attempted pressed up against such an obstacle turned into a small
up-then-snap-back-down "flick" - the rise stopping right around `maxStepHeight` itself (a very
recognizable number once you know to look for it) before reverting to standing height, even though
snap-to-ground was already correctly disabled that whole time. Autostep's own "raise up to
`maxStepHeight`, retry the blocked horizontal move, keep the raise only if that retry actually clears"
evaluation runs as part of the very same `computeColliderMovement` call that's also carrying the jump's
vertical component - when the retry still doesn't clear (the obstacle is taller than the autostep
raise), whatever it does to "give back" the failed step attempt isn't scoped to only the horizontal
axis, so it cancels the deliberate vertical rise sharing that same call too. There's no real reason to
want auto-step-climbing active while already deliberately jumping regardless, so disable it under the
exact same `movingUp` condition as snap-to-ground (both toggle together, one `if`/`else`). Toggling
both every call this way is cheap and keeps normal stair-climbing/downhill-snap behavior intact for
every tick that isn't actively rising.

The practical lesson for testing a fix like this: **a jump that works perfectly in open space is not
sufficient evidence the fix is complete** - specifically test jumping while pressed against/blocked by
a tall obstacle too (this repo's own `3d/player-character`/`-rapier3d` demo scene ships a
`JumpBarrier` purpose-built for exactly this), since that's the condition that exposes a second native
feature interacting with the same code path that an open-field test can't reach at all. Also test the
*realistic* version of that scenario (running at the obstacle from a normal approach distance and
timing the jump to clear it, matching how a player actually plays) rather than only the exaggerated
"standing already pressed flush against it" version - the latter is useful for finding the bug (it
reproduces most reliably) but can also surface a narrower, expected-ish artifact of its own unrealistic
starting condition (e.g. the character's own capsule silhouette brushing the obstacle's top corner
while rising, if it's rising from a position already overlapping/touching the obstacle) that isn't the
actual bug and isn't what a real player would ever trigger - don't chase that part further once the
realistic approach-and-clear scenario is confirmed working end-to-end.

## Pitfall: `computedGrounded()` can stay stuck `true` for several ticks after a jump takeoff at high frame rate, re-cancelling the jump even with the `movingUp` guard above already in place

Even with the snap-to-ground/autostep guard above correctly disabling both for every tick that's
moving up, a jump could still fail intermittently depending on frame rate alone - working fine at a
typical/capped frame rate (e.g. 60fps, `dt` ~16ms) but reliably flinching up a few centimeters and
snapping straight back down at a high, uncapped frame rate (100+ fps, `dt` ~8ms or less), on the exact
same jump/gravity/obstacle setup. Root cause is in `KinematicCharacterController.computedGrounded()`
itself, not in this adapter's own toggling: empirically (confirmed by direct `move()` calls with no
entity-level logic involved at all, sweeping a character straight up by a fixed distance with zero
obstacles and zero recorded collisions), `computedGrounded()` keeps reporting `true` for any per-call
upward movement smaller than roughly 5-6x the character's own `offset` value (the default `offset`
~0.01 giving a threshold around 0.05-0.06m in this pinned `@dimforge/rapier3d-compat` build) -
apparently some internal ground-detection margin proportional to `offset`, independent of
`snapToGroundEnabled()`/`autostepEnabled()` and unrelated to `numComputedCollisions()` (which stays
`0` throughout). At a high frame rate, a jump's first-tick rise (`jumpSpeed * dt`) is small enough to
land inside that dead zone, so `computedGrounded()` still reads `true` right after a takeoff tick that
otherwise moved the character exactly as far as requested. At a low-enough frame rate the same
first-tick rise already clears that dead zone in one tick, so this never surfaces there - this is why
the bug is invisible in the package's own `dtMs=16` integration tests and only shows up against real,
uncapped browser frame rates.

This compounds through `CharacterController3dEntity` (core, not this package) into the exact same
"flinch up, snap back down" symptom as the guard above: that entity's own `_justJumped` exemption used
to clear itself unconditionally one tick after `jump()`, regardless of what the adapter's `isGrounded`
said by then. With `computedGrounded()` stuck `true` past that one tick, the *second* post-jump tick's
`restingOnGround` read `true` again, zeroed `_fallVelocity` outright, and produced a `desiredTranslation`
with no vertical component that tick - which flips this adapter's own `movingUp` check back to `false`
and *re-enables* snap-to-ground, snapping the (still only centimeters up) character straight back onto
the floor. Both native toggles were already correctly guarded; the entity above them was still trusting
a native flag one tick too early. Fixed at the core level (not here) - `_justJumped` now stays set across
every tick where `restingOnGround` is still (incorrectly) `true`, not just the takeoff tick, and is only
cleared the first tick `restingOnGround` genuinely reads `false`; see
`CharacterController3dEntity._justJumped`'s own doc in `packages/core` for the full reasoning. Nothing
to fix in this package for that specific bug, but worth knowing about since it's easy to mistake for a
regression in the `movingUp` guard above when it resurfaces - the tell is that it's frame-rate-dependent
(reproduces at high/uncapped fps, not at a fixed low one) rather than obstacle-dependent like the
autostep pitfall above. When testing a character-controller jump fix in this package, drive at least one
test at a small `dt` (~8ms, i.e. ~120fps) in addition to the usual 16ms - a fix that only holds at 16ms
can still hide this class of bug entirely.

## Pitfall: `computeGroundNormal()` reporting a flattened `up` instead of the real (steep) contact normal defeats `isWalkableGround` - a character can get permanently stuck balanced on a curved obstacle

Symptom: run/jump onto the flank of a static sphere (or any other curved obstacle) high enough up that
the actual contact point is well past `maxSlopeClimbAngleRad`'s slope limit, then release every input
key - the character should slide back down under gravity (core's `CharacterController3dEntity` already
refuses to treat a too-steep contact as "resting", see its `isWalkableGround`, and keeps integrating
gravity in that case instead of zeroing it), but instead it stays stuck exactly where it landed,
sometimes visibly balanced on a sliver/single point of the obstacle, indefinitely - even with zero
input and gravity nonzero. This is `packages/rapier3d`'s own equivalent of
`gg-engine-physics-adapter-ammo`'s "a character can get stuck jittering against a too-steep slope"
pitfall, but the root cause here is different: it's not a missing slide-along-tangent step (Rapier's
own `computeColliderMovement` already slides along the contact tangent as part of its built-in
algorithm), it's `Rapier3dCharacterControllerComponent.computeGroundNormal()` misreporting the contact
normal itself, feeding core's `isWalkableGround` a lie.

Root cause, two layers deep:

1. `computeGroundNormal()` used to discard any `computedCollision()` candidate whose `dot(normal, up)`
   didn't clear a loose `0.1` threshold (meant to separate "floor-like" from "wall-like" hits sharing
   the same collision list), falling back to the plain `up` vector when nothing cleared it. For a
   contact steep enough to fail *that* threshold too (not just `maxSlopeClimbAngleRad`), this silently
   reported perfectly-flat ground instead of the real, very steep normal that was already sitting right
   there in the collision list. Fix: never discard a candidate for being steep - collect every
   `computedCollision()` normal and return whichever one is *closest* to `up` (however far from it that
   still is); let `CharacterController3dEntity.isWalkableGround` alone decide walkability from the real
   value, that's its job, not this adapter's.
2. Even with that fixed, the dominant real-world trigger turned out to be a *different* path to the same
   flat-`up` fallback: `numComputedCollisions()` is `0` on the vast majority of ticks a character spends
   resting on any surface, curved or flat - `computeColliderMovement` only populates that list when the
   *desired* movement this call was actually blocked by something, and a character standing still
   (`desiredTranslation` exactly `{0,0,0}`, e.g. every idle tick right after the player releases every
   key) has nothing for the sweep to hit; it stays grounded purely via Rapier's own snap-to-ground
   catching it call after call, with no fresh collision entry ever produced again. The very first idle
   tick after any landing - including the landing that *did* just populate the true steep normal -
   already falls into this path and re-triggers the bug immediately. Confirmed empirically (a direct,
   entity-free `move()` sequence: one real settling move onto a sphere's flank correctly reports the
   steep normal, the very next `move({x:0,y:0,z:0})` no-op tick reports flat `up` again, with old code).
   Fix: on a `0`-collision grounded call, reuse whichever normal `this._groundNormal` already held
   *before* this call instead of guessing - `move()` only overwrites the field with this method's
   return value *after* calling it, so reading `this._groundNormal` inside `computeGroundNormal()`
   still sees the previous call's real result. This need not be a separate cache field: the field
   naturally clears to `null` the instant the character goes airborne (the method's very first check),
   so a later landing on a *different* surface never reuses a stale value from an unrelated one. Only
   fall back to plain `up` when there is truly no prior normal to reuse either (the very first grounded
   call ever, landing exactly via snap with nothing recorded yet).

Layer 2 is the one worth remembering if this resurfaces: a fix that only addresses "pick the best
available normal, don't apply the loose threshold" (layer 1 alone) still fails, because the character
gets re-stuck on literally the next idle tick regardless - test with a scenario that includes several
ticks of **zero player input after landing** (not just the landing tick itself), matching how a real
player actually triggers this (run onto the obstacle, then let go of every key), not only a single
settling `move()` call - a test that only checks the immediate landing tick's normal can pass while the
underlying bug (which manifests one tick later, every time) is still very much present.

## Pitfall (2D only, `packages/rapier2d`): `computeColliderMovement` can fully block horizontal movement, direction-dependently, whenever `desiredTranslation` mixes a horizontal component with *any* non-zero downward one

Symptom reported live: in a side-scroller demo, walking one horizontal direction worked fine
indefinitely, but walking the other direction got the character stuck at a fixed position after a few
steps - not sliding, not jittering, just frozen - and jumping (which takes a different code path
through `move()`, see below) immediately unstuck it. This is `Rapier2dCharacterControllerComponent`'s
own instance of a native `KinematicCharacterController.computeColliderMovement` bug in this pinned
`@dimforge/rapier2d-compat` build (`0.20.0`), not a level-geometry or gameplay-logic issue - it
reproduces on a single infinite flat floor with nothing else in the scene.

Root cause, confirmed empirically by feeding synthetic `desiredTranslation` vectors directly to a
`move()` call (bypassing `CharacterController2dEntity` entirely) at a character resting flush on a
flat floor: a **pure** horizontal or **pure** vertical `desiredTranslation` (the other axis' component
bit-for-bit `0`) always sweeps correctly, at any magnitude. A **mixed** vector - both axes non-zero at
once - returns an almost-exactly-zero `computedMovement()` for the *entire* movement (horizontal
included), for *any* non-zero downward component down to ~1e-16 (float noise magnitude), regardless of
`enableSnapToGround`/`enableAutostep` being on or off, regardless of how large the desired horizontal
distance is, and regardless of there being no actual obstacle in that direction
(`computedCollision(0)`'s own normal in this state is still flat, near-`up`, not a wall). This is not
about proximity to the floor either - moving the character's body into open space first and repeating
the same mixed-vector sweep still returns near-zero, ruling out a stale broad-phase/collider-transform-
sync effect (see the "freshly-created collider" pitfall above); a mixed vector fails in open space too.
Whatever this degenerate result resolves to for a given exact flush-contact configuration is direction-
dependent (which horizontal sign gets "stuck" versus "recovers next tick" was observed to depend on the
exact numeric position, not consistently left-vs-right) *and self-reinforcing*: a resolution of "fully
blocked" leaves the position completely unchanged, so the identical degenerate input recurs next tick
too - this is why the character stays frozen indefinitely rather than un-sticking on its own after a
tick or two.

**Why a mixed vector reaches `move()` at all during ordinary walking**, given
`CharacterController2dEntity` only adds a vertical component to `desiredTranslation` while genuinely
airborne (`_fallVelocity` is exactly `Pnt2.O` while `grounded` is `true`): `computedGrounded()` was
observed to read `false` for one or two ticks immediately after horizontal movement starts from rest
(a native jitter, not itself investigated further here - possibly related to the "`computedGrounded()`
can stay stuck `true`" pitfall above but in the opposite direction), which is enough for
`CharacterController2dEntity` to integrate one or two ticks of real (non-noise) gravity before
`computedGrounded()` reports `true` again - exactly the mixed diagonal `desiredTranslation` this bug
needs, reached from perfectly ordinary walking, not just adversarial input. Floating-point noise alone
(e.g. `2.65e-16` left over from `Pnt2.add`/`scalarMult` arithmetic upstream, on an axis the caller
considers "zero") is also sufficient to trigger it once the character is in a susceptible flush-contact
configuration - confirmed by bisecting the vertical component's magnitude down to `1e-16` at a fixed
position and finding the block persists at every tested magnitude above exact `0`, changing only with
sign.

**Fix**: `move()` never hands the native controller a mixed vector. It splits `desiredTranslation` into
`horizPart`/`vertPart` (projections onto/off `up`, each constructed so the *other* axis is exactly
`0` - not just small, since even a `1e-16` residual on the "zero" axis is what triggers this) and sweeps
them as two separate single-axis `computeColliderMovement` calls when both are non-negligible:
horizontal first (with `enableSnapToGround`/`enableAutostep` exactly as already decided by the
`movingUp` check, so ground-following on a downward step/slope while walking still works, matching the
purely-horizontal case that never reproduces this bug), then any remaining vertical intent (fall/jump
takeoff/snap-glue) as its own pure-`up` sweep from the post-horizontal position. Even the common
single-axis-only path (the overwhelming majority of ticks) sweeps with `horizPart`/`vertPart` rather
than raw `desiredTranslation`, since that raw vector's own "unused" axis is exactly the kind of noisy
near-zero value this bug treats as non-zero.

**Implementation gotcha hit while building the two-phase split**: each phase must apply its own
`computedMovement()` to the body (via `setTranslation`/`setNextKinematicTranslation` +
`propagateModifiedBodyPositionsToColliders()`) *before* the next phase's sweep, since
`computeColliderMovement` reads the collider's live transform - but the *final* position write must
never be derived by re-reading `this._nativeBody.translation()` after an earlier phase already moved
it and adding the accumulated `computed` on top again, or that phase's movement gets double-counted
(caught by the existing `'should step up a ledge shorter than maxStepHeight without getting stuck'`
regression test suddenly advancing at roughly 2x the intended per-tick distance during a full rewrite
of `move()`). The fix that stuck: capture the tick's starting `translation()` exactly once, have every
phase recompute the body's position as `start + (running total of computedMovement so far)`, and never
re-read `translation()` as a basis for accumulation mid-tick.

Only confirmed and fixed on `packages/rapier2d`; not independently re-verified on
`packages/rapier3d`'s equivalent `move()`, which still sweeps `desiredTranslation` as a single 3D
vector - if a similar direction-dependent stall is ever reported there, the same two-phase
(horizontal-plane-then-vertical) split is the natural thing to try first, but 3D's extra horizontal
degree of freedom (a full plane instead of a single scalar) would need its own investigation before
assuming the exact same fix applies unchanged.

## Pitfall: the native dynamic-body-push feature is unusable on a kinematic character body - it explodes, not just mis-scales

Rapier's `KinematicCharacterController` has a built-in, seemingly ideal equivalent of `pushMass`:
`setApplyImpulsesToDynamicBodies(true)` + `setCharacterMass(mass)`, computing a momentum-aware impulse
against dynamic bodies hit during `computeColliderMovement` - no hand-rolled push logic needed, unlike
Ammo's ghost-based mover (which has no native equivalent at all - see `gg-engine-physics-adapter-ammo`).
It looks like the obvious, correct way to implement `pushMass` support for this adapter. **Do not use
it as-is on a `kinematicPositionBased()` character body**: confirmed empirically, enabling it here
doesn't just get the mass scaling backwards (a *heavier* box ending up moving *further* than a lighter
one at otherwise identical settings) - it genuinely explodes. A pushed box's position jumped by 5+
meters in a single 16ms tick and kept climbing indefinitely, tick after tick, never settling - not a
one-off spike, a runaway. Root cause not fully isolated from JS (plausibly `setCharacterMass`'s
override interacting badly with this body's own `mass()`, which a kinematic body reports as `0`,
somewhere inside Rapier's impulse resolution - this package's pinned `@dimforge/rapier3d-compat` build
doesn't expose enough of that internal state to debug further); ruled out as an ordering/setup mistake
on this side by testing several variations (toggling the character's own collider between
sensor/non-sensor made no measurable difference to either the explosion or the mis-scaling, so it isn't
a "native kinematic-vs-dynamic collision response double-counting with the impulse feature" issue
either, or at least not solely that). **Fix used**: don't call either method at all; implement
`pushMass` by hand instead, mirroring `AmmoCharacterControllerComponent.pushDynamicBody`'s formula and
contract exactly (same inelastic-collision-against-a-virtual-mass model, same `pushMass <= 0` "disable
pushing" convention, only ever *adding* velocity along the push direction) - see
`gg-engine-physics-adapter-ammo` for the formula/`dt`-handling details, which apply identically here.
The one native piece still worth keeping: `computeColliderMovement` already populates
`numComputedCollisions()`/`computedCollision(i)` on every `move()` call regardless of whether the
impulse feature is enabled, so the hand-rolled version needs no extra sweep/query of its own to find
out what got hit - see `Rapier3dCharacterControllerComponent.pushDynamicBodies` for the full
implementation. This residual gap is worth knowing about for anyone tempted to revisit it later: even
with the hand-rolled push in place, a mid-mass box occasionally reads a *bit* faster than the plain
formula predicts and visibly tips up onto an edge/corner instead of staying flat (the light and heavy
ends of the mass range track the formula closely) - a secondary, non-explosive effect, most likely
genuine box-tipping physics from the push contact point not being centered, not a repeat of the
impulse-feature bug; not chased further since it doesn't reach anywhere near the older bug's severity
and the core "pushing works, mass roughly matters" behavior holds.

## `Rapier3dCharacterControllerComponent.name` defaults to `''`, like every other adapter's body

Every native body component across every adapter (`AmmoBodyComponent`, the Rapier rigid-body
components, `MatterRigidBodyComponent`, etc.) defaults its `name` field to `''`, since core's
`Entity3d`/`Entity2d`/`CharacterController3dEntity` only adopt a native component's `name` when
it's non-empty, otherwise keeping the entity's own auto-generated fallback name (see
`gg-engine-core-development`'s "Entity naming" section). `Rapier3dCharacterControllerComponent`
used to default to the literal string `'character-controller'` instead - harmless with a single
character, but every additional player character spawned in the same world (e.g. via the
`player_spawn` console command, or multiplayer) got the exact same non-unique name, breaking
`getEntityByName` lookups for all but the first. Now defaults to `''` like every other adapter's
body component; don't reintroduce a non-empty static default here or in a future adapter's
character-controller component.

## Don't import a WASM-bindgen native library's internal file paths

`packages/rapier3d/src/components/rapier-3d-rigid-body.component.ts` imported `InteractionGroups` via
`@dimforge/rapier3d-compat/geometry/interaction_groups` (a deep subpath into the package's internal
file layout) instead of the package's own root export. This happened to keep resolving under
`moduleResolution: "node"` (classic resolution ignores a package's `exports` map and does a raw
filesystem lookup) for a while after the `0.0.0-...` prerelease → `0.20.0` upgrade, because a stale
copy of the old package layout lingered in `node_modules` across several `npm install` runs - `npx tsc
-b` only started failing with `TS2307: Cannot find module` once a fully fresh install actually replaced
it, well after the adapter's own build/test pass had already been signed off as green. `0.20.0`'s
package.json `exports` map only declares the root `"."` entry point; the deep path doesn't exist at
that location any more (everything moved under `dist/geometry/...`), but the type is re-exported from
the package root regardless (`export * from "./geometry"` in the compat package's own root barrel).
Fix: `import { InteractionGroups } from '@dimforge/rapier3d-compat'` (merge into whatever other symbols
are already imported from the package root) - never import a native/WASM-bindgen dependency's internal
subpaths; only import what its own root barrel/exports map actually re-exports, and re-check this
specifically after any version bump of such a dependency (this applies equally to `rapier2d`'s
`@dimforge/rapier2d-compat`), since a lucky stale-`node_modules` resolution can hide the breakage for a
while.

## Wiring `bodyType: 'kinematic_pos'`/`'kinematic_vel'` and `ccd` (both packages)

`RigidBodyDesc.kinematicPositionBased()`/`.kinematicVelocityBased()`/`.setCcdEnabled(bool)` all map
directly onto `BodyOptions.bodyType`/`ccd` (see `gg-engine-physics-adapter`'s own section on this) -
Rapier already has real, first-class native support for all three, unlike Ammo (see
`gg-engine-physics-adapter-ammo`) or matter-js (see `gg-engine-physics-adapter-matter`), so there's no
warn-and-fallback path needed in either of these two packages. Two things worth knowing before
touching this again:

- **A `kinematicPositionBased` body's `position`/`rotation` setters must branch to
  `setNextKinematicTranslation`/`setNextKinematicRotation` instead of the ordinary
  `setTranslation`/`setRotation` an immediate teleport uses** (checked via `nativeBody.bodyType() ===
  RigidBodyType.KinematicPositionBased`) - this is the exact same mechanism
  `Rapier3dCharacterControllerComponent.move()` already uses (see the "freshly-created collider"
  pitfall above for the general "kinematic moves need a world step to take effect" caveat that
  applies here too), just now needed by a plain rigid body as well, not only the character
  controller. Using the immediate-teleport setter instead compiles and even visually looks right for
  the kinematic body's own motion, but silently loses the "derive this step's effective velocity from
  the transform change" bookkeeping Rapier needs to correctly push/wake dynamic bodies the kinematic
  body moves into - exactly the "moving a fixed body doesn't push resting bodies correctly" symptom
  `bodyType: 'kinematic_pos'` exists to fix in the first place, so getting this branch wrong quietly
  defeats the entire feature while still looking correct in isolation. `kinematicVelocityBased`
  bodies don't need this - they're already driven by the existing `linearVelocity`/`angularVelocity`
  setters, which work unchanged for a kinematic body the same as a dynamic one.
- **`RigidBodyDesc.ccdEnabled` is a plain field, not something `RigidBodyDesc`'s constructor copies
  from another descriptor.** `Rapier3dRigidBodyComponent.factoryProps` (used by `clone()`) rebuilds a
  fresh `RigidBodyDesc` from the original's `status`/`mass`/`translation`/`rotation` - `ccdEnabled`
  silently dropped off every clone of a CCD-enabled body until an explicit `bd.setCcdEnabled(this
  ._bodyDescr.ccdEnabled)` was added alongside the other fields. The same goes for each rebuilt
  `ColliderDesc`'s `activeEvents`/`activeCollisionTypes`/`isSensor`: without them a clone reports no
  collisions. A test has to collide two clones, because Rapier reports a contact when either collider
  asks for events (`rapier-3d-rigid-body-clone.spec.ts`). `Rapier2dRigidBodyComponent
  .factoryProps` doesn't have this problem - it returns the *same* `RigidBodyDesc` instance rather
  than reconstructing one, so nothing needs copying there; don't assume the two packages' `clone()`
  work identically just because their public shape matches.

## Jest 30 / WASM-backed adapter pitfalls (hit upgrading `rapier2d`/`rapier3d` off a 2024 prerelease build)

Applies to both packages (each has its own `jest` config/`node_modules`):

- **jsdom + `jest-environment-jsdom` 30 no longer exposes `TextEncoder`/`TextDecoder` as globals inside
  the jsdom sandbox.** `@dimforge/rapier{2,3}d-compat`'s wasm-bindgen-generated glue calls `new
  TextDecoder(...)` at module top level (unconditionally, at import time), so merely importing anything
  from the adapter package inside a jsdom test throws `ReferenceError: TextDecoder is not defined`
  before any test body runs. Fix: add a `test/jest-polyfills.ts` (or `test/jest.polyfills.ts`) that
  copies `TextEncoder`/`TextDecoder` from Node's `util` module onto `globalThis`, and wire it in via
  `"setupFiles": ["<rootDir>/test/jest-polyfills.ts"]` in the package's `jest` config block - it must
  run before anything requires the WASM glue. Any wasm-bindgen-based native library (not just rapier)
  is liable to hit this the same way.
- **Never drive a rapier `EventQueue`/trigger-overlap test with one giant `world.simulate(bigMs)`
  step.** `world.step()` computes collision/intersection events from body positions as of the *start*
  of that step and integrates positions at the very end, so a single huge timestep produces a visible
  one-step detection lag for anything that both enters and needs to be observed within that same call -
  this became visible upgrading `@dimforge/rapier{2,3}d-compat` from a mid-2024 prerelease build to the
  `0.20.0` stable release (verified empirically against the real WASM engine; not a bug in
  `Rapier{2,3}dTriggerComponent`). Relatedly, `EventQueue` constructed with `autoDrain: true` clears any
  undrained events right before the *next* `step()` call, so `checkOverlaps()`/`drainCollisionEvents`
  must be called after **every** `simulate()`, not once after a batch of steps, or interior events are
  silently lost - this is a correctness requirement for any real consumer of this API (a per-frame game
  loop already does this naturally), not just a test artifact. Write trigger tests as small (e.g. 10ms)
  simulate-then-check steps in a loop rather than jumping to a checkpoint with one large timestep.

## `ignoredBodies` (2D and 3D): Rapier's own `filterPredicate` does this natively, no broadphase-detach trick needed

`Rapier3dCharacterControllerComponent.ignoredBodies` (a `Set<Rapier3dRigidBodyComponent>`,
`Rapier2dCharacterControllerComponent.ignoredBodies` on the 2D side identically) is
implemented via `KinematicCharacterController.computeColliderMovement`'s own optional 5th argument,
`filterPredicate?: (collider: Collider) => boolean` - return `false` to exclude a candidate collider
from that one call, no persistent state or collision-group changes needed. This is meaningfully
simpler than `AmmoCharacterControllerComponent`'s equivalent (see `gg-engine-physics-adapter-ammo`'s
own note), which has to fake the same effect by temporarily pulling ignored bodies out of the
collision world's broadphase, since this pinned Ammo.js embind build exposes no such native predicate
hook on `convexSweepTest`/`contactTest`. Build the exclusion set fresh each `move()` call from
`RigidBody.handle` (a plain numeric id) rather than comparing `Collider`/`RigidBody` object identity -
`collider.parent()` isn't guaranteed to return the same wrapper instance across calls on this pinned
`@dimforge/rapier3d-compat` build, only the same underlying native body. Skip building a predicate at
all (pass `undefined`, not an always-`true` closure) when `ignoredBodies` is empty, the common case -
keeps the ordinary per-tick cost at zero for a character that never interacts with this feature.
Because `computedCollision()` (used by this component's own `pushDynamicBodies`) is populated by the
very same `computeColliderMovement` call, an excluded body simply never appears there either - no
separate filtering needed on the push side, unlike a hand-rolled mover where movement-sweep exclusion
and penetration-recovery exclusion are two separate code paths that both need it (again, see the Ammo
note).

## `IRigidBodyComponent.onCollisionStart`/`onCollisionEnd` (2D, implemented in `packages/rapier2d`): draining must be centralized in the world component, not left to each trigger

`Rapier2dWorldComponent.simulate()` now drains the world's single `EventQueue` itself, right after
`world.step(eventQueue)`, and routes every `(collider1Handle, collider2Handle, started)` transition to
whichever component(s) it involves - a sensor-overlap transition (either side a
`Rapier2dTriggerComponent`) goes to that trigger's own `handleOverlapEvent` (backing
`onEntityEntered`/`onEntityLeft`), a real contact transition between two plain rigid bodies goes to
both sides' `handleCollisionStart`/`handleCollisionEnd` (backing the new `onCollisionStart`/
`onCollisionEnd`). This replaces the previous design where `Rapier2dTriggerComponent.checkOverlaps()`
itself called `drainCollisionEvents` every time `Trigger2dEntity` ticked it.

That change was load-bearing, not cosmetic: `drainCollisionEvents` drains and clears the *entire*
shared queue in one call, and the world has exactly one `EventQueue` for every collider in it. Once
plain rigid bodies also need events drained from that same queue (for `onCollisionStart`/
`onCollisionEnd`), doing that drain a second time from inside `simulate()` and *also* leaving each
trigger to drain it again itself from `checkOverlaps()` would mean whichever call runs first empties
the queue for everyone else - the world's own `simulate()` always runs before any entity's tick this
frame (see `GgWorld`'s tick loop: physics simulation tick order is strictly before
`TickOrder.OBJECTS_BINDING`, which is where `Trigger2dEntity.tick$` calls `checkOverlaps()`), so
draining there first and leaving `checkOverlaps()` a no-op-except-for-the-removed-body-cleanup-loop
is the only ordering that reaches both consumers. `checkOverlaps()` is still called by `Trigger2dEntity`
every tick and still handles the one case that has nothing to do with the event queue: detecting a body
that was overlapping this trigger but has since been removed from the world entirely (no `stopped`
event is ever queued for a collider that no longer exists), by checking `!body.nativeBody` on each
recorded overlap. As a side effect, centralizing the drain this way also fixes a latent limitation of
the old per-trigger-drain design: two triggers overlapping in the same frame used to race for the same
queue (the first trigger's `checkOverlaps()` call would silently consume events the second trigger's
own call needed) - now the one central drain sees every event and routes it correctly regardless of how
many triggers/bodies are involved.

**Resolving a collider handle back to a component**: `drainCollisionEvents`'s `handle1`/`handle2`
arguments are **collider** handles, not rigid-body handles - a distinct handle space in Rapier's
internal `ColliderSet` vs `RigidBodySet` arenas. `Rapier2dTriggerComponent`'s pre-existing
`checkOverlaps()` code compared these handles directly against `this.nativeBody?.handle` (a *rigid
body* handle) and got away with it only because this adapter always creates exactly one collider per
body, in lockstep, so the two arenas' generational indices happen to stay numerically aligned in
practice - fragile, but not touched here since it still passes every existing test. The new dispatch
code in `Rapier2dWorldComponent.simulate()` does this properly instead: `nativeWorld.colliders.get(h1)`
→ `Collider`, then `.parent()` → owning `RigidBody`, then `.handle` looked up in the existing
`handleIdEntityMap` (already keyed by rigid-body handle, and already shared between
`Rapier2dRigidBodyComponent` and `Rapier2dTriggerComponent` instances, so an `instanceof
Rapier2dTriggerComponent` check on the resolved component is enough to route sensor-overlap pairs away
from the plain-rigid-body collision path).

**Both plain-rigid-body colliders and trigger colliders need `ActiveEvents.COLLISION_EVENTS`** for a
pair between two *plain* rigid bodies to generate any event at all - before this change, only
`Rapier2dFactory.createTrigger` set that flag (on the sensor collider only), which was sufficient for
sensor-vs-anything overlap events (Rapier only needs one side of a pair to have the flag) but meant an
ordinary rigid-body-vs-rigid-body collider pair, neither side ever a trigger, generated no events at
all. Fixed by moving `.setActiveEvents(ActiveEvents.COLLISION_EVENTS)` into
`Rapier2dFactory.createColliderDescr()` itself so every collider this factory ever produces has it,
regardless of which of `createRigidBody`/`createTrigger` made it.

**Deriving `impulse`**: this pinned `@dimforge/rapier2d-compat` (0.20.0) build exposes the actual
solver-computed contact impulse directly - no need for `CONTACT_FORCE_EVENTS`/
`drainContactForceEvents`/a force-times-`dt` approximation at all. `World.contactPair(collider1,
collider2, (manifold: TempContactManifold, flipped: boolean) => ...)` (a convenience wrapper around
`NarrowPhase.contactPair` with the body set already bound), called synchronously inside the same
`drainCollisionEvents` callback right after `started === true` is reported, yields a manifold whose
`contactImpulse(i)` (summed over `numContacts()`) is the true, already-solved impulse magnitude for
that step - directly comparable across hits from this adapter, not merely an estimate. `normal()` is
the manifold's world-space contact normal, and `solverContactPoint(0)` is a world-space contact
position (note: solver contacts and geometric contacts are two related but distinctly-indexed lists on
the same manifold - `numContacts()`/`contactImpulse(i)` vs `numSolverContacts()`/
`solverContactPoint(i)` - don't assume the same index `i` means the same physical point in both).
`contactPair`'s callback receives `flipped: true` when Rapier internally stored the pair as
`(collider2, collider1)` rather than the order passed in, in which case `normal()` already points from
collider2 towards collider1 and must be negated before applying this adapter's own "normal always
points away from *this* body towards the other" convention per side. A manifold can in principle come
back empty the same step a `started` transition is reported for it; `Rapier2dWorldComponent.
emitCollisionStart` falls back to the midpoint between the two bodies' positions / the direction
between them / `impulse: 0` in that case rather than dropping the event, though this fallback wasn't
observed to trigger in practice across the package's own test suite.

**`removeFromWorld`'s `onCollisionEnd(null)` notification must never fire on the removed body's own
stream, only on each surviving partner's.** `Rapier2dRigidBodyComponent.removeFromWorld` walks its
own `activeContacts` set and calls `other.handleCollisionEnd(null)` for each partner still touching
it - that's correct and required (see `gg-engine-physics-adapter`'s "Collision events" section), but
an earlier version of this loop *also* called `this.onCollisionEnd$.next(other)` on the body being
removed itself, firing a spurious event on the vanishing body's own stream for every partner it was
still touching. Fixed by dropping that extra `next()` call - only `other.handleCollisionEnd(null)`
should run. `packages/rapier3d`'s equivalent (`notifyCollisionEnd`, walked via `collidingWith`) never
had this bug; use it as the reference when checking a similar loop in a new adapter.

**Self-collision guard**: `Rapier2dWorldComponent.dispatchCollisionEvents` resolves both collider
handles in a pair to components and skips the pair if resolution failed - but originally didn't also
skip a pair that resolved to the *same* component on both sides (a compound body's own sub-colliders
touching each other). Fixed by adding a `c1 === c2` check alongside the existing `!c1 || !c2` one,
mirroring `Rapier3dWorldComponent.collectCollisionEvents`'s pre-existing `comp1 === comp2` guard
(rapier3d had this from the start; rapier2d didn't).

**Complete the RxJS Subjects on dispose**: `Rapier2dRigidBodyComponent.dispose()`/
`Rapier2dTriggerComponent.dispose()` (and their rapier3d equivalents) must call `.complete()` on
`onCollisionStart$`/`onCollisionEnd$` (rigid body) and `onEnter$`/`onLeft$` (trigger, on top of
`super.dispose()`'s completion of the inherited pair) - both packages were missing this entirely
until fixed to match `packages/matter`/`packages/ammo`'s existing pattern. An app subscribed to any
of these four Observables via `.subscribe({ complete: ... })` (or an rxjs operator relying on
completion, e.g. `firstValueFrom`/`toArray()`) would otherwise hang forever past a body's disposal.

**Test gotcha - subscribe before any `simulate()` call that could itself fire the event under test**:
if two bodies (including a trigger) are spawned already overlapping and a scenario doesn't intend to
exercise the "spawned inside" case, don't call a settling `world.simulate(0)` (needed for the
broad-phase-registration pitfall above) *before* subscribing to the relevant `Observable` - the settle
step can itself detect the already-existing overlap/contact and fire the very first event through a
plain RxJS `Subject`, which a not-yet-attached subscriber will simply never see (no replay). Either
subscribe first and then settle, or (cleaner for a scenario that isn't specifically testing the
spawned-inside case) spawn the bodies apart and let the scenario's own motion produce the transition
after subscribing.

## `IRigidBodyComponent.onCollisionStart`/`onCollisionEnd` (3D, implemented in `packages/rapier3d`): same design as the 2D note above, three differences worth knowing

`Rapier3dWorldComponent` follows the identical centralization strategy the 2D note above describes in
full (`simulate()` owns every drain of the world's single `EventQueue` - one after each of its
substeps, delivered together after the last, see the substep notes under `IRaycastVehicleComponent` -
routed to a trigger's own
overlap handling or to both sides' collision handling depending on whether either collider is a
sensor) - read that note first, everything in it applies here too (the collider-handle-vs-rigid-body-
handle distinction, `ActiveEvents.COLLISION_EVENTS` needing to be set on plain rigid-body colliders
too via `Rapier3dFactory.createRigidBody` and not just `createTrigger`, the `contactPair`/
`TempContactManifold.contactImpulse(i)` approach to a real solved impulse rather than a
`CONTACT_FORCE_EVENTS` force-times-`dt` estimate). Three points worth calling out specifically for the
3D package:

- **Naming differs, behavior doesn't**: this package's dispatch methods are
  `Rapier3dTriggerComponent.notifyOverlap(otherBody, started)` (sensor pairs) and
  `Rapier3dRigidBodyComponent.notifyCollisionStart(event)`/`notifyCollisionEnd(otherBody | null)` (real
  pairs) - the 2D package calls its equivalents `handleOverlapEvent`/`handleCollisionStart`/
  `handleCollisionEnd`. Not unified across the two packages since they're independent classes with no
  shared base; if you're comparing the two implementations side by side, this is purely a naming
  choice, not a behavioral difference.
- **`World.getCollider(handle)` returns `null` for a since-removed/unknown collider handle - it does
  not throw.** Confirmed empirically on this pinned `@dimforge/rapier3d-compat` build (`0.20.0`):
  create a collider, remove it, then call `world.getCollider(oldHandle)` - the result is `null`, safe
  to guard with a plain `if (!collider) return;` in the drain callback rather than a `try`/`catch`.
  Worth confirming this still holds for `rapier2d-compat` too if its own dispatch code ever needs the
  same guard (this note only verified the 3D build directly).
- **`onCollisionEnd` genuinely distinguishes "separated" from "the other body was removed while still
  touching"** by emitting `null` for the latter, per `CollisionEvent`'s own doc convention (mirroring
  `ITriggerComponent.onEntityLeft`'s same optional-null convention, which `Rapier3dTriggerComponent`
  itself doesn't actually exercise - it always passes the real body reference, even on removal-
  triggered exit). Implemented via a `collidingWith: Set<Rapier3dRigidBodyComponent>` on
  `Rapier3dRigidBodyComponent` itself, added to on every `notifyCollisionStart`/removed on every
  `notifyCollisionEnd`, and walked by `removeFromWorld()`: every partner still in the set when a body
  is removed gets `notifyCollisionEnd(null)` and has this body dropped from its own `collidingWith` in
  turn. This is necessary because Rapier does not reliably emit a native collision-stop event for a
  collider that's simply deleted mid-contact (the same reason `Rapier3dTriggerComponent.checkOverlaps`
  needs its own manual `!body.nativeBody` cleanup pass instead of trusting the event queue for that
  case) - without it, the partner body would simply never hear that the contact ended at all.
- **`relativeVelocity` reads each body's `linvel()` *after* the step that produced the `started` event
  has already fully resolved the contact** (both `drainCollisionEvents` and `contactPair` are read
  right after the `world.step()` the contact started in, there is no earlier point to read from without re-deriving the pre-solve state
  by hand) - don't assume its sign matches the bodies' pre-collision approach direction. Confirmed
  empirically: a ball dropped onto a static floor with `restitution: 0` still read a small *positive*
  (separating) z-velocity on the ball immediately after its `onCollisionStart` fired, not the negative
  (falling) velocity it struck at, because Rapier's constraint solver had already resolved the
  penetration (with a small Baumgarte-style stabilization bias) within that same step. What does still
  hold reliably, and is what this package's own collision spec asserts instead of a specific sign: the
  two reciprocal `relativeVelocity` readings for a pair are exact negations of each other, since
  they're both derived from the same two bodies' `linvel()` calls a moment apart.

## A `Trigger3dEntity` never fired for a character controller (Rapier3d): two separate, compounding gaps

Two independent bugs, both required to genuinely fix "a player walking into a `Trigger` fires
`onEntityEntered`/`onEntityLeft`" - fixing only one still left the feature broken, just with a
different symptom:

1. **`Rapier3dWorldComponent.handleIdEntityMap` never registered a character controller's native
   body handle.** `collectCollisionEvents` resolves both sides of every collider pair purely through
   this map (`this.handleIdEntityMap.get(bodyN.handle)`); a `Rapier3dCharacterControllerComponent`'s
   `kinematicPositionBased` body has a real Rapier rigid-body handle just like any other body once
   `addToWorld()` runs, but that handle was deliberately left out of the map (an earlier version of
   this class's own doc called this "a documented limitation rather than done speculatively" - it
   isn't a limitation any more, see below). Fix: register it in `addToWorld()`/deregister it in
   `removeFromWorld()`, same as `Rapier3dRigidBodyComponent`/`Rapier3dTriggerComponent` already do.
   `collectCollisionEvents`'s real-contact branch (as opposed to its sensor-overlap branch) then
   needs an explicit `instanceof Rapier3dRigidBodyComponent` narrowing on both sides before calling
   `notifyCollisionStart`/`notifyCollisionEnd` - a character controller has no such API (its physical
   response comes from its own sweep-based `move()`, not Rapier's contact solver), so without the
   narrowing, a real (non-sensor) contact between a character and an ordinary body throws.
   `world.raycast()` deliberately still filters a resolved character controller back out before
   setting `hitBody` (`instanceof Rapier3dRigidBodyComponent` check there too) - widening its return
   type is a separate, still-not-done piece of work outside `IPhysicsWorldComponent.raycast`'s own
   documented `PTypeDoc['rigidBody'] | PTypeDoc['trigger']` contract; the self-hit-skip mechanism in
   `packages/core` (see `gg-engine-core-development`'s own note on this) never depended on this
   resolving anyway, so leaving raycast alone costs nothing there.
2. **Even with (1) fixed, no event ever fired**, because the pair simply never reached narrow-phase at
   all: Rapier's `ActiveCollisionTypes` gates collider pairs by *rigid-body type* combination, and its
   default (`ActiveCollisionTypes.DEFAULT = DYNAMIC_DYNAMIC | DYNAMIC_FIXED | DYNAMIC_KINEMATIC`)
   excludes `KINEMATIC_FIXED` - exactly the combination a `kinematicPositionBased` character makes with
   a `static` `Trigger`. Confirmed empirically: a character parked motionless for a full simulated
   second inside a trigger's volume never fired `onEntityEntered` until this was set. Fix:
   `colliderDescr.setActiveCollisionTypes(ActiveCollisionTypes.ALL)` on the character's own collider in
   `Rapier3dCharacterControllerComponent.addToWorld()` - `.ALL` rather than just `KINEMATIC_FIXED`
   covers every other rigid-body-type pairing the character could ever meet too (another kinematic
   character, a kinematic trigger, etc.), not just this one combination. Separately,
   `ActiveEvents.COLLISION_EVENTS` (the different, per-*collider* "actually emit an event for an
   allowed pair" flag - unaffected by `ActiveCollisionTypes`) is also set on this same collider, even
   though a trigger's own sensor collider already carries it and one side is normally sufficient (see
   `Rapier3dFactory.createRigidBody`'s own doc) - belt-and-suspenders for a real (non-sensor) contact
   against another kinematic body, where neither side would otherwise have it pre-set.

**A third, layered bug was found while regression-testing the above, from a completely different
mechanism**: even after both fixes, a character `move()`-ing straight at a trigger's volume physically
*stopped dead at its boundary* instead of walking through it - confirmed by logging position per step
and seeing it plateau exactly at the trigger's near face plus the capsule's radius.
`KinematicCharacterController.computeColliderMovement()` treats a sensor collider as a solid obstacle
by default (no `filterFlags` argument passed = no exclusion) - entirely independent of
`ActiveCollisionTypes`/`ActiveEvents` above, which only gate the collision-*event* queue, not this
sweep-based movement query. Fix: pass `QueryFilterFlags.EXCLUDE_SENSORS` as `computeColliderMovement`'s
3rd argument in `move()`. Without this fix specifically, a character could get stuck straddling a
trigger's boundary forever - `onEntityEntered` firing correctly (genuine overlap right at the boundary)
but `onEntityLeft` never following, since the character could make it no further in. See
`gg-engine-physics-adapter-ammo`'s own note on the identical symptom on that adapter (different root
cause - Ammo's `convexSweepTest`/`contactTest` needed every `AmmoTriggerComponent` manually detached
from the broadphase for the query's duration, since `CF_NO_CONTACT_RESPONSE` only suppresses the
*dynamics* solver's response, not a geometric sweep/contact query - but the same underlying class of
bug: a sensor silently acting as a solid obstacle to character movement).

Regression coverage: `rapier-3d-trigger-character-controller-integration.spec.ts` (walking through a
trigger end-to-end, and spawning already inside one). No vehicle-side test was needed here for this
specific gap - a vehicle chassis colliding with a `Trigger` is exercised by
`rapier-3d-raycast-vehicle.component.spec.ts` only incidentally (via ordinary collision groups), not
as a dedicated sensor-passthrough test.

`Rapier3dTriggerComponent.onEnter$`/`onLeft$` (and `notifyOverlap`'s `otherBody` parameter) are typed
as `Rapier3dRigidBodyComponent | Rapier3dCharacterControllerComponent`, matching the core
`ITrigger3dComponent.onEntityEntered`/`onEntityLeft` contract (`PTypeDoc['rigidBody'] |
PTypeDoc['characterController']` - see `gg-engine-core-development`'s type-accuracy note on this).
Earlier this was force-cast to `Rapier3dRigidBodyComponent` alone, which type-checked but was
inaccurate for exactly the character-controller-enters-a-trigger case this section describes -
`Trigger3dEntity` itself was never affected (it only ever reads `.entity` off the emitted value,
present on both), but any adapter-level code reaching `onEntityEntered`/`onEntityLeft` directly and
calling a rigid-body-only member (`linearVelocity`, `resetMotion()`, `onCollisionStart`/`onCollisionEnd`)
against a character controller would have hit a runtime `undefined`/throw with no compile-time warning.

## `IRaycastVehicleComponent` (3D, implemented in `packages/rapier3d`)

Option mapping: `frictionSlip` → `setWheelFrictionSlip`, `sideFrictionStiffness` (default 1) →
`setWheelSideFrictionStiffness`, `maxTravel`/`maxSuspensionForce`/suspension straight through.
Rapier's controller has no roll influence, so `WheelOptions.rollInfluence` is ignored. Don't map it
onto side-friction stiffness: the two mean different things, and the usual roll influence of 0.2
then cut every wheel's sideways grip to a fifth.

`Rapier3dRaycastVehicleComponent` wraps Rapier's `DynamicRayCastVehicleController`
(`world.createVehicleController(chassisBody)`), created and driven from `Rapier3dFactory.createRaycastVehicle`.
It extends `Rapier3dRigidBodyComponent` and builds its own chassis body from `chassisBody.factoryProps`
(the same "spawn a fresh body from stored descriptors" pattern `clone()` uses elsewhere in this package)
rather than reusing the passed-in `chassisBody` instance directly. The passed-in `chassisBody` component
itself is never added to the world; only the vehicle component's own body is.

**Rapier's wheel brake is an impulse per `updateVehicle` call, the engine force a force.** The
controller is a port of Bullet's raycast vehicle: `setWheelBrake` is documented as "the maximum amount
of braking impulse", applied once per `updateVehicle(dt)` - i.e. once per native step here - while
`setWheelEngineForce` is multiplied by `dt` inside. Passing `IRaycastVehicleComponent.applyBrake`'s
Newtons straight through braked in proportion to the frame rate (0.16 / 0.32 / 0.76 g at 30 / 60 /
144 FPS for one value, measured on a 1549 kg car). `applyBrake()` stores the force on the wheel's
entry, and `stepVehicleController(stepLength)` sets `setWheelBrake(i, force * stepLength)` for every
wheel right before `updateVehicle`. `addWheel` also sets `setWheelMaxSuspensionForce` from
`WheelOptions.maxSuspensionForce`, defaulting to `defaultMaxSuspensionForce(bodyOptions.mass)` -
`bodyOptions.mass`, not `nativeBody.mass()`, since the native mass properties aren't guaranteed to be
up to date right after the collider is attached. Regression: `rapier-3d-raycast-vehicle-frame-rate.spec.ts`.

**`Rapier3dWorldComponent.simulate()` runs substeps** - `n = ceil(dt / fixedTimeStep)` native steps
(default max 10 ms, clamped by `maxSubSteps`) of exactly `dt / n`, the same split as
`AmmoWorldComponent` (nothing carried over between calls, so no render jitter). One step per frame
made the solver depend on the frame rate: a vehicle cornering at 20 m/s for 3 s kept 16.2 m/s at 30
FPS and 19.0 m/s at 144 FPS (suspension and tyre friction are explicit per-step models); with
substeps it keeps 18.85 / 18.85 / 19.03 m/s at 30 / 60 / 144 FPS. Two things have to be spread over
the substeps, and both broke tests until they were:

- **Collision events.** The `EventQueue` is created with `autoDrain: true`, so Rapier clears it
  before every `step()`: draining once after the loop kept only the last substep's events (a ball
  landing on the floor in substep 1 of 2 never reported `onCollisionStart`, a trigger never saw a
  body spawned inside it). `collectCollisionEvents(out)` runs after every step - reading contact
  geometry and velocities right after the step the contact started in - and pushes notifications
  that `simulate()` delivers after the last step, so no subscriber runs (and changes the world)
  between steps.
- **`kinematic_pos` targets.** A `kinematic_pos` body's `position`/`rotation` setters call
  `setNextKinematicTranslation`/`Rotation` once per tick; Rapier reaches that target in the next
  step and keeps it afterwards, so with `n` steps the body moved `n` times too fast in the first one
  and stood still for the rest - a box on a platform moving at 3 m/s rode 0.07 m in a second at 30
  FPS instead of 2.6 m (friction only saw the platform's velocity for one step in four). `simulate()`
  reads each such body's `translation()`/`nextTranslation()` (and rotations) before the loop and
  sets the next target to `1/n`, `2/n`, ... of the way before each step. The bodies come from a
  `kinematicPosBodies` set maintained from `added$`/`removed$` by checking
  `nativeBody.bodyType()` - not `bodyOptions`, which throws for a `Rapier3dTriggerComponent` (its
  collider options are `null`). The character controller is unaffected: it teleports
  (`setTranslation` and `setNextKinematicTranslation` to the same point), so a step never moves it.

Every raycast vehicle's `stepVehicleController(stepLength)` runs before every substep.
Regression: `rapier-3d-raycast-vehicle-frame-rate.spec.ts` (cornering, substep lengths, the moving
platform at 30/60/144 FPS), plus the existing collision-event and trigger specs at 16 ms frames.

**Rapier's vehicle controller has no equivalent of stepping automatically as part of the world -
the world component must drive `updateVehicle()` itself, every tick, before stepping.**
`DynamicRayCastVehicleController.updateVehicle(dt, filterFlags?, filterGroups?)`
directly overwrites the chassis's own `linvel`/`angvel` from that call's suspension/engine/brake/friction
model - nothing steps it automatically as part of `World.step()`.
`Rapier3dWorldComponent` tracks every added vehicle in its own
`raycastVehicles: Set<Rapier3dRaycastVehicleComponent>` (added/removed by the vehicle's own
`addToWorld`/`removeFromWorld`, mirroring `handleIdEntityMap`'s pattern) and `simulate()` calls each one's
`stepVehicleController(stepLength)` immediately *before* every native `step()`, so the velocity
`updateVehicle` just wrote gets integrated by that same step. `stepVehicleController` also threads this vehicle's own
`collisionGroups` (inherited from `Rapier3dRigidBodyComponent`, already packed in the `InteractionGroups`
layout Rapier expects) into `updateVehicle`'s `filterGroups` argument, plus `QueryFilterFlags.EXCLUDE_SENSORS`
- without the former, the wheels' own suspension ray-casts would ignore collision groups entirely (only the
chassis's ordinary broadphase collision would respect them; see
`gg-engine-physics-adapter`'s testing guidance on this) - confirmed by
`rapier-3d-raycast-vehicle.component.spec.ts`'s two-vehicles-two-floors regression test, which fails
without it.

**A vehicle chassis built through `factoryProps` had an explicit zero rotational inertia baked in -
found live as "steering makes the car slide sideways, never actually turn to face its heading".**
`Rapier3dRigidBodyComponent.factoryProps` used to unconditionally call
`d.setMassProperties(cd.mass, cd.centerOfMass, cd.principalAngularInertia, cd.angularInertiaLocalFrame)`
on every rebuilt `ColliderDesc`, copying whatever the *original* descriptor's own mass-property fields
currently held. A freshly-constructed `ColliderDesc` that's never had `setMass`/`setDensity`/
`setMassProperties` called on it (the common case - `Rapier3dFactory.createColliderDescr` never calls any
of them) sits in the default `MassPropsMode.Density` mode, where `mass`/`centerOfMass`/
`principalAngularInertia`/`angularInertiaLocalFrame` are all just zeroed placeholders Rapier ignores in
favor of auto-computing both mass *and* rotational inertia from the shape and `density` (default `1`) -
confirmed empirically (`cd.massPropsMode === 0`, `cd.mass === 0`, `cd.principalAngularInertia ===
{0,0,0}` on a freshly-built `ColliderDesc`). Blindly copying those placeholders via `setMassProperties`
force-switches the *rebuilt* collider into explicit `MassPropsMode.MassProps` with a **real, load-bearing
zero** rotational inertia tensor, discarding whatever shape-derived inertia the original would have had -
harmless for `clone()`'s existing callers (nothing in this package's tests exercises rotational dynamics
on a cloned body), but directly hit by `Rapier3dRaycastVehicleComponent`, which builds its *only* body
this same way: confirmed via direct `nativeBody.angvel()` inspection that steering produced an exact,
unchanging `{0,0,0}` angular velocity every tick - not just small, literally zero - while `linvel` moved
the chassis sideways under wheel friction just fine (torque / ~zero inertia normally means huge angular
acceleration, but an *explicit* zero tensor combined with Rapier's own divide-by-zero guard evidently
clamps to no angular change at all rather than blowing up). Fixed by making `factoryProps` check
`cd.massPropsMode` first: `MassProps` copies via `setMassProperties` as before, `Mass` copies via
`setMass(cd.mass)`, and the default `Density` mode now copies via `setDensity(cd.density)` instead of
calling `setMassProperties` with meaningless placeholders - letting Rapier re-derive proper shape-scaled
mass and inertia for the rebuilt collider, exactly as the original would have gotten.

**Fixing the above alone still wasn't enough - a heavy chassis with a *feather-light*, shape-only
rotational inertia spun wildly on any steering input instead of turning smoothly.** The deeper issue:
every dynamic body's mass (this package predating vehicles entirely, not something introduced by them)
was being set via the plain `RigidBodyDesc.mass` field (`bodyDesc.mass = options.mass || 1` in
`Rapier3dFactory.createRigidBodyDescr`) - which is documented as *additional* mass layered on top of
whatever the attached collider(s) themselves contribute from their own density, and critically,
additional mass contributes **no extra rotational inertia of its own** (it behaves like a point mass
sitting exactly at the body's center of mass). With every collider left at the factory's default
density (`1`), a `mass: 800` chassis ended up with a correctly-scaled *total* mass (~800kg, dominated by
the additional-mass term) but a rotational inertia derived only from the density-1 collider (a few kg's
worth) - a large mass with a tiny moment of inertia resisting rotation, so any steering-induced torque
produced wildly excessive angular acceleration (confirmed empirically: the chassis's height/rotation
oscillated and briefly tumbled before the fix below, versus settling into a smooth, steady turn after
it). Fixed by moving mass onto the collider(s) instead: `createRigidBodyDescr` now takes the rigid
body's `ColliderDesc[]` as a third parameter and, for a dynamic body, calls `c.setMass(mass /
colliderDescr.length)` on every one of them (an even split across a `COMPOUND`'s sub-colliders at
descriptor level) rather than setting
`bodyDesc.mass` at all - `ColliderDesc.setMass` auto-derives inertia from the shape *scaled to that
mass*, giving a consistent, correctly-proportioned mass/inertia pairing for any dynamic body in this
package, vehicle chassis included, not just a special case bolted onto the vehicle component. Worth
re-checking if a future change ever reintroduces `RigidBodyDesc.mass`/`setAdditionalMass` for a dynamic
body in this package - the failure mode (translation looks fine, rotation is wildly wrong) is easy to
miss without specifically testing a torque-inducing scenario, which is exactly why the vehicle feature
was what surfaced it instead of any of this package's pre-existing tests.

**A dynamic body's centre of mass is its origin (3D contract), which Rapier doesn't do by itself.**
Rapier derives the centre of mass from the attached colliders, so a `COMPOUND` (a car chassis built
from 3-4 boxes) got its centre of mass at the plain average of the boxes - over a metre above the
wheels, and a truck's 1.8 m forward of its origin - and rolled over on ordinary turns. Bullet's
`btCompoundShape` keeps it at the body origin, and `BodyOptions.mass`' doc makes that the contract.
`Rapier3dRigidBodyComponent.addToWorld` therefore calls `applyMassProperties` for a dynamic body:
re-spread the total mass over the native colliders by `collider.volume()`, `recomputeMassPropertiesFromColliders()`,
and if `localCom()` isn't at the origin, shift the inertia tensor to the origin (parallel-axis theorem,
then re-diagonalize - `src/mass-properties.ts`), set every collider's mass to `0` and give the body that
mass/inertia through `setAdditionalMassProperties` with a zero centre of mass. The descriptors keep
their even split, so `bodyOptions.mass` and `clone()` are unaffected. Covered by
`test/components/rapier-3d-rigid-body-mass.spec.ts` (centre of mass, inertia values, volume split,
re-add).

**`Rapier3dRigidBodyComponent.bodyOptions.mass` must sum collider mass, not read `_bodyDescr.mass`
- a later addition that didn't account for the collider-mass design above.** `IRigidBodyComponent
.bodyOptions` (see `gg-engine-core-development`'s own section on this getter) is meant to read back
a dynamic body's actual requested mass, for `LevelLoader.serializeEntity`'s live `"Primitive"`
serializer to round-trip through. A first implementation read `this._bodyDescr.mass` directly - which
compiles and looks identical to Rapier2d's own `bodyOptions` getter, but is wrong here specifically
*because* of the fix above: `createRigidBodyDescr` deliberately never sets `RigidBodyDesc.mass` for a
dynamic body (per the additional-mass/zero-inertia problem it solves), so `_bodyDescr.mass` is always
its unused default (`0`) regardless of what was actually requested - confirmed by a direct test
(`mass: 5` requested, `bodyOptions.mass` read back `0`). Fixed by summing `_colliderDescr[].mass`
across every collider instead, gated on `cd.massPropsMode !== MassPropsMode.Density` (mirroring
`factoryProps`'s own mode check above - `cd.mass` is only a meaningful, non-placeholder value once
`setMass`/`setMassProperties` was actually called on that collider, true for every collider of a
dynamic body per `createRigidBodyDescr`, never true for a static/kinematic one, which correctly sums
to `0`). Worth re-checking any future field added to `bodyOptions` (or a similar "read back what this
body's descriptors were actually built with" accessor) against which native structure the factory
*actually* stores that field on in this package - it's not always the intuitively-named one
(`RigidBodyDesc` vs. `ColliderDesc`), and Rapier2d/Rapier3d can genuinely disagree on this even for
the same logical field, as they do here.

**`DynamicRayCastVehicleController.currentVehicleSpeed()` returns plain m/s, matching
`IRaycastVehicleComponent.wheelSpeed`'s contract directly - no scaling needed.** Its own doc carries
no unit note, so this is worth confirming rather than assuming either way. Confirmed empirically
(isolated, wheel-free `world.createVehicleController(chassis)` +
`chassisBody.setLinvel({x:0,y:v,z:0}, true)` then `updateVehicle(0)`, no gravity, no suspension in
play at all): `currentVehicleSpeed()` returns exactly `v` for every tested value, i.e. it's already
the forward-axis component of the chassis's own `linvel()` in plain m/s, refreshed only by
`updateVehicle()` (reads back `0` before the first call, even with `linvel` already set) - so
`Rapier3dRaycastVehicleComponent.wheelSpeed` returns it directly, unscaled.

**A single constant wheel axle, not one flipped per side, is required for engine force to actually
propel the chassis - found live as "the car never moves under engine force, `angvel`/`linvel` both stay
near zero despite `setWheelEngineForce` being called every tick".** An earlier version used
`options.isLeft ? Pnt3.X : Pnt3.nX` as each wheel's `axleCs`, on the theory that it would let
`getWheelTransform`'s roll rotation (computed from `wheelRotation(i)` around this same axis) spin each
side's mesh the visually correct way without extra bookkeeping. Rapier's engine-force/friction model
treats `axleCs` as the wheel's forward-tire-direction reference for that computation - flipping it on
one side makes that side apply its engine force in the opposite world direction from the other side, so
the two sides' forces exactly cancel and the chassis never accelerates at all (confirmed via a dedicated
regression test - drive under engine force and assert net displacement over a few seconds - since a
settle-only test never applies engine force and so cannot catch this). Fixed to use a single,
unflipped axle convention instead: every wheel uses
`Pnt3.X` regardless of side. Left/right visual mirroring of the wheel mesh doesn't need any
compensation for this at the adapter level either way - it's already handled adapter-agnostically by
`RaycastVehicle3dEntity`'s own `wheelLocalRotation` (derived from `WheelOptions.isLeft`).

**`getWheelTransform` has no single native call to read from.**
Rapier's controller only exposes the individual pieces, composed by hand:
- **Position**: `wheelHardPoint(i)` is already world-space (the wheel ray-cast's own fixed start
  point) - `wheelDirectionCs(i)` (chassis-local) rotated by the chassis's current rotation, then scaled
  by `wheelSuspensionLength(i)` (the wheel's *current* compressed-or-extended travel, airborne or
  grounded alike) and added to the hard point, lands exactly on the wheel's current center.
- **Rotation**: composed as chassis rotation ∘ steering (`Qtrn.rotAround(Qtrn.O, Pnt3.Z, wheelSteering(i))`
  - `Pnt3.Z` because `indexUpAxis` is set to `2`) ∘ roll (`Qtrn.rotAround(Qtrn.O, Pnt3.X,
  wheelRotation(i))` - `Pnt3.X` matching the single constant `axleCs` above, not a per-side value).

Both are best-effort reconstructions, not values read back verbatim from the native engine - document
as a known limitation rather than chasing exactness, same spirit as
`Rapier3dCharacterControllerComponent`'s own ground-normal approximation; only confirmed geometrically
sound (all four wheels sit at their configured corner offsets and translate/rotate along with the
chassis) and visually plausible in the `3d/raycast-vehicle` example.

**`resetSuspension()` is a documented no-op.** Rapier exposes no way to directly set a wheel's *current*
suspension length (only the rest length/travel bounds that shape it). Not load-bearing here, either -
the very next `stepVehicleController` tick re-derives every wheel's suspension length from a
fresh ray-cast against the vehicle's (by then already reset) position, so a teleport/respawn recovers
within one tick even without an explicit reset.

**`clone()` must also re-add every wheel.** An earlier version's `clone()` only forwarded the chassis
body, producing a vehicle with zero wheels - `addWheel` must be replayed for each entry in this
component's own wheel list (kept for exactly this purpose, alongside the native `addWheel` call) onto
the new instance.

Regression coverage: `rapier-3d-raycast-vehicle.component.spec.ts` - settling under gravity onto a
floor, the two-vehicles-two-collision-groups-two-floors test from `gg-engine-physics-adapter`'s testing
guidance, and a drive-under-engine-force test asserting both net displacement and a sane (neither ~0 nor
implausibly large) `wheelSpeed` - the last one is what originally caught both the axle-cancellation bug
and would have caught a reintroduced unit-conversion bug in `wheelSpeed`.

## Keep this skill current

This file is read by future agents fixing/extending `packages/rapier2d` or `packages/rapier3d`
specifically, not by end users of the engine. If Rapier's API fights the mapping described in
`gg-engine-physics-adapter` in some new way, or something written here turns out wrong/incomplete once
you've actually worked with it (including after a `@dimforge/rapier{2,3}d-compat` version bump), add a
short note (what went wrong, why, the fix) before finishing, folded into the relevant section rather
than left as a loose log entry.

Describe Rapier's own behavior on its own terms - don't reach for `packages/ammo`/Bullet (or any other
adapter) as a reference point, comparison, or naming convention when explaining what Rapier does or why
a fix works. An agent working on this package should never need to look at another package to make
sense of a note here. This applies even when a bug or fix happens to mirror something already
documented in `gg-engine-physics-adapter-ammo` - describe the Rapier-side symptom, root cause and fix
in Rapier's own vocabulary; cross-reference another adapter's skill file only for the general,
adapter-agnostic contract itself (`gg-engine-physics-adapter`), never to explain *this* package's own
API or numbers by analogy to *its* API or numbers.
