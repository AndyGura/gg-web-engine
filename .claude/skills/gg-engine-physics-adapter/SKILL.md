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

## Keep this skill current

This file is read by future agents building/maintaining physics adapters, not by end users of the
engine. If a native engine's API fights the mapping described here (a shape/body-option that
doesn't translate the way expected, a collision-group limit, an async-init or disposal quirk that
caused leaks or flaky tests), or something written here turns out wrong or incomplete once you've
actually implemented it, add a short note (what went wrong, why, the fix) before finishing —
folded into the relevant section rather than left as a loose log entry.
