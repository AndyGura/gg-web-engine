---
name: gg-engine-visual-adapter
description: Create or modify a rendering-library adapter package for gg-web-engine (packages/three for 3D, packages/pixi for 2D, or a new one such as a babylon/pixi-v9/css-renderer package). Use when the task is to implement core's visual-scene interfaces against a specific rendering library.
---

# Building a visual (rendering) adapter package

A visual adapter package (`packages/three`, `packages/pixi`, or a new one) makes a third-party
rendering library satisfy `@gg-web-engine/core`'s 2D or 3D visual interfaces so it can plug into
`Gg2dWorld`/`Gg3dWorld` as `visualScene`. Read `gg-engine-core-development`'s "TypeDocRepo" section
first if you haven't already — every type here plugs into that generic pattern. This file is the
general contract; library-specific history for the already-shipped adapters lives in
`gg-engine-visual-adapter-three` and `gg-engine-visual-adapter-pixi` - load the matching one when
the task is fixing or extending `packages/three` or `packages/pixi` itself.

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
  `readonly backendName` (a short, stable library name - `'three'`, `'pixi'` - shown by the dev
  console's `worlds`/`world` commands; one constant per adapter, never per instance),
  `async init()` (create native scene — do heavy/async setup here, not in the constructor),
  `createRenderer(camera, canvas?, rendererOptions?)`, and `dispose()`. Expose the native scene
  object as a getter (`nativeScene` in `ThreeSceneComponent`) for advanced consumer access, plus a
  `requireNativeScene(action)`-style accessor that throws core's
  `notInitializedError(component, 'visualScene', action)` while it is `null`: a display object's or
  renderer's `addToWorld` goes through it, so an entity added before `await world.init()` fails
  with an error naming the fix instead of silently never appearing. Core tells a 3D scene from a 2D
  one by `registerRenderLayer`/factory `createLight` (3D) and factory `createParallaxLayer` (2D), so
  keep those members on the matching dimension only. 3D only:
  also owns render layers — `mainRenderLayer` must report `0` (matching a fresh native scene
  graph's own default layer, so it agrees with `MAIN_RENDER_LAYER` without either needing to be
  threaded through call sites) and `registerRenderLayer()`/`deregisterRenderLayer(layer)` allocate/
  free layer indices from a locked pool (see `ThreeSceneComponent.lockedRenderLayers` for the
  pattern); deregistering doesn't itself touch any object's/camera's current layer membership.
- **Factory** (`IDisplayObject(2d|3d)ComponentFactory`): `createPrimitive(descriptor, material?)`
  is the one required method; the base class in core already provides `createBox`/`createCircle`/
  `createCapsule`/`createConvexHull`/`createPolygon` (2D) shortcuts built on top of it (no
  `createCompound` shortcut, in either dimension — a compound's `children` are too shape-specific
  to give a single convenience-method signature) — `createPrimitive` itself must still cover every
  `Shape2DDescriptor` member (`packages/core/src/2d/models/shapes.ts`: `BOX`, `CIRCLE`, `CAPSULE`,
  `CONVEX_HULL`, `POLYGON`, `COMPOUND`) as far as the target library reasonably supports. `COMPOUND`
  is a `Container`/`Group`-style parent holding one child display object per entry, each positioned/
  rotated to its own `position`/`rotation` (a 2D `rotation` is a scalar in radians, not 3D's `Point4`
  quaternion) — see `PixiFactory.createPrimitive`'s `COMPOUND` case or `ThreeFactory.createPrimitive`'s
  for the pattern (recurse into `createPrimitive` per child, nest the resulting native objects). 3D
  equivalents should cover the shapes in `Shape3DDescriptor` (`packages/core/src/3d/models/
  shapes.ts`: `PLANE`, `BOX`, `CONE`, `CYLINDER`, `CAPSULE`, `SPHERE`, `COMPOUND`, `CONVEX_HULL`,
  `MESH`) the same way; throw a clear `Shape "<x>" not implemented for <Lib>` error for the rest
  rather than silently failing (see `Rapier2dFactory.createColliderDescr` for the pattern, applied
  to physics but identical in spirit).
  Material options to honor: 3D `opacity` (below `1` makes the material transparent); 2D `opacity`,
  `stroke: { color, width }` (an outline on every untextured shape) and `color`, which fills an
  untextured shape and tints a textured one. In a `COMPOUND`, apply `opacity` once on the
  container, not again on every part, or the parts multiply it. Textures: 3D's loader
  `loadTexture(url, { mapping, filter, repeat })` and both dimensions' factory
  `createTextureFromCanvas(canvas, options?)` (treat the canvas like an image file, i.e. sRGB)
  share one options helper in `packages/three` (`utils/texture-options.ts`); `repeat` sets the wrap
  mode to repeat as well as the repeat count. 2D's factory `loadTexture(url, { filter })` maps
  `filter` onto the texture's scale mode. 2D's factory also has `createText(text, style)`, returning
  the TypeDoc's `text` member (an `IText2dComponent`: `text`, a `style` read-back and a merging
  `setStyle(partial)` - rebuild the native style from the merged `Text2dStyle` each time, so a field
  set earlier is never lost).
- **Display object component** (`IDisplayObject(2d|3d)Component`): must implement
  `IPositionable(2d|3d)` — position/rotation getters and setters proxied to the native
  transform — since `Entity(2d|3d)` syncs this against the physics body every tick. This is the
  most performance-sensitive piece; avoid allocating new objects per get/set. 3D only: also
  implements `enableRenderLayer`/`disableRenderLayer`/`isRenderLayerEnabled(layer)` — a
  layer-membership bitmask tested the same way collision groups are (an object is rendered by a
  given camera iff at least one layer is enabled on both sides). Apply these to the object's
  *entire native subtree* (its own root node plus every descendant), not just the root, since a
  multi-mesh model must hide/show as one unit — see `ThreeDisplayObjectComponent.
  enableRenderLayer`'s `nativeMesh.traverse(...)` for the pattern, and check whether your library's
  traversal helper visits the root node itself or only descendants - a root left out stays on the
  wrong layer.
  `castShadow`/`receiveShadow` (3D) follow the same whole-subtree rule on write (a loaded model's
  sub-meshes are what actually render) and read back the root's own value, skipping any lights
  embedded in the subtree (on a light that flag is the light's own shadow setting). `createPrimitive` must
  apply `DisplayObject3dOpts.castShadow`/`receiveShadow` through those setters rather than on the
  root node alone, or a `COMPOUND`'s parts never cast shadows. 2D adds `tint` (multiplied over the
  object's colors, `0xffffff` = none) and `opacity`, both inherited by children. Both dimensions
  implement `addChild(child)`/`removeChild(child)` as native scene-graph nesting, so the child's
  transform becomes relative to the parent; `removeChild` of something that isn't a direct child is
  a no-op, and `dispose()` must take nested children with it. `clone()` must return a component
  around its own copy of the native object and its nested children, never one wrapping the same
  native object. The copy shares the heavy resources with its source and must not free them: core's
  loader caches one original per loaded file and hands out a `clone()` per use, so a copy that
  freed shared geometry on `dispose()` would pull it out from under its siblings. The source frees
  them, and is disposed last (see `IDisplayObjectComponent.clone`'s doc). In `packages/three` this
  is `ThreeDisplayObjectComponent.resourceOwnership` (see `gg-engine-visual-adapter-three`). A
  library without a generic deep-clone needs a hand-rolled one covering every kind of native object
  the package creates (`packages/pixi`'s `src/utils/clone-container.ts`, see
  `gg-engine-visual-adapter-pixi`).
- **Camera component** (`ICamera(2d|3d)Component`): wraps the native camera type; 3D typically
  needs both perspective and orthographic factory methods (see `world.visualScene.factory.
  createPerspectiveCamera()` used in the core README quickstart). 3D only: `ICamera3dComponent`
  extends `IDisplayObject3dComponent`, so it inherits the same three render-layer methods rather
  than declaring its own — a freshly-created camera must default to rendering *every* layer (three:
  `nativeCamera.layers.enableAll()`, not just the main one), so only a camera that deliberately
  wants to exclude something (e.g. hiding a character's own body from its own first-person view via
  `SELF_VIEW_HIDDEN_RENDER_LAYER`) ever needs to call `disableRenderLayer`.
- **Lights (3D)**: `IDisplayObject3dComponentFactory.createLight(descriptor)` returns the TypeDoc's
  `light` member, an `ILight3dComponent` (a display object plus `lightType`/`color`/`intensity`/
  `castShadow` and a `lightOptions` read-back that reflects live values). Cover every
  `Light3dDescriptor` type (`AMBIENT`, `HEMISPHERE`, `DIRECTIONAL`, `POINT`, `SPOT`) and apply
  `shadow` options (`area` is the half-size of a directional light's orthographic shadow frustum).
  Directional and spot lights must shine along the component's local `-Z`, so their direction follows
  the rotation the engine sets; a library that aims lights at a separate target object, or derives
  a hemisphere light's direction from its position, has to be adapted so the component's
  `position`/`rotation` still mean what the engine expects (see `ThreeLightComponent` and
  `gg-engine-visual-adapter-three`). `clone()` should rebuild from `lightOptions` rather than
  deep-copying the native object, so a clone never references a target outside its own hierarchy.
- **Scene environment (3D)**: `IVisualScene3dComponent.environment`/`setEnvironment(partial)` -
  merge semantics (an absent field is untouched, `null` clears it) over `background` (color or
  texture), `environmentMap` and `fog` (`LINEAR`/`EXPONENTIAL`). Sky textures come from the loader's
  `loadCubeTexture({ px, nx, py, ny, pz, nz })` and `loadTexture(url, { mapping: 'equirectangular' })`
  and must come out oriented for the Z-up world, each cube face upright as `CubeTextureFaces`
  documents (side images' top edge towards `+Z`, `pz`'s towards `+Y`, `nz`'s towards `-Y`), not just
  in the right direction. A Y-up library needs a rotation of the sky plus, for a cube map, a
  re-mapping of which image goes into which native slot - moving faces between slots alone can never
  do it, since a face's slot fixes which way its top edge points (see `gg-engine-visual-adapter-three`
  for three.js's exact mapping). Verify any such orientation question by rendering in headless
  Chromium (ANGLE/SwiftShader) and reading pixels back looking along each axis - with faces that
  carry a marker on their top and left edges, since solid-colored faces show the direction but not a
  rotated or mirrored image - and, for the environment map, the reflection on a mirror-like sphere.
  The loader's `disposeTexture(texture)` frees a texture either load method returned.
- **Cameras**: the factory creates them, so an app never constructs an adapter class for one -
  `createPerspectiveCamera(settings)` on the 3D factory, `createCamera()` (an `ICamera2dComponent`,
  `position` at the view's top-left, `zoom` 1) on the 2D one.
- **Draw order and backdrops (2D)**: `IDisplayObject2dComponent.zIndex` orders siblings.
  `IVisualScene2dComponent.environment`/`setEnvironment(partial)` holds `background`: a color, a
  texture drawn fixed to the screen and scaled to cover the view, or `null` for the clear color the
  renderer was created with; the renderer applies it on every `render()`, and must not touch the
  native clear color at all when there is no environment color, so library-native options such as a
  background alpha passed through the renderer options stay in effect.
  `IDisplayObject2dComponentFactory.createParallaxLayer(options)` returns the TypeDoc's
  `parallaxLayer` member (an `IParallaxLayer2dComponent`); resolve its options with core's
  `resolveParallaxLayer2dOpts` so defaults match. A layer depends on the camera, and a scene can have
  several renderers, so each renderer positions every layer for its own camera right before drawing
  (`updateView(cameraPosition, halfExtent)`, with `halfExtent = hypot(width, height) / 2 / zoom` on
  both axes so a rotated camera stays covered). A layer lives in the world container so it sorts by
  `zIndex` against everything else. Per axis, the texture's world origin is
  `offset + camera * (1 - parallax)`; a repeating axis spans the whole view with
  `tilePosition = (origin - viewStart) mod tileSize`, a non-repeating one is placed at the origin
  one tile wide. `factory.loadTexture(url)` or `factory.createTextureFromCanvas` supplies textures
  for both. `PixiParallaxLayerComponent` is the reference implementation.
- **Renderer component** (`IRenderer(2d|3d)Component`): accepts an optional `HTMLCanvasElement`
  (create an offscreen/detached canvas if none given) and `RendererOptions`, drives the actual
  draw call, supports resize, and `dispose()`s native GPU resources. `RendererOptions &
  VTypeDoc['rendererExtraOpts']` is the merged options type callers see — put anything
  library-specific (antialias, alpha, power preference, ...) into `rendererExtraOpts`.
- **Physics debug view** (optional but expected for parity with `three`/`pixi`): renders
  wireframes/bounds for the physics world's `children`, toggled via the dev console/debugger UI in
  `packages/core/src/dev/`.
- **Animated display object** (optional, both dimensions): a display object backed by a bone-animated
  model (3D: loaded skinned mesh + clips) or a frame-based atlas (2D: a sprite sheet's named clips)
  implements `IAnimatedDisplayObject3dComponent`/`IAnimatedDisplayObject2dComponent` on top of the
  ordinary display object contract - see `gg-engine-core-development`'s note on this pattern
  (declared as its own interface, not baked into the `TypeDoc`'s `displayObject` field, with an
  `isXxx` type guard at call sites). `packages/three`'s `ThreeAnimatedDisplayObjectComponent`
  (`components/three-animated-display-object.component.ts`) is the reference 3D implementation: a
  per-instance mixer, a `Map<clipName, clip>`, and `playAnimation`/`stopAnimation` cross-fading
  between actions. A skinned mesh's `clone()` must produce a copy whose skeleton references the
  *copy's* bones, not the original's - a library's generic deep-clone usually gets this wrong (see
  `gg-engine-visual-adapter-three` for the three.js specifics).

  A loaded model's own origin often isn't the point that should track the entity driving it (e.g. a
  character rig authored with its origin at the feet, needing to align with a
  `CharacterController3dEntity` capsule's *center*) - `IDisplayObject3dComponentLoader.loadFromGlb`'s
  `LoadGlbOptions.offset` handles this by wrapping the loaded scene one level deeper in a plain
  group node and applying the offset to the *inner* node, leaving the outer group (returned as the
  native root) untouched at identity. Never apply such an offset directly to the node whose
  `position` a display object component's own `position` setter writes to, since that gets
  overwritten wholesale every tick by whatever drives it (`Entity3d`/`CharacterController3dEntity`
  syncing from a body/controller), silently discarding the offset the next tick.

  `packages/pixi`'s `PixiAnimatedSpriteComponent` (`components/pixi-animated-sprite.component.ts`)
  is the reference 2D implementation, built by `createAnimatedSprite(baseTexture, { frameWidth,
  frameHeight, clips })` from a uniform-grid atlas (one row per named clip, `frameCount`
  consecutive columns starting at column 0); slice frames as views sharing the base texture rather
  than copying pixels. Animation advances only from the engine's own per-tick
  `updateAnimations(deltaSeconds)` - never from the library's own shared ticker/frame loop, since
  every adapter here is driven by the engine's tick loop - so make sure the native sprite doesn't
  auto-subscribe to one on `play()` (see `gg-engine-visual-adapter-pixi` for the pixi specifics).
- **Material readability** (expected, cheap - implement this on every `createPrimitive`-produced
  display object): a display object built by `createPrimitive` (or a shortcut on it) should remember
  the `DisplayObject(2d|3d)Opts` it was actually constructed with as a plain `materialOptions` field,
  implementing `IMaterialReadable(2d|3d)Component` (`{3d,2d}/components/rendering/
  i-material-readable-{3d,2d}.component.ts` in `packages/core`) - see `gg-engine-core-development`'s
  note on this same "capability only some display objects have" pattern for why it's a separate
  interface rather than a `TypeDoc`/base-contract field. This is what lets `LevelLoader`'s
  `"Primitive"` live serializer (and `GgCarEntity.serializeSettings`) recover a `material` for the
  `EntityJson` they emit, instead of a serialized primitive always reloading with an unrelated
  default/random color. `ThreeDisplayObjectComponent`/`PixiDisplayObjectComponent` are the reference
  implementations: an optional second constructor parameter, assigned to a `public readonly
  materialOptions?` field only when given (so `isMaterialReadable(2d|3d)`'s field-presence check
  correctly reports "no capability" for a display object built any other way, e.g. a loaded `.glb`
  mesh or `createAnimatedSprite`'s output - neither passes a `materialOptions` argument through).
  `ThreeFactory.createPrimitive`/`PixiFactory.createPrimitive` pass their own `material` parameter
  straight through to every display object component they construct - the caller's parameter
  verbatim, not the fully-resolved material actually applied (e.g. a random auto-picked color, when
  none was given, reads back as `{}` again, not the specific color that got picked) - acceptable,
  since round-tripping a genuinely unspecified color isn't expected to be deterministic anyway.

## Loading: core fetches, the adapter decodes

`world.loader` (core) does every fetch itself - that is where byte progress, cancellation and the
per-world asset cache live - and hands the adapter data to turn into resources. The adapter never
sees a progress callback or an abort signal; core counts the decode phase as done when the
adapter's promise resolves. What an adapter provides:

- **Models** (3D loader): `loadFromGgGlb(arrayBuffer, meta)` and `loadFromGlb(arrayBuffer, options)`
  already take bytes.
- **Textures**: `textureFromData(blob, options)` on the 3D loader (plus
  `cubeTextureFromData({ px, ..., nz })`) and on the 2D factory. `options.url` (3D) is the original
  url, for anything decided by file extension - a blob has none. Decode the blob through the same
  native path `loadTexture(url)` uses (three: an object url fed to the same loaders, revoked
  afterwards) so orientation, color space and HDR handling can't differ between the two - unless
  that path is a library-global asset cache with no owner to free the texture, in which case decode
  into a texture of your own (pixi: `createImageBitmap`, see `gg-engine-visual-adapter-pixi`).
- **`disposeTexture(texture)`**: frees what `textureFromData` made. Core calls it when the last
  holder of the cached texture lets go.
- **`prepare(resource)`** (optional): do now what would otherwise happen on the first frame the
  resource is visible - upload textures, compile shaders - so it is part of the reported load. It
  needs a renderer, so the scene keeps a `renderers` set that each renderer component joins in
  `addToWorld` and leaves in `removeFromWorld`/`dispose`; with none, `prepare` resolves at once.
  three: texture upload plus shader compilation per model (see `gg-engine-visual-adapter-three`);
  pixi: texture source upload (see `gg-engine-visual-adapter-pixi`). Avoid any library "prepare"
  helper that waits for a frame of the library's own ticker: a background tab may never deliver
  one, and the load would hang.

All four are optional in core's interfaces. Without `textureFromData` core calls the url-taking
`loadTexture` instead: it still works and is still cached, but the download is invisible to the
progress and can't be aborted.

## Renderer disposal gives the context back

A browser allows a page about 16 WebGL contexts and frees a discarded one only at garbage
collection, so an app that creates a world per game session (menu → game → menu → ...) runs out
unless the renderer's `dispose()` releases its context explicitly (three:
`forceContextLoss()`, see `gg-engine-visual-adapter-three`). The price: a canvas whose context was
force-lost can't host another renderer, so each renderer gets a canvas of its own, and anything a
subclass disposes that lives in the context (a composer's render targets) goes before
`super.dispose()`.

A renderer can be disposed before an async native init has finished (a screen popped while its
world was still starting). A renderer with an async init must handle that order without leaking the
context the late init creates - mark itself disposed and let the init callback destroy the native
renderer (see `PixiRendererComponent` and `gg-engine-visual-adapter-pixi`). Work deferred until init
(`render`, `resizeRenderer`) waits on `onInitialized$.pipe(take(1))`, never `first()`: `dispose()`
completes that subject, and `first()` errors on a subject completed without a value.

## The `removeFromWorld(dispose)` contract

Every component class here also implements the same base `IWorldComponent` a physics adapter's
components do (see `gg-engine-physics-adapter`'s section on this contract for the full statement):
`removeFromWorld(world, dispose?)` must free the component's own native/GPU resources when `dispose`
is `true`, not merely stop tracking it. Every component already has a `dispose()` that frees its
native objects (scene graph nodes, geometry/materials, the renderer itself); `removeFromWorld(world,
dispose)` has to actually call it, the same pattern physics adapters use.

## package.json conventions

Copy `packages/pixi/package.json` (simplest case) or `packages/three/package.json` (if you also
need a jest transform for an ESM-only library, see Testing below) as a template:

- `name`: `@gg-web-engine/<lib>`, version kept in lockstep with `@gg-web-engine/core`'s current
  version (check `packages/core/package.json`).
- `"sideEffects"`: `false`, unless a module of the package does something on import that another
  module relies on - then list exactly those files (`dist/...`). It lets an app's bundler leave out
  every module of the package the app doesn't use; a module listed nowhere and whose exports go
  unused is dropped together with whatever it does on import. `three` and `pixi` have no such module and declare `false`.
- `@gg-web-engine/core` goes in **both** `devDependencies` and `peerDependencies`; the underlying
  rendering library (with its `@types/*` package, if typings ship separately - `three` +
  `@types/three`) goes in `dependencies`, so an app installs the adapter alone. Both are pinned to
  the exact version you developed/tested against — adapters do not use version ranges for these. A bump of the library must also update any other workspace member
  that pins it: `e2e/blender-export/app` pins `three` (and `@dimforge/rapier3d-compat`). A differing
  pin installs a second copy, and that harness's `instanceof` checks fail against the adapter's
  objects (see its README).
- Scripts: `"build": "tsc"`, `"prepublish": "rm -rf ./dist/ && tsc"`, `"test"` (jest, if you add
  tests — see Testing below), `"prettier-format"` pointing at `../core/.prettierrc`.
- `tsconfig.json`: copy an existing adapter's (e.g. `packages/pixi/tsconfig.json`) rather than
  writing one from scratch — it must set `baseUrl`/`outDir`/`rootDir` all to `./src/`/`./dist/` and
  `tsBuildInfoFile: "./dist/tsconfig.tsbuildinfo"` explicitly (composite-project build orchestration
  is on repo-wide via `tsconfig.base.json`; leaving these to their defaults silently nests emitted
  output under a stray `dist/src/`, or drops `dist/index.js` entirely — see
  `gg-engine-core-development`'s local dev section for why), and `"references": [{ "path":
  "../core" }]` so root `npm run build:watch` (`tsc -b --watch`) picks up your package.
- If the underlying library ships helper modules under an `examples`/`addons` subpath rather than
  its main entry point (as `three` does for `GLTFLoader`, the postprocessing passes and
  `BufferGeometryUtils`), check that library's own `package.json` `"exports"` map before reaching
  for anything more involved: if the subpath is exported (three: `"./examples/jsm/*"` and
  `"./addons/*"`), import it directly and re-export what consumers need from `index.ts` — no
  vendoring, copying, or sync script. Only fall back to vendoring a copy under `src/` if the
  `exports` map genuinely omits the subpath you need (blocking the import under Node/webpack's
  strict ESM resolution even though the file exists on disk) — and if you do, keep the copy
  byte-for-byte and re-verify on every version bump that the upstream package still doesn't export
  it, since a later library release may fix this out from under you.

## Testing

Both `three` and `pixi` have a jest + `jest-environment-jsdom` suite (`npm test` in each package;
picked up automatically by the root `npm run test` / CI, no per-package wiring needed — see root
`package.json`'s `test` script). Coverage is still thin relative to the physics adapters — mostly
factory/shape-mapping and small pure-utility logic that doesn't need a real GPU context — and the
`examples/3d/primitives` / `examples/2d/primitives` example apps remain the way to
smoke-test anything that does need a real renderer. When adding a test, mirror `packages/three`'s
setup (the sibling visual adapter) rather than a physics adapter's: same `package.json` `jest` block
(`ts-jest` preset, `moduleNameMapper` pointing `@gg-web-engine/core` at `../core/src/index.ts`,
`testEnvironment: "jsdom"`), and the same `tsconfig.json` shape — `"include": ["src/*.ts",
"src/**/*.ts"]` (scoped to `src/` only, so `tsc -b`'s project-reference build doesn't try to compile
`test/**/*` too) plus an explicit `"types"` array so `describe`/`it`/`expect` resolve under TS 6 (see
`gg-engine-core-development`'s TS6 pitfalls). If the package also carries an ambient global-only
`@types/*` devDependency (because the library's own `.d.ts` reference a browser global the Node
types lack, like `OffscreenCanvas`), that package's name must be added to the same `"types"` array
too — an explicit `"types"` array replaces TS's default "auto-include everything under
`node_modules/@types`" behavior, so leaving it out silently breaks that ambient type instead of
just adding jest globals.

**An ESM-only rendering library can't be `require`d by jest's CJS pipeline out of the box**: jest
leaves `node_modules` untransformed, and its "require() of ES modules on Node 24.9+" fallback only
applies to files its transform pipeline has already parsed, so a spec that imports a real value from
the library fails with `Must use import to load ES Module: ...` even on a Node version that supports
native `require(esm)` outside jest. The working fix is a narrow `babel-jest` transform for exactly
the library's own paths (`@babel/plugin-transform-modules-commonjs` in a `babel.config.js`, a
second `transform` entry for `/node_modules/<lib>/.../.+\.js$`, and a matching
`transformIgnorePatterns` carve-out), plus a `moduleNameMapper` entry that points the bare package
name straight at its ESM entry when the `require` export condition is only a deprecation shim.
`packages/three` has this applied; `gg-engine-visual-adapter-three` documents the exact config and
the `@babel/*` version pins it needs (a peer-range mismatch there passes the workspace install but
breaks the release script's standalone install). `packages/pixi` does not have it yet - `pixi.js`
pulls in the pure-ESM `earcut`, so its specs never `require` the real module: they replace it with
`jest.mock('pixi.js', () => ({ ... }))` (the factory must export every name the file under test
imports at module level, as empty classes if nothing else) or use `import type` plus a plain fake
object cast to the pixi type (see `gg-engine-visual-adapter-pixi`). Either way, jsdom has no
`URL.createObjectURL`/`revokeObjectURL`, no `createImageBitmap` and no WebGL, so a spec for the
decode-from-data methods assigns fakes for those and spies on the native loader, `prepare` is tested
against fake renderer objects put into the scene's `renderers` set, and anything that needs a real
draw call is verified in the primitives example or by rendering in headless Chromium.

## Wiring a new adapter into the repo

1. Nothing to add to `.github/workflows/pull_request_build.yml` — it's a single generic job
   (`npm install`, `npm run build`, `npm run test` at the repo root), not per-package steps; the
   root `test` script already runs `npm run test --workspace=packages --if-present`, so any package
   with a `test` script in its own `package.json` (including a brand-new one) is picked up
   automatically.
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

This file is read by future agents *building a new* rendering adapter, not by end users of the
engine, and not primarily by agents fixing/extending an already-existing one (`three`/`pixi`) -
those have their own sibling skills (`gg-engine-visual-adapter-three`/`-pixi`). If a native
library's API fights the *general* mapping/contract described here in a way any future adapter
would hit (a pattern in `IVisualScene*`/`IDisplayObject*` that's awkward to satisfy regardless of
which library you're wrapping, a build/link step that failed in a non-obvious way), or something
general written here turns out wrong or incomplete, update this file. If instead you hit something
specific to one of the two already-implemented libraries - an API quirk, a version-bump break, a
build/typing/jest gotcha, a leak found and fixed - fold that lesson into that library's own sibling
skill file instead, so this file stays a lean "how to build an adapter" guide rather than
re-accumulating per-library archaeology. Either way: a short note (what went wrong, why, the fix),
folded into the relevant section rather than left as a loose log entry.
