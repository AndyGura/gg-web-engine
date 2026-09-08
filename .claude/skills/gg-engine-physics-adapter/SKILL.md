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
  (see `gg-engine-physics-adapter-ammo`) and, at the app level, `PlayerCharacterController`'s third-person
  camera raycast starting from a point on the player's own capsule centerline and immediately
  self-hitting at ~0 distance (collapsing the camera onto the character - regression, found live in
  the rapier3d example). The general-purpose fix used at the app level (no interface change) was
  geometric, not group-based: nudge the ray's start point outward past the character's own radius
  along its direction first, then add that offset back onto the reported hit distance - the same
  "start just outside my own shape" trick `CharacterController3dEntity.tryStandUp`'s self-raycast
  already used. Keep this in mind before adding any new raycast call that might originate on or near
  a body already in the world.

  That same "start just outside my own shape" trick has its own sharp edge, found via `tryStandUp`
  itself: the small margin it adds only stays *outside* every other body too as long as the position
  it's measured from is settled/at rest. A thin ray probe checked every tick against a position that's
  still actively moving (e.g. a character rising through a jump) can, on the one tick its natural,
  entirely legitimate approach happens to land within that same tiny margin of a nearby obstacle -
  *before* `move()`'s own sweep has even engaged to block it - have its start point already inside
  that obstacle, and a ray beginning inside a shape never registers an entry hit against it. This
  produced a real, live bug: jumping while crouched under a ceiling too low to stand under stood the
  character up mid-jump and clipped it into the ceiling, on backends whose per-tick movement happened
  to land in that exact window. Swapping which end of the ray is the "safe" one doesn't generally fix
  this either - a sufficiently thick obstacle can just as easily embed the *other* end instead (a
  ceiling several times thicker than the probe's own range will contain both candidate endpoints at
  once for a wide band of positions, not just right at contact). The fix that actually held: never run
  a check like this against a position that might still be mid-flight - `tryStandUp` is now only
  attempted while `isGrounded`, retrying automatically once grounded again rather than against an
  airborne, actively-changing position. Worth remembering for any future self-raycast check driven off
  a kinematic character's live position while it's mid-`move()`, not just this one.
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
  running a full simulation step. Check the exact API name at the pinned version — see
  `gg-engine-physics-adapter-rapier` for the Rapier-specific case, since it has changed across
  releases and easy-to-find example code may reference a newer/older name than what's actually
  pinned.
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

Every `removeFromWorld` override in every physics/rendering adapter now accepts and honors this
parameter - the general pattern: accept `dispose?: boolean`, thread it through to
`super.removeFromWorld(world, dispose)` when the component subclasses another `IWorldComponent`, and
at the point where this component's own native handles are known (usually the base of a class
hierarchy, e.g. `AmmoBodyComponent`/`MatterRigidBodyComponent`) call `this.dispose()` when `dispose`
is `true`. WASM-backed engines (Ammo, Rapier) are where getting this wrong actually leaks memory;
a pure-JS engine (Matter) mostly just needs the parameter threaded through for interface conformance.
See `gg-engine-physics-adapter-ammo`/`-rapier`/`-matter` for exactly what each of those packages had
to fix here, and any leaks that were found and consciously left as known gaps.

## Known per-library pitfall notes

`gg-engine-physics-adapter-ammo`, `gg-engine-physics-adapter-rapier`, and
`gg-engine-physics-adapter-matter` each hold a library-specific history of real, already-solved bugs
for that one package - native-engine feature interactions, WASM/embind quirks, build/typing gotchas.
Load the one matching whichever package you're actually touching before starting; none of it is
needed to build a *new* adapter from scratch (that's what the rest of this file is for), but all of
it is worth reading before touching an existing one, so you don't re-derive a fix that's already on
record. In particular, the character-controller section below draws on lessons from both Ammo and
Rapier's implementations - if you're building a new `ICharacterController3dComponent` for another
engine, skim both of those skills too, since a from-scratch kinematic mover reliably hits the same
handful of failure modes (self-collision during its own sweep/query, jump takeoff getting cancelled
by a ground-snap/step-assist feature, broad-phase registration lag) regardless of which native engine
it's built on.

### Pitfall: a freshly-created collider may be invisible to sweeps/raycasts until the world steps once

Many native engines (confirmed for both this repo's pinned Ammo.js and `@dimforge/rapier3d-compat`
builds) don't register a newly-created collider into the broad-phase until the world has run at least
one step - a sweep/raycast issued the same tick a collider was created can silently find nothing
there at all. Check whether your engine has this behavior; if so, a normal per-frame game loop already
satisfies it (physics has already ticked at least once before gameplay code runs), but any
synthetic same-tick setup (most test suites) needs an explicit `physicsWorld.simulate(0)` - a
zero-length timestep, safe to call, moves nothing - after creating geometry/the character and before
the first `move()`/`raycast()` that depends on seeing it. See `gg-engine-physics-adapter-rapier` for
the full investigation (including the exact API to re-sync a kinematic body's transform without a full
step) and a `settleWorld()` test-helper pattern to copy.

### Pitfall: a from-scratch sweep/query-based character mover reliably hits the same few failure modes

If your engine's native character-controller class turns out unusable (as Bullet's
`btKinematicCharacterController` did here - see `gg-engine-physics-adapter-ammo` for specifics) and you
end up implementing the mover as a sequence of raw sweep/cast calls instead, expect to hit (and should
proactively test for) all of the following, in roughly this order of discovery difficulty:

- **Self-collision**: a sweep/cast query issued from the character's own shape will report the
  character's own collider as the closest hit unless you explicitly exclude it for the duration of the
  call (most engines have no "don't hit me" identity concept on a raw sweep query the way a purpose-built
  character controller class does internally). Symptom is subtle and easy to misdiagnose: movement capped
  to some fraction of intended speed, inconsistently by direction, on a perfectly flat, empty floor.
- **One-sided/GJK-style casts can go permanently blind to a body once even slightly penetrating it** -
  a well-documented limitation of conservative-advancement casts generally, not one engine's bug. If your
  engine's sweep is this kind of cast, run a discrete overlap-based "recover from penetration" step at
  the top of every `move()`, before the sweep, so the character is never allowed to start a cast already
  embedded in something.
- **A hand-rolled ground-snap fallback (or a native snap-to-ground/autostep feature left enabled
  unconditionally) will cancel a jump's takeoff** unless explicitly disabled whenever this tick's desired
  vertical movement is upward - a jump's first tick or two rises only a few centimeters, well within any
  reasonable snap/step distance.
- **A step-up assist needs a "does the raised position actually land somewhere walkable" check, not just
  "did it clear more horizontal distance"** - otherwise a smooth curved or vertical surface can look like
  a climbable ledge from curvature/contact-point drift alone, letting the character incrementally
  "climb" something unclimbable.
- **The vertical (gravity/fall) sweep leg needs the same obstacle-slide-along-tangent handling the
  horizontal leg needs**, or a character sliding down a too-steep slope gets stuck re-blocked at the same
  point every tick instead of actually sliding.
- **A native "push dynamic bodies on contact" feature, if the engine has one, is worth being suspicious
  of before relying on it** - see `gg-engine-physics-adapter-ammo`'s note on Bullet's mass-blind,
  non-rotating native ghost-object contact response, and `gg-engine-physics-adapter-rapier`'s note on
  Rapier's kinematic-character impulse feature exploding outright. The `pushMass` contract in this
  engine's `ICharacterController3dComponent` is deliberately simple to hand-roll instead (an inelastic
  collision against a virtual mass: `bodySpeedAlongPush = characterSpeed * pushMass / (pushMass +
  bodyMass)`, only ever adding velocity along the push direction) - both existing adapters that implement
  pushing ended up doing exactly this by hand rather than trusting a native equivalent.

See `gg-engine-physics-adapter-ammo` for the full, empirically-worked-out narrative behind each of these
(including the embind-specific plumbing needed to wire up a discrete penetration-recovery query in
Ammo.js), and `gg-engine-physics-adapter-rapier` for the native-feature-interaction version of the
ground-snap/jump and push pitfalls.

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

Only import what a native/WASM-bindgen dependency's own root barrel/`exports` map actually
re-exports - never a deep subpath into its internal file layout, even if it happens to resolve today.
A subpath outside the declared `exports` map can keep working under `moduleResolution: "node"`
(classic resolution ignores `exports` and does a raw filesystem lookup) for a long time purely because
a stale copy of an old package layout lingers in `node_modules` across repeated `npm install` runs -
then break, confusingly, only once a fully fresh install replaces it, well after a version bump's own
build/test pass was already signed off as green. Re-check this specifically after every version bump
of such a dependency. See `gg-engine-physics-adapter-rapier` for the concrete incident this rule comes
from (`@dimforge/rapier3d-compat`'s `InteractionGroups` export moving between releases).

## WASM-bindgen adapters under Jest/jsdom

If a WASM-bindgen-generated dependency's glue code calls `TextEncoder`/`TextDecoder` at module load
time, recent `jest-environment-jsdom` versions don't expose those as globals inside the jsdom sandbox,
so merely importing the adapter package inside a jsdom test throws before any test body runs. Fix: a
`setupFiles` entry that copies `TextEncoder`/`TextDecoder` from Node's `util` module onto `globalThis`
before anything requires the WASM glue - see `gg-engine-physics-adapter-rapier` for the exact setup
this repo uses. Any wasm-bindgen-based dependency (not just Rapier) is liable to hit this the same way.
For engine-specific event-queue/trigger-timing test gotchas and typed-options version-bump pitfalls,
see `gg-engine-physics-adapter-rapier`/`-matter` respectively.

## Keep this skill current

This file is read by future agents *building a new* physics adapter, not by end users of the engine,
and not primarily by agents fixing/extending an already-existing one (`ammo`/`rapier2d`/`rapier3d`/
`matter`) - those have their own sibling skills (`gg-engine-physics-adapter-ammo`/`-rapier`/`-matter`).
If a native engine's API fights the *general* mapping/contract described here in a way any future
adapter would hit (a pattern in `IPhysicsWorldComponent`/`ICharacterController3dComponent` that's
awkward to satisfy regardless of which library you're wrapping), or something general written here
turns out wrong or incomplete, update this file. If instead you hit something specific to one of the
four already-implemented libraries - an API quirk, a version-bump break, a build/typing gotcha, a
leak found and fixed - fold that lesson into that library's own sibling skill file instead of here,
so this file stays a lean "how to build a new adapter" guide rather than re-accumulating
per-library archaeology. Either way: a short note (what went wrong, why, the fix), folded into the
relevant section rather than left as a loose log entry.
