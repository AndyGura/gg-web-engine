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
```

## The TypeDocRepo you must define

```typescript
export type <Lib>PhysicsTypeDocRepo = {
  factory: <Lib>Factory;
  rigidBody: <Lib>RigidBodyComponent;
  trigger: <Lib>TriggerComponent;
  // 3D only:
  raycastVehicle?: <Lib>RaycastVehicleComponent;
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
