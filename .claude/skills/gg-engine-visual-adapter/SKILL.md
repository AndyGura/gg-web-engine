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

## Testing

Rendering adapters currently have little/no automated testing in this repo — `three` and `pixi`
are only `npm run build`-checked in CI (`.github/workflows/tests.yml`), relying on the
`examples/primitives-three-*` / `examples/primitives-pixi-*` example apps for manual smoke
testing. If you do add unit tests (encouraged for factory/shape-mapping logic that doesn't need a
real GPU context), mirror the jest + `jest-environment-jsdom` setup from `packages/matter` or
`packages/rapier2d`.

## Wiring a new adapter into the repo

1. Add a `build` (and `test`, if present) step to `.github/workflows/tests.yml`, following the
   existing per-package steps.
2. Add the package name to the `libs` array in `etc/switch_libs_to_local_core.sh` (so CI/local dev
   can link your package against a local core build) and in `etc/publish_new_version.sh` (so
   releases include it) — see `gg-engine-release`.
3. Add at least one example under `examples/` combining your new visual package with an existing
   physics package (or vice versa) — see `gg-engine-examples`.
4. Add the package to the "Integrations" list in the root `README.md` and give it its own
   `packages/<lib>/README.md`.
5. Use `bash etc/switch_libs_to_local_core.sh` and `bash etc/switch_example_to_local_gg.sh
   <example-dir>` to develop end-to-end against local (unpublished) core/adapter builds via
   `npm link` rather than publishing throwaway versions.
