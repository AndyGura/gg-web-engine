---
name: gg-engine-visual-adapter
description: Create or modify a rendering-library adapter package for gg-web-engine (packages/three for 3D, packages/pixi for 2D, or a new one such as a babylon/pixi-v9/css-renderer package). Use when the task is to implement core's visual-scene interfaces against a specific rendering library.
---

# Building a visual (rendering) adapter package

A visual adapter package (`packages/three`, `packages/pixi`, or a new one) makes a third-party
rendering library satisfy `@gg-web-engine/core`'s 2D or 3D visual interfaces so it can plug into
`Gg2dWorld`/`Gg3dWorld` as `visualScene`. Read `gg-engine-core-development`'s "TypeDocRepo" section
first if you haven't already — every type here plugs into that generic pattern.

## Decide dimensionality first

Implement either the `3d/components/rendering/*` interfaces (see `packages/three`) or the
`2d/components/rendering/*` ones (see `packages/pixi`) from `packages/core/src`. The two are
structurally similar but not shared — don't try to genericize across them.

## File layout (mirror the closest existing adapter)

```
packages/<lib>/
  src/
    index.ts                              # barrel: export everything consumers need
    types.ts                              # concrete VisualTypeDocRepo(2D|3D) for this lib
    <lib>-factory.ts                      # implements IDisplayObject(2d|3d)ComponentFactory
    <lib>-loader.ts                       # optional: level/asset loading (3D only, see three)
    components/
      <lib>-scene.component.ts            # implements IVisualScene(2d|3d)Component
      <lib>-camera.component.ts           # implements ICamera(2d|3d)Component
      <lib>-renderer.component.ts         # implements IRenderer(2d|3d)Component
      <lib>-display-object.component.ts   # implements IDisplayObject(2d|3d)Component
      <lib>-physics-debug-view.ts         # optional: wireframe/bounds overlay for physics debug
      <lib>-composer-renderer.component.ts # optional: post-processing variant of the renderer
    utils/
      tabulate-array.ts                   # small lib-specific helpers as needed
```

## The TypeDocRepo you must define

In `types.ts`, produce a concrete repo matching the shape core expects
(`VisualTypeDocRepo2D`/`VisualTypeDocRepo3D`):

```typescript
export type <Lib>VisualTypeDocRepo = {
  factory: <Lib>Factory;
  displayObject: <Lib>DisplayObjectComponent;
  renderer: <Lib>RendererComponent;
  rendererExtraOpts: SomeNativeRendererOptionsType; // merged into RendererOptions at call sites
  camera: <Lib>CameraComponent;
  texture: SomeNativeTextureType; // `unknown` if the lib has no texture concept
};
```

Every adapter component class then `implements I<Thing>Component<<Lib>VisualTypeDocRepo>` (or the
2D/3D-specific variant).

## Responsibilities per component

- **Scene component** (`IVisualScene(2d|3d)Component`): owns the native scene graph root,
  `async init()` (create native scene — do heavy/async setup here, not in the constructor),
  `createRenderer(camera, canvas?, rendererOptions?)`, and `dispose()`. Expose the native scene
  object as a getter (`nativeScene` in `ThreeSceneComponent`) for advanced consumer access.
- **Factory** (`IDisplayObject(2d|3d)ComponentFactory`): `createPrimitive(descriptor, material?)`
  is the one required method; the base class in core already provides `createSquare`/`createCircle`
  (2D) shortcuts built on top of it — 3D equivalents should cover the shapes in
  `Shape3DDescriptor` (`packages/core/src/3d/models/shapes.ts`: `PLANE`, `BOX`, `CONE`,
  `CYLINDER`, `CAPSULE`, `SPHERE`, `COMPOUND`, `CONVEX_HULL`, `MESH`) as far as the target library
  reasonably supports; throw a clear `Shape "<x>" not implemented for <Lib>` error for the rest
  rather than silently failing (see `Rapier2dFactory.createColliderDescr` for the pattern, applied
  to physics but identical in spirit).
- **Display object component** (`IDisplayObject(2d|3d)Component`): must implement
  `IPositionable(2d|3d)` — position/rotation getters and setters proxied to the native
  transform — since `Entity(2d|3d)` syncs this against the physics body every tick. This is the
  most performance-sensitive piece; avoid allocating new objects per get/set.
- **Camera component** (`ICamera(2d|3d)Component`): wraps the native camera type; 3D typically
  needs both perspective and orthographic factory methods (see `world.visualScene.factory.
  createPerspectiveCamera()` used in the core README quickstart).
- **Renderer component** (`IRenderer(2d|3d)Component`): accepts an optional `HTMLCanvasElement`
  (create an offscreen/detached canvas if none given) and `RendererOptions`, drives the actual
  draw call, supports resize, and `dispose()`s native GPU resources. `RendererOptions &
  VTypeDoc['rendererExtraOpts']` is the merged options type callers see — put anything
  library-specific (antialias, alpha, power preference, ...) into `rendererExtraOpts`.
- **Physics debug view** (optional but expected for parity with `three`/`pixi`): renders
  wireframes/bounds for the physics world's `children`, toggled via the dev console/debugger UI in
  `packages/core/src/dev/`.

## package.json conventions

Copy `packages/pixi/package.json` (simplest case) or `packages/three/package.json` (if you also
vendor helper sources, see below) as a template:

- `name`: `@gg-web-engine/<lib>`, version kept in lockstep with `@gg-web-engine/core`'s current
  version (check `packages/core/package.json`).
- `@gg-web-engine/core` and the underlying rendering library go in **both** `devDependencies` and
  `peerDependencies`, pinned to the exact version you developed/tested against — adapters do not
  use version ranges for these.
- Scripts: `"build": "tsc"`, `"prepublish": "rm -rf ./dist/ && tsc"`, `"test"` (jest, if you add
  tests — see Testing below), `"prettier-format"` pointing at `../core/.prettierrc`.
- If you vendor extra source from the underlying library (as `three` does for GLTFLoader /
  postprocessing / BufferGeometryUtils under `src/three-examples`, since those ship as examples
  rather than the npm package's main export), add a `sync_<lib>_examples.sh` under `etc/` modeled
  on `packages/three/etc/sync_three_examples.sh`, and copy that folder into `dist/` on build like
  three's `build`/`prepublish` scripts do.
- `tsconfig.json`: copy an existing adapter's (e.g. `packages/pixi/tsconfig.json`) rather than
  writing one from scratch — it must set `baseUrl`/`outDir`/`rootDir` all to `./src/`/`./dist/` and
  `tsBuildInfoFile: "./dist/tsconfig.tsbuildinfo"` explicitly (composite-project build orchestration
  is on repo-wide via `tsconfig.base.json`; leaving these to their defaults silently nests emitted
  output under a stray `dist/src/`, or drops `dist/index.js` entirely — see
  `gg-engine-core-development`'s local dev section for why), and `"references": [{ "path":
  "../core" }]` so root `npm run build:watch` (`tsc -b --watch`) picks up your package.
- If the underlying library ships helper modules under an `examples`/`addons` subpath rather than
  its main entry point (as `three` does for `GLTFLoader`, the postprocessing passes, `CopyShader`,
  and `BufferGeometryUtils`), check that library's own `package.json` `"exports"` map before
  reaching for anything more involved: `three` (and `@types/three`) already declare
  `"./examples/jsm/*"` and `"./addons/*"`, so `packages/three` imports those modules directly, e.g.
  `import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'`, and re-exports them the
  same way from `index.ts` — no vendoring, copying, or sync script needed. Only fall back to
  vendoring a copy under `src/` if the target library's `exports` map genuinely omits the subpath
  you need (blocking the import under Node/webpack's strict ESM resolution even though the file
  exists on disk) — and if you do, keep the copy byte-for-byte and re-verify on every version bump
  that the upstream package still doesn't export it, since a later library release may fix this out
  from under you the way `three` already has.

## Testing

Rendering adapters currently have little/no automated testing in this repo — `three` and `pixi`
are only `npm run build`-checked in CI (`.github/workflows/pull_request_build.yml`), relying on the
`examples/primitives-three-*` / `examples/primitives-pixi-*` example apps for manual smoke
testing. If you do add unit tests (encouraged for factory/shape-mapping logic that doesn't need a
real GPU context), mirror the jest + `jest-environment-jsdom` setup from `packages/matter` or
`packages/rapier2d`.

## Wiring a new adapter into the repo

1. Add a `build` (and `test`, if present) step to `.github/workflows/pull_request_build.yml`,
   following the existing per-package steps.
2. Add `{ "path": "../<lib>" }` to the root `tsconfig.json`'s `references` array (so `npm run
   build:watch` picks it up) and the package name to the `libs` array in
   `etc/publish_new_version.sh` (so releases include it) — see `gg-engine-release`. You do **not**
   need to register it anywhere for local dev linking: `packages/*` is an npm workspace, so a new
   directory under `packages/` joins it automatically on the next `npm install`.
3. Add at least one example under `examples/` combining your new visual package with an existing
   physics package (or vice versa) — see `gg-engine-examples`.
4. Add the package to the "Integrations" list in the root `README.md` and give it its own
   `packages/<lib>/README.md`.
5. Use `npm install` at the repo root and `bash etc/switch_example_to_local_gg.sh <example-dir>`
   (plus `npm run build:watch` at the repo root for the live-reload loop) to develop end-to-end
   against local (unpublished) core/adapter builds rather than publishing throwaway versions — see
   `gg-engine-core-development`'s local dev workflow section.

## Keep this skill current

This file is read by future agents building/maintaining rendering adapters, not by end users of
the engine. If a library-specific quirk bites you (a native API that doesn't map cleanly onto a
core interface, a build/link step that failed in a non-obvious way, a shape or option this file
implied was easy but wasn't), or something written here turns out wrong or incomplete once you've
actually implemented it, add a short note (what went wrong, why, the fix) before finishing —
folded into the relevant section rather than left as a loose log entry.
