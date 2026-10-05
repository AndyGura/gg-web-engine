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
  object as a getter (`nativeScene` in `ThreeSceneComponent`) for advanced consumer access. 3D only:
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
  `stroke: { color, width }` (an outline on every untextured shape - so an untextured stroked `BOX`
  can't be pixi's cheap tinted-`Texture.WHITE` sprite and becomes a `Graphics` rect) and `color`,
  which fills an untextured shape and tints a textured one. In a `COMPOUND`, apply `opacity` once on
  the container, not again on every part, or the parts multiply it. Textures: 3D's loader
  `loadTexture(url, { mapping, filter, repeat })` and both dimensions' factory
  `createTextureFromCanvas(canvas, options?)` (three: `CanvasTexture`, `colorSpace = SRGBColorSpace`
  like an image file; pixi: `Texture.from(canvas)`) share one options helper in `packages/three`
  (`utils/texture-options.ts`); `repeat` sets the wrap mode to repeat as well as the repeat count.
  2D's factory `loadTexture(url, { filter })` maps `filter` onto `texture.source.scaleMode` - the
  source is shared by every texture of that image, which pixi's `Assets` cache hands out per url.
  2D's factory also has `createText(text, style)`, returning the TypeDoc's `text` member (an
  `IText2dComponent`: `text`, a `style` read-back and a merging `setStyle(partial)`; see
  `PixiTextComponent`, which rebuilds the native style object from the merged `Text2dStyle` each
  time, so a field set earlier is never lost).
- **Display object component** (`IDisplayObject(2d|3d)Component`): must implement
  `IPositionable(2d|3d)` — position/rotation getters and setters proxied to the native
  transform — since `Entity(2d|3d)` syncs this against the physics body every tick. This is the
  most performance-sensitive piece; avoid allocating new objects per get/set. 3D only: also
  implements `enableRenderLayer`/`disableRenderLayer`/`isRenderLayerEnabled(layer)` — a
  layer-membership bitmask tested the same way collision groups are (an object is rendered by a
  given camera iff at least one layer is enabled on both sides). Apply these to the object's
  *entire native subtree* (its own root node plus every descendant), not just the root, since a
  multi-mesh model must hide/show as one unit — see `ThreeDisplayObjectComponent.
  enableRenderLayer`'s `nativeMesh.traverse(...)` for the pattern. Watch the traversal callback's
  own semantics here: three.js's `Object3D.traverse()` fires on the root node itself *first*, then
  recursively on children — a traversal that assumes it only ever visits descendants will silently
  skip the root and leave it on the wrong layer.
  `castShadow`/`receiveShadow` (3D) follow the same whole-subtree rule on write (a loaded model's
  sub-meshes are what actually render) and read back the root's own value. The `castShadow` write
  skips lights embedded in the subtree (a loaded model can carry them): on a light that flag turns
  shadow map rendering on or off, which is the light's own setting. `createPrimitive` must
  apply `DisplayObject3dOpts.castShadow`/`receiveShadow` through those setters rather than on the
  root node alone, or a `COMPOUND`'s parts never cast shadows. 2D adds `tint` (multiplied over the
  object's colors, `0xffffff` = none; pixi: `Container.tint`) and `opacity` (pixi: `alpha`), both
  inherited by children. Both dimensions implement `addChild(child)`/`removeChild(child)` as native
  scene-graph nesting (three: `Object3D.add`/`remove`; pixi: `Container.addChild`/`removeChild`),
  so the child's transform becomes relative to the parent; `removeChild` of something that isn't a
  direct child is a no-op, and `dispose()` must take nested children with it (pixi:
  `destroy({ children: true })`; three's `dispose()` already traverses). `clone()` must return a
  component around its own copy of the native object and its nested children, never one wrapping
  the same native object. The copy shares the heavy resources with its source and must not free
  them: core's loader caches one original per loaded file and hands out a `clone()` per use, so a
  copy that freed shared geometry on `dispose()` would pull it out from under its siblings. The
  source frees them, and is disposed last (see `IDisplayObjectComponent.clone`'s doc). In
  `packages/three` this is `ThreeDisplayObjectComponent.resourceOwnership`: `'meshes'` by default
  (geometry and materials, never textures - a primitive's `diffuse` belongs to whoever loaded it),
  `'all'` for what `ThreeLoader` returns (a model's textures came with its file; `popChild` passes
  it on to the parts a model is split into), `'none'` for every `clone()`. A subclass overriding
  `clone()` (`ThreeAnimatedDisplayObjectComponent`) has to set `'none'` on its copy too. three has
  `Object3D.clone()`; pixi has no generic `Container.clone()`, so `src/utils/clone-container.ts`
  rebuilds each kind of native object the package creates (`cloneContainer`, sharing only textures)
  and a component subclass with its own constructor arguments or state overrides `clone()` to
  return its own class (`copyContainerState` copies transform, tint, opacity and children onto a
  native object the subclass built itself). A new kind of native object the package starts creating
  needs a branch in `cloneContainer`, which otherwise copies it as an empty `Container`.
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
  the rotation the engine sets: three.js aims them at a separate `target` object, which
  `ThreeLightComponent` parents to the light one unit along `-Z` (three.js's own default leaves the
  target at the world origin, and both light types start at `(0, 1, 0)` - reset that to the origin).
  A three.js `HemisphereLight` takes its sky direction from its *position*, so its position setter is
  ignored and the native position is kept at the rotated `+Z` unit vector instead. `clone()` rebuilds
  from `lightOptions` rather than `Object3D.clone()`, which would leave the clone's `target`
  pointing at an object outside its hierarchy.
- **Scene environment (3D)**: `IVisualScene3dComponent.environment`/`setEnvironment(partial)` -
  merge semantics (an absent field is untouched, `null` clears it) over `background` (color or
  texture), `environmentMap` and `fog` (`LINEAR`/`EXPONENTIAL`). Sky textures come from the loader's
  `loadCubeTexture({ px, nx, py, ny, pz, nz })` and `loadTexture(url, { mapping: 'equirectangular' })`
  and must come out oriented for the Z-up world, each cube face upright as `CubeTextureFaces`
  documents (side images' top edge towards `+Z`, `pz`'s towards `+Y`, `nz`'s towards `-Y`), not just
  in the right direction. three.js samples both kinds of sky texture Y-up, so `ThreeSceneComponent`
  sets `scene.backgroundRotation`/`environmentRotation` to `+PI/2` around X for either; for a cube
  map `ThreeLoader.loadCubeTexture` fills three's slots to match that rotation (`pz` into `py`, `nz`
  into `ny`, `ny` into `pz`, `py` into `nz`) and swaps `px`/`nx`, because three.js samples cube maps
  with X mirrored. Moving faces between slots alone can never do this: a face's slot fixes which way
  its top edge points, so the side images would lie on their side. Verify any such orientation
  question by rendering in headless Chromium (ANGLE/SwiftShader) and reading pixels back looking
  along each axis - with faces that carry a marker on their top and left edges, since solid-colored
  faces show the direction but not a rotated or mirrored image - and, for the environment map, the
  reflection on a mirror-like sphere. The loader's `disposeTexture(texture)` frees a texture either
  load method returned.
- **Draw order and backdrops (2D)**: `IDisplayObject2dComponent.zIndex` orders siblings (pixi: the
  scene's world container is created with `sortableChildren: true` and `zIndex` maps to the native
  `zIndex`). `IVisualScene2dComponent.environment`/`setEnvironment(partial)` holds `background`: a
  color, a texture drawn fixed to the screen and scaled to cover the view, or `null` for the
  clear color the renderer was created with. The pixi renderer applies it every `render()`: a color
  sets `renderer.background.color` (only when it changed - pixi v8's color setter also resets the
  background alpha to opaque, so the renderer re-applies the alpha it was created with after it; with
  no environment color it never writes to `renderer.background`, so pixi-native options such as
  `backgroundAlpha` passed through the renderer options stay in effect), a texture
  becomes a `Sprite` at stage index 0, behind the world container.
  `IDisplayObject2dComponentFactory.createParallaxLayer(options)` returns the TypeDoc's
  `parallaxLayer` member (an `IParallaxLayer2dComponent`); resolve its options with core's
  `resolveParallaxLayer2dOpts` so defaults match. A layer depends on the camera, and a scene can have
  several renderers, so each renderer positions every layer for its own camera right before drawing
  (pixi: the scene tracks its layers in `parallaxLayers`, `PixiRendererComponent.render()` calls
  `updateView(cameraPosition, halfExtent)` on each, with `halfExtent = hypot(width, height) / 2 / zoom`
  on both axes so a rotated camera stays covered). `PixiParallaxLayerComponent` is a `TilingSprite`
  in the world container (so it sorts by `zIndex` against everything else). Per axis, the texture's
  world origin is `offset + camera * (1 - parallax)`; a repeating axis spans the whole view with
  `tilePosition = (origin - viewStart) mod tileSize`, a non-repeating one is placed at the origin
  one tile wide. `factory.loadTexture(url)` (pixi: `Assets.load`) or `factory.createTextureFromCanvas`
supplies textures for both.
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
  (`components/three-animated-display-object.component.ts`) is the reference implementation: one
  `THREE.AnimationMixer` per instance rooted at `nativeMesh` (works whether that's the loaded
  model's own scene root, or a wrapping `Group` one level up - see the next paragraph), a
  `Map<clipName, AnimationClip>`, and `playAnimation`/`stopAnimation` driving `AnimationAction
  .crossFadeTo`. **Cloning a `SkinnedMesh` needs `SkeletonUtils.clone()`
  (`three/examples/jsm/utils/SkeletonUtils.js`), never the inherited plain `Object3D.clone()`** -
  the latter clones the bone hierarchy but leaves the mesh's own `skeleton.bones` array pointing at
  the *original* bones, silently breaking skinning on the clone (visually: the clone either doesn't
  deform at all under animation, or deforms using the original's live pose) - override `clone()` to
  route through `SkeletonUtils.clone` specifically for any display object component backed by a
  `SkinnedMesh`.

  A loaded model's own origin often isn't the point that should track the entity driving it (e.g. a
  character rig authored with its origin at the feet, needing to align with a
  `CharacterController3dEntity` capsule's *center*) - `IDisplayObject3dComponentLoader.loadFromGlb`'s
  `LoadGlbOptions.offset` handles this by wrapping the loaded scene one level deeper in a plain
  `THREE.Group` and applying the offset to the *inner* node, leaving the outer `Group` (returned as
  `nativeMesh`) untouched at identity - never apply such an offset directly to the node whose
  `position` a display object component's own `position` setter writes to, since that gets
  overwritten wholesale every tick by whatever drives it (`Entity3d`/`CharacterController3dEntity`
  syncing from a body/controller), silently discarding the offset the next tick. This one extra
  level of nesting doesn't break `AnimationMixer`/`AnimationClip` targeting - clip tracks address
  bones by name via `root.getObjectByName(...)`, found the same way regardless of how many ancestors
  sit above the named node, so the mixer can be rooted at either the wrapper or the inner scene with
  identical playback.

  `packages/pixi`'s `PixiAnimatedSpriteComponent` (`components/pixi-animated-sprite.component.ts`)
  is the reference 2D implementation, built by `PixiFactory.createAnimatedSprite(baseTexture,
  { frameWidth, frameHeight, clips })` from a uniform-grid atlas (one row per named clip,
  `frameCount` consecutive columns starting at column 0) - slicing each frame as `new Texture({
  source: baseTexture.source, frame: new Rectangle(col * frameWidth, row * frameHeight, frameWidth,
  frameHeight) })`, sharing the base texture's source rather than copying pixels. Set
  `baseTexture.source.scaleMode = 'nearest'` once, before slicing, for a crisp (non-blurred) look
  when a pixel-art atlas is scaled up - every sliced sub-texture shares the same source, so this one
  assignment covers all of them. **`pixi.js` v8's `AnimatedSprite.update(ticker)` only ever reads
  `ticker.deltaTime`** (confirmed from its own source, not just its `.d.ts`) - so a component driven
  by this engine's own per-tick `updateAnimations(deltaSeconds)` (never pixi's own shared `Ticker`,
  since every adapter here is driven by the engine's own tick loop) can synthesize a throwaway
  object with just that one field (`{ deltaTime: deltaSeconds * 60 } as Ticker`, matching
  `deltaTime`'s own "`1` == one frame at a 60fps baseline" convention) rather than constructing a
  real `Ticker`; construct the sprite itself with `autoUpdate: false` (or the two-arg
  `new AnimatedSprite(frames, false)` constructor) so `play()` never subscribes it to
  `Ticker.shared` on its own.
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
  url, for anything decided by file extension - a blob has none. `packages/three` wraps the blob in
  an object url and runs it through the very loaders `loadTexture(url)` uses (so orientation, color
  space and HDR handling can't differ between the two paths), revoking the url whether decoding
  succeeds or throws. `packages/pixi` decodes with `createImageBitmap` into an `ImageSource` of its
  own and never touches `Assets`: an `Assets.load` texture lives in a cache global to the page,
  shared by every world, with no owner to free it.
- **`disposeTexture(texture)`**: frees what `textureFromData` made. Core calls it when the last
  holder of the cached texture lets go.
- **`prepare(resource)`** (optional): do now what would otherwise happen on the first frame the
  resource is visible - upload textures, compile shaders - so it is part of the reported load. It
  needs a renderer, so the scene keeps a `renderers` set that each renderer component joins in
  `addToWorld` and leaves in `removeFromWorld`/`dispose`; with none, `prepare` resolves at once.
  three: `renderer.initTexture(texture)` for a texture; for a model, `initTexture` on every texture
  its materials reference (found by value: any material property that is a `Texture`), then
  `compileAsync(object, camera, scene)`, which compiles against the scene's lights without the
  object being in it. pixi: `renderer.texture.initSource(source)`, exposed by the renderer
  component as `nativeTextureSystem` (`null` until pixi's async `Application.init` is done). Don't
  use pixi's `renderer.prepare.upload`: it waits for a `Ticker.system` frame, which a background
  tab may never deliver, and the load would hang.

All four are optional in core's interfaces. Without `textureFromData` core calls the url-taking
`loadTexture` instead: it still works and is still cached, but the download is invisible to the
progress and can't be aborted.

## Renderer disposal gives the context back

`ThreeRendererComponent.dispose()` ends with `forceContextLoss()`. A browser allows a page about 16
WebGL contexts and frees a discarded one only at garbage collection, so an app that creates a world
per game session (menu → game → menu → ...) runs out without it. The price: a canvas whose context
was force-lost can't host another renderer, so each renderer gets a canvas of its own. Anything a
subclass disposes that lives in the context (`ThreeComposerRendererComponent`'s render targets)
goes before `super.dispose()`. Verified in Chrome with more than 20 create/dispose round trips of a
full world: every old context reports `isContextLost()`, the live one keeps rendering.

## The `removeFromWorld(dispose)` contract

Every component class here also implements the same base `IWorldComponent` a physics adapter's
components do (see `gg-engine-physics-adapter`'s section on this contract for the full statement):
`removeFromWorld(world, dispose?)` must free the component's own native/GPU resources when `dispose`
is `true`, not merely stop tracking it. `pixi`/`three` components already had a correct `dispose()`
(Pixi: `Application.destroy(...)` / `Container.destroy()`; Three: `geometry.dispose()`/
`material.dispose()` per mesh, `WebGLRenderer.dispose()`) - the only fix needed here was wiring
`removeFromWorld(world, dispose)` to actually call it, the same pattern physics adapters use.

## package.json conventions

Copy `packages/pixi/package.json` (simplest case) or `packages/three/package.json` (if you also
vendor helper sources, see below) as a template:

- `name`: `@gg-web-engine/<lib>`, version kept in lockstep with `@gg-web-engine/core`'s current
  version (check `packages/core/package.json`).
- `@gg-web-engine/core` and the underlying rendering library go in **both** `devDependencies` and
  `peerDependencies`, pinned to the exact version you developed/tested against — adapters do not
  use version ranges for these. A bump of the library must also update any other workspace member
  that pins it: `e2e/blender-export/app` pins `three` (and `@dimforge/rapier3d-compat`). A differing
  pin installs a second copy, and that harness's `instanceof` checks fail against the adapter's
  objects (see its README).
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
`@types/*` devDependency (like `pixi`'s `@types/offscreencanvas`, needed transitively because
`pixi.js`'s own `.d.ts` reference the `OffscreenCanvas` global), that package's name must be added to
the same `"types"` array too (e.g. `["jest", "node", "offscreencanvas"]`) — an explicit `"types"`
array replaces TS's default "auto-include everything under `node_modules/@types`" behavior, so
leaving it out silently breaks that ambient type instead of just adding jest globals.

`three` is ESM-only as of r186: its `package.json` `"type"` is `"module"`, and even the `require`
export condition (`three.cjs`) now just does a plain Node `require('./three.module.js')` at
runtime rather than shipping a real CJS build. Jest's own "require() of ES modules on Node 24.9+"
support doesn't cover this case — that fallback only applies to files jest's transform pipeline has
already parsed, and node_modules files are excluded from transform by default, so a spec file that
imports from `'three'` fails with `Must use import to load ES Module: .../three/build/three.module.js`
even on a Node version that supports native `require(esm)` outside jest. The fix (already applied in
`packages/three/package.json`) is to give `three`'s build files their own narrow transform instead of
relying on jest's ESM interop: add `babel-jest`, `@babel/core`, and
`@babel/plugin-transform-modules-commonjs` as devDependencies, a `babel.config.js` in the package
root with just the commonjs-transform plugin, and in the `jest` block split the transform so
`"^.+\\.ts$"` still goes to `ts-jest` while `"/node_modules/three/(build|examples/jsm)/.+\\.js$"`
goes to `babel-jest`, paired with `"transformIgnorePatterns": ["/node_modules/(?!three/(build|examples/jsm)/)"]`
so those paths aren't skipped. The `examples/jsm` half matters as soon as a spec imports anything
that pulls in an addon (`ThreeLoader` imports `GLTFLoader`/`HDRLoader`, so any spec reaching
`ThreeSceneComponent` does): those files are ESM too, and fail with the same `Must use import`
error otherwise. A package that doesn't import `three` directly in its tests (like `pixi`,
whose spec files replace `pixi.js` with stand-ins) doesn't need any of this.

jsdom has no `URL.createObjectURL`/`revokeObjectURL`, no `createImageBitmap` and no WebGL: a spec
for the decode-from-data methods assigns fakes for the first three and spies on the native loader's
`loadAsync` (`test/three-loader.spec.ts`), and `prepare` is tested against fake renderer objects put
into the scene's `renderers` set. For pixi the whole module is mocked
(`test/pixi-factory-textures.spec.ts`); the mock has to export every name the file under test
imports at module level, as empty classes if nothing else.

Pin `@babel/core` and `@babel/plugin-transform-modules-commonjs` to the same `^7.x` major, not
`^8.x` — `ts-jest@29.4.12` (this package's other test dependency) declares a peerOptional
`@babel/core@">=7.0.0-beta.0 <8"`. `babel-jest`'s own peer range accepts either major, so nothing
forces 8.x, and mixing majors here doesn't fail every install: the root `packages/*` npm workspace
install can resolve it with just an "ERESOLVE overriding peer dependency" warning (existing hoisted
`@babel/core@7.x` from elsewhere in the graph papers over it), but `etc/publish_new_version.sh`
installs each adapter standalone (`npm i --workspaces=false`, no workspace hoisting to fall back
on) and that same conflict is a hard `ERESOLVE` failure there — exactly the kind of failure
`gg-engine-release`'s "Known failure modes" section now documents as having shipped `three` to npm
without a `dist/` at all. Local `npm run build`/`npm run test` passing is not sufficient to catch this;
if you add a new devDependency to an adapter, check its version range against every other test
devDependency's peer constraints, or actually run a clean standalone install
(`rm -rf node_modules package-lock.json && npm i --workspaces=false` inside the package alone) to
reproduce the release script's install mode before landing the change.

**`pixi.js` (v8) has the same ESM-import problem as `three` (above), just not yet worked around -
a test file that imports a real value from `'pixi.js'` fails to run at all.** `pixi.js`'s own
`lib/utils/utils.js` transitively pulls in `earcut` (a pure-ESM package, `import`/`export` syntax,
no CJS build) through its rendering internals - even a spec that only needs a trivial value like
`Container`/`Graphics` for a mock/fake pays the whole import chain, since jest evaluates the entire
module graph a `require`d file pulls in, not just the named export actually used. This surfaces as
`Must use import to load ES Module: .../node_modules/earcut/src/earcut.js`, the same class of error
`three`'s own note above describes, needing the same fix in spirit (a `babel-jest` transform carved
out for the offending `node_modules` path, paired with `transformIgnorePatterns`) - not yet applied
to this package's `jest` config, so this package's existing spec file is deliberately pure-logic,
importing nothing from `pixi.js` at all. **Until that transform is added, write a test needing a
`pixi.js` type (`Container`, `Graphics`, `Sprite`, ...) against a plain fake object cast to that
type** (`{} as unknown as Container`, or richer as the test needs) **and import the type itself with
`import type`** (elided at compile time, so it adds no runtime `require('pixi.js')` at all) rather
than a plain `import` - `packages/pixi/test/components/pixi-display-object.component.spec.ts`-style
tests that don't need pixi.js's real runtime behavior (only a `nativeSprite` reference to hold) are
the common case this applies to. A component that constructs a pixi.js object itself (e.g.
`PixiParallaxLayerComponent`'s `new TilingSprite(...)`) can still be tested by replacing the module
with `jest.mock('pixi.js', () => ({ TilingSprite: FakeTilingSprite }))` at the top of the spec - a
factory mock never loads the real module (see
`packages/pixi/test/components/pixi-parallax-layer.component.spec.ts`). A test that genuinely needs
pixi.js's own real behavior (a real `Graphics` draw call, a real `Sprite` texture) has no workaround
available yet and needs the babel transform fix applied first; verify such behavior by rendering in
headless Chromium instead.

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

This file is read by future agents building/maintaining rendering adapters, not by end users of
the engine. If a library-specific quirk bites you (a native API that doesn't map cleanly onto a
core interface, a build/link step that failed in a non-obvious way, a shape or option this file
implied was easy but wasn't), or something written here turns out wrong or incomplete once you've
actually implemented it, add a short note (what went wrong, why, the fix) before finishing —
folded into the relevant section rather than left as a loose log entry.
