---
name: gg-engine-core-development
description: Modify packages/core of gg-web-engine — the dimension-agnostic and 2D/3D abstract interfaces, entities, math, and world classes that every rendering/physics adapter implements. Use when the task touches packages/core itself, not app code or a specific adapter package.
---

# Developing packages/core

`packages/core` (`@gg-web-engine/core`) has **no rendering or physics library dependency** — it
only defines abstractions (interfaces, generics, math, entity/world plumbing) that adapter
packages (`packages/three`, `packages/pixi`, `packages/ammo`, `packages/matter`,
`packages/rapier2d`, `packages/rapier3d`) implement. Treat it as the contract layer: changes here
ripple into every adapter and every app.

## Layout

```
src/base/    dimension-agnostic: IComponent, IEntity, clocks, math (Point2/3, Quaternion,
             Matrix4, Box, splines), inputs, GgWorld base class, body-options base
src/2d/      2D specialization: Gg2dWorld, Entity2d, 2D components/interfaces, 2D shapes
src/3d/      3D specialization: Gg3dWorld, Entity3d, 3D components/interfaces, 3D shapes,
             loaders, controllers (camera/car/free-fly), GgCarEntity, MapGraph3dEntity
src/dev/     in-page console + debugger UI, performance meter
```

Each of `base/2d/3d` mirrors the same sub-structure: `components/{physics,rendering}`,
`entities/`, `interfaces/`, `models/`. When adding a concept to 3D, check whether it belongs in
`base/` instead (dimension-agnostic) before duplicating it into both `2d/` and `3d/`.

The Blender-side authoring tool that produces the `.glb`+`.meta` pair `src/3d/loader.ts`'s
`Gg3dLoader.loadGgGlb` reads is **not** part of this package — it lives at the repo-root
`blender-addon/` as a standalone, independently-versioned Blender add-on (see
`blender-addon/README.md`), not shipped inside the `@gg-web-engine/core` npm tarball. If a change
here touches the `.meta` JSON shape (e.g. `GgMeta`, `packages/core/src/3d/models/gg-meta.ts` or
whatever the loader currently expects), bump `GG_META_FORMAT_VERSION` in
`blender-addon/gg_web_engine_exporter/exporter.py` and update `blender-addon/README.md`'s
object-convention table to match — the two sides aren't type-checked against each other.

## The TypeDocRepo generic pattern — read this before touching interfaces

Core interfaces don't hardcode adapter types. Instead each dimension defines a "type doc
repository" — a plain type mapping role names to the types an adapter must supply — and every
interface is generic over it:

```typescript
// packages/core/src/2d/gg-2d-world.ts
export type VisualTypeDocRepo2D = {
  factory: IDisplayObject2dComponentFactory;
  displayObject: IDisplayObject2dComponent;
  renderer: IRenderer2dComponent;
  rendererExtraOpts: {};
  camera: ICamera2dComponent;
  texture: unknown;
};
export type PhysicsTypeDocRepo2D = {
  factory: IPhysicsBody2dComponentFactory;
  rigidBody: IRigidBody2dComponent;
  trigger: ITrigger2dComponent;
};
```

`IVisualSceneComponent<D, R, VTypeDoc>`, `IPhysicsWorldComponent<D, R, PTypeDoc>`, etc. are generic
over these repos with a default equal to the base (unbound) interface. An adapter package
instantiates concrete versions (e.g. `ThreeVisualTypeDocRepo`, `Rapier2dPhysicsTypeDocRepo` in its
own `types.ts`) and implements the interfaces parametrized with them. `Gg2dWorldTypeDocRepo` /
`Gg3dWorldTypeDocRepo` combine a `vTypeDoc` + `pTypeDoc` pair, with `...VPatch`/`...PPatch` utility
types letting an app specify only one side and utility types like `TypedGg2dWorld<VW, PW>` compose
a full app-level world type from an independently-typed visual world and physics world. **Don't
break this indirection** — e.g. never have a base interface reference a concrete adapter type
directly, and when adding a new capability to a component interface, add the new type to the
relevant `TypeDocRepo` rather than hardcoding it.

## Interfaces that are the actual public contract

Changing any of these is a breaking change for every adapter package — grep
`implements I<Name>` across `packages/*/src` before editing, and plan to update every hit:

- `IComponent`, `IWorldComponent` (base)
- `IPhysicsWorldComponent` / `IVisualSceneComponent` (+ 2D/3D specializations)
- `IRigidBodyComponent`, `ITriggerComponent`, `IBodyComponent` (+ 2D/3D)
- `IDisplayObjectComponent`, `IRendererComponent`, `ICameraComponent` (+ 2D/3D)
- `IRaycastVehicleComponent` (3D only)
- `IEntity`, `IRenderableEntity`, `IRendererEntity`
- The factory abstracts in `2d/factories.ts` / `3d/factories.ts`

## Math & helpers

`Point2`/`Point3`/`Point4` are plain `{x,y,...}` data objects (not classes) so any adapter's
native vector can satisfy them structurally. `Pnt2`/`Pnt3`/`Qtrn` (in `base/math/`) are static
helper namespaces (add, lerp, `O` origin constant, `lookAt`, etc.) operating on those plain shapes
— prefer extending these over introducing class-based vector types, to keep the structural-typing
story intact for adapters.

## Build & test

```bash
cd packages/core
npm install
npm run build   # runs `update-version` (regenerates src/version.ts from package.json) then tsc
npm test        # jest + ts-jest + jsdom
```

Never hand-edit `src/version.ts` — it's generated. Tests live under `test/`, mirroring `src/`
paths, with shared fakes in `test/mocks/` (`body.mock.ts`, `object.mock.ts`, `world.mock.ts`,
`raycast-vehicle.mock.ts`). New core logic should get a `.spec.ts` there, not in an adapter
package, unless it's genuinely adapter-specific behavior.

## Local dev workflow: core + adapter + example, all in watch mode

`packages/*` (not `examples/*`) is an npm workspace, defined by the root `package.json`. That's
the whole mechanism: `npm install` at the repo root symlinks every adapter's
`@gg-web-engine/core` (and inter-adapter, if any) dependency straight to the local `packages/*`
directories — no version bump, no publish, no manual `npm link` bookkeeping. `packages/*/tsconfig.json`
additionally declare TypeScript project `references` to `../core`, and the root `tsconfig.json` is
a "solution" file referencing every package, so a single `tsc -b` (TypeScript's project-reference
build orchestrator) rebuilds core and every adapter incrementally, in the correct dependency order,
from one process.

Put together, this gives you one long-running command that keeps every package's `dist/` current
as you edit `.ts` anywhere in `packages/`:

```bash
npm install       # one-time bootstrap: links the packages/* workspace (root package.json)
npm run build     # one-time full build (includes the non-TS asset copies — see caveats below)
npm run build:watch  # `tsc -b --watch` at repo root — leave this running
```

To also see the change live in a specific example's dev server, link that example once and start
it (see `gg-engine-examples`):

```bash
bash etc/switch_example_to_local_gg.sh examples/<example-dir>
cd examples/<example-dir> && npm start   # webpack-dev-server, also watches for changes
```

With both of those running, **editing `packages/core/src` (or any adapter's `src`) is reflected in
the browser with no other step**: `tsc -b --watch` notices the source change and re-emits that
package's `dist/` (and, transitively, any adapter whose public types changed); webpack's own
watcher notices the adapter's `dist/*.js` changed on disk (it's resolved through a plain symlink,
so this is indistinguishable to webpack from a normal file edit) and rebuilds/reloads the bundle.
This was verified end-to-end while writing this section: an edit to `packages/core/src/index.ts`
propagated through `tsc -b --watch` into `packages/core/dist`, was picked up by a `webpack --watch`
build of an example with no manual rebuild, and landed in the emitted bundle.

Caveats:

- `tsc -b --watch` only rebuilds what `tsc` itself emits. Two packages have a non-TS asset copy
  step in their own `build` script (`ammo`'s `ammo.js` WASM glue, `three`'s vendored
  `three-examples`) that `tsc -b` doesn't run. Do one full `npm run build` (root script) first so
  those assets exist, then rely on `build:watch` for iterating on `.ts` changes; re-run `npm run
  build` for that package if you touch those vendored assets.
- `npm run build` (the per-package `build` script, or the root `npm run build`) and `tsc -b` are
  two different incremental caches; running one doesn't make the other skip work, and mixing them
  (e.g. `rm -rf dist` then `tsc -b` alone) will skip the asset-copy step above. This is expected,
  not a bug — treat `npm run build` as "full, correct build" and `tsc -b --watch` as "fast
  iteration on top of a build that already ran once."
- This is exactly what CI (`.github/workflows/pull_request_build.yml`) does too (`npm install` at
  the root, then build/test each adapter), so any core interface change should be validated the
  same way locally: run `npm install` at the repo root, then `npm run build && npm test` inside
  each affected `packages/<adapter>` (or all of them, for an interface-level change).
- `switch_example_to_local_gg.sh` always resets the example's `package.json`/`tsconfig.json` to
  their committed state before patching (so re-running it is safe); undo it with
  `etc/restore_example_from_local_gg.sh examples/<example-dir>` to go back to the published
  `@gg-web-engine/*` versions.
- If you ever add a new `packages/<name>/tsconfig.json` (new adapter package) or otherwise touch
  the composite-project setup: every package's tsconfig explicitly sets `rootDir` and
  `tsBuildInfoFile` (both under `./dist/`) alongside `outDir`/`baseUrl`, and this is load-bearing,
  not decoration. With `composite: true` (set once, in `tsconfig.base.json`) but `rootDir`/
  `tsBuildInfoFile` left to their defaults, both `tsc -b` and even a plain per-package `tsc`
  non-deterministically emitted output nested under a stray `dist/src/` (or, for packages whose
  `include` pattern already starts with `src/`, dropped the top-level `dist/index.js` entirely —
  breaking `main`/`types` resolution for consumers) and left an orphaned `tsconfig.tsbuildinfo` at
  the package root instead of inside `dist/`, which then made subsequent builds silently believe
  stale/deleted output was still up to date. Don't remove these two options without re-verifying
  `dist/` layout with a full `rm -rf packages/*/dist && npm run build` afterward — a broken adapter
  package.json (`main: dist/index.js` pointing at a file that doesn't exist) reads as a total build
  failure only when something outside this repo actually imports the package; jest doesn't catch
  it because `moduleNameMapper` bypasses `dist/` for `@gg-web-engine/core` entirely.

## Before starting non-trivial work

Skim `docs/tasks.md` and `milestones.md` — they're a maintained backlog of known architectural gaps
(non-null assertions to remove, rotation-composition FIXME in the 3D loader, DI/event-bus work,
etc.) and may already describe the exact task, its rationale, and acceptance criteria.

## Keep this skill current

This file is read by future agents working on `packages/core`, not by end users of the engine. If
you hit a pitfall it doesn't mention — a build/test step that failed in a non-obvious way, a
generic/type-inference dead end, an interface change that broke more adapters than expected — or
something written here turns out to be wrong or incomplete and you had to dig out the real
answer, add a short note (what went wrong, why, the fix) before finishing the task. Prefer
folding it into the relevant existing section over appending an unstructured log at the bottom.
