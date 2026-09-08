---
name: gg-engine-physics-adapter-rapier
description: Known, already-solved implementation pitfalls specific to packages/rapier2d and packages/rapier3d (the @dimforge/rapier-compat physics adapters) - broad-phase registration timing, native character-controller feature interactions, WASM-bindgen import/build gotchas, Jest/jsdom setup. Use when fixing or extending packages/rapier2d or packages/rapier3d itself, not when building a new physics adapter from scratch (see gg-engine-physics-adapter for the general contract every adapter implements).
---

# packages/rapier2d and packages/rapier3d implementation notes

This file is Rapier-specific (`@dimforge/rapier2d-compat`/`@dimforge/rapier3d-compat`) history: real
bugs hit and fixed while building these two packages, kept here so nobody re-discovers them from
scratch while touching either one again. Read `gg-engine-physics-adapter` first for the general
interface contract (`IPhysicsWorldComponent`, `ICharacterController3dComponent`, the
`removeFromWorld(dispose)` contract, etc.) - everything below assumes that contract and only covers
where Rapier's own native API/build made it non-obvious to satisfy. Most sections below are 3D-only
(`Rapier3dCharacterControllerComponent` has no 2D counterpart - core has no 2D character-controller
interface); the ones that aren't say so explicitly.

## The `removeFromWorld(dispose)` contract, Rapier specifics

Rapier is WASM but reference-counted per-call, not manually tracked like Ammo: every rigid-body/
trigger/character-controller `removeFromWorld` already unconditionally freed its native handles
regardless of any flag - `addToWorld` always recreates them fresh from stored descriptors, so eager
freeing on every removal is both safe and cheap to undo, unlike Ammo's handles. These now accept
`dispose?: boolean` for interface conformance (and each `dispose()` passes `true` through to
`removeFromWorld` for self-documentation), but the parameter doesn't change behavior. The one genuine
bug found here: `Rapier3dRaycastVehicleComponent`'s native vehicle controller needs an explicit
`.free()` beyond `removeVehicleController`, which - like the Ammo raycast vehicle - was never
reachable from an ordinary `removeFromWorld` before; fixed by calling `this.dispose()` from
`removeFromWorld` when `dispose` is `true`.

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
a tall obstacle too (this repo's own `player-character-three-ammo`/`-rapier3d` demo scene ships a
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

## Keep this skill current

This file is read by future agents fixing/extending `packages/rapier2d` or `packages/rapier3d`
specifically, not by end users of the engine. If Rapier's API fights the mapping described in
`gg-engine-physics-adapter` in some new way, or something written here turns out wrong/incomplete once
you've actually worked with it (including after a `@dimforge/rapier{2,3}d-compat` version bump), add a
short note (what went wrong, why, the fix) before finishing, folded into the relevant section rather
than left as a loose log entry.
