---
name: gg-engine-visual-adapter-three
description: Known, already-solved implementation pitfalls specific to packages/three (the three.js 3D rendering adapter) - Y-up-to-Z-up re-orientation of native primitives and sky textures, Object3D.traverse semantics for render layers and shadows, light target/HemisphereLight handling, resourceOwnership on clone, SkeletonUtils.clone for skinned meshes, the LoadGlbOptions.offset wrapper Group, decode-from-blob and prepare() paths, forceContextLoss on renderer dispose, and the jest setup needed for three's ESM-only build (babel-jest transform, moduleNameMapper to three.module.js, @babel peer pins). Use when fixing or extending packages/three itself, not when building a new rendering adapter from scratch (see gg-engine-visual-adapter for the general contract every adapter implements).
---

# packages/three implementation notes

This file is `three.js`-specific history: real issues hit and fixed while building and maintaining
`packages/three`, so the next agent touching this package doesn't rediscover them. The general
contract every rendering adapter satisfies (which interfaces to implement, the TypeDocRepo, the
`removeFromWorld(dispose)` rule, `package.json` conventions, how a new adapter is wired into the
repo) lives in `gg-engine-visual-adapter`; read that first if you're new to the adapter pattern,
then come here for what is particular to three.js.

## Z-up world on a Y-up library

Every 3D world in this engine is Z-up (see the root `CLAUDE.md`), and three.js's own primitives
assume Y-up. `ThreeFactory.createPrimitive` compensates once, at geometry creation, with
`geometry.rotateX(PI / 2)` on `CapsuleGeometry`/`CylinderGeometry`/`ConeGeometry` (the primitives
whose axis matters), so the engine-level shape API is Z-up-consistent and nothing downstream needs
to know. Don't rotate the mesh or its parent instead of the geometry: the display object's
`rotation` setter overwrites the node's rotation every tick.

Sky textures are sampled Y-up too. `ThreeSceneComponent.setEnvironment` sets
`scene.backgroundRotation`/`environmentRotation` to `+PI/2` around X for both cube maps and
equirectangular textures. For a cube map that rotation alone is not enough: `ThreeLoader.
loadCubeTexture` fills three's slots to match it (`pz` into `py`, `nz` into `ny`, `ny` into `pz`,
`py` into `nz`) and swaps `px`/`nx`, because three.js samples cube maps with X mirrored. Moving
faces between slots alone can never produce the orientation `CubeTextureFaces` documents (side
images' top edge towards `+Z`, `pz`'s towards `+Y`, `nz`'s towards `-Y`): a face's slot fixes which
way its top edge points, so the side images would lie on their side. Verify any change to this by
rendering in headless Chromium (ANGLE/SwiftShader) and reading pixels back looking along each axis,
with faces that carry a marker on their top and left edges (solid-colored faces show the direction
but not a rotated or mirrored image), and, for the environment map, the reflection on a
mirror-like sphere.

## Display objects

- **`Object3D.traverse()` fires on the root node itself first, then recursively on children.**
  `ThreeDisplayObjectComponent.enableRenderLayer`/`disableRenderLayer` and the
  `castShadow`/`receiveShadow` setters rely on this to cover the whole subtree with one call; a
  traversal written as if it only visited descendants silently skips the root and leaves it on the
  wrong layer. The `castShadow` write skips lights embedded in the subtree (a loaded model can carry
  them): on a light that flag turns shadow map rendering on or off, which is the light's own setting.
- **Render layers** are three.js `Layers` bitmasks: `ThreeSceneComponent.mainRenderLayer` is `0`
  (a fresh `Object3D`'s default layer), `registerRenderLayer`/`deregisterRenderLayer` hand out
  indices from `lockedRenderLayers`, and a new camera calls `nativeCamera.layers.enableAll()` so it
  renders every layer until an app deliberately excludes one.
- **`resourceOwnership`** decides what `dispose()` frees: `'meshes'` by default (geometry and
  materials, never textures - a primitive's `diffuse` belongs to whoever loaded it), `'all'` for what
  `ThreeLoader` returns (a model's textures came with its file; `popChild` passes it on to the parts
  a model is split into), `'none'` for every `clone()`. Core's loader caches one original per loaded
  file and hands out a `clone()` per use, so a copy that freed shared geometry would pull it out
  from under its siblings. A subclass overriding `clone()` (`ThreeAnimatedDisplayObjectComponent`)
  has to set `'none'` on its copy too.
- **Cloning a `SkinnedMesh` needs `SkeletonUtils.clone()`**
  (`three/examples/jsm/utils/SkeletonUtils.js`), never the inherited plain `Object3D.clone()` - the
  latter clones the bone hierarchy but leaves the mesh's own `skeleton.bones` array pointing at the
  *original* bones, silently breaking skinning on the clone (visually: the clone either doesn't
  deform at all under animation, or deforms using the original's live pose).
  `ThreeAnimatedDisplayObjectComponent.clone()` routes through it.
- **`ThreeAnimatedDisplayObjectComponent`** keeps one `THREE.AnimationMixer` per instance rooted at
  `nativeMesh`, a `Map<clipName, AnimationClip>`, and drives `playAnimation`/`stopAnimation` with
  `AnimationAction.crossFadeTo`. The mixer works whether `nativeMesh` is the loaded model's own
  scene root or a wrapping `Group` one level up (next point): clip tracks address bones by name via
  `root.getObjectByName(...)`, found the same way regardless of how many ancestors sit above the
  named node.
- **`LoadGlbOptions.offset`** (`ThreeLoader.loadFromGlb`) wraps the loaded scene one level deeper in
  a plain `THREE.Group` and applies the offset to the *inner* node, leaving the outer `Group`
  (returned as `nativeMesh`) at identity. Never apply such an offset to the node whose `position`
  the component's own setter writes: `Entity3d`/`CharacterController3dEntity` overwrite it
  wholesale every tick, silently discarding the offset.
- **`materialOptions`**: `ThreeFactory.createPrimitive` passes its own `material` parameter
  verbatim into every `ThreeDisplayObjectComponent` it constructs (not the fully-resolved material -
  an auto-picked random color reads back as `{}`), and only when given, so `isMaterialReadable3d`'s
  field-presence check reports "no capability" for a loaded `.glb` mesh.

## Lights

three.js aims `DirectionalLight`/`SpotLight` at a separate `target` object that defaults to the
world origin, and both light types start at `(0, 1, 0)`. `ThreeLightComponent` resets the light to
the origin and parents the target to the light one unit along `-Z`, so the light shines along the
component's local `-Z` and follows the rotation the engine sets. A `HemisphereLight` takes its sky
direction from its *position*, so the component's position setter is ignored for it and the native
position is kept at the rotated `+Z` unit vector instead. `clone()` rebuilds from `lightOptions`
rather than `Object3D.clone()`, which would leave the clone's `target` pointing at an object outside
its hierarchy.

## Loading and `prepare()`

- `textureFromData(blob, options)` wraps the blob in an object url and runs it through the very
  loaders `loadTexture(url)` uses (so orientation, color space and HDR handling can't differ between
  the two paths), revoking the url whether decoding succeeds or throws. `options.url` is the original
  url, for anything decided by file extension - a blob has none.
- `createTextureFromCanvas` returns a `CanvasTexture` with `colorSpace = SRGBColorSpace`, like an
  image file; `utils/texture-options.ts` holds the `mapping`/`filter`/`repeat` mapping shared with
  `loadTexture` (`repeat` sets the wrap mode to repeat as well as the repeat count).
- `prepare(resource)`: `renderer.initTexture(texture)` for a texture; for a model, `initTexture` on
  every texture its materials reference (found by value: any material property that is a `Texture`),
  then `compileAsync(object, camera, scene)`, which compiles against the scene's lights without the
  object being in it. It needs a renderer, so `ThreeSceneComponent.renderers` is the set each
  renderer joins in `addToWorld` and leaves in `removeFromWorld`/`dispose`; with none, `prepare`
  resolves at once.
- Addons come straight from `three/examples/jsm/*` (`GLTFLoader`, `HDRLoader`, the postprocessing
  passes, `CopyShader`, `BufferGeometryUtils`, `SkeletonUtils`): `three` and `@types/three` export
  that subpath, and `index.ts` re-exports what consumers need. Nothing is vendored under `src/`.
  Re-check `three`'s `package.json` `"exports"` map on a version bump before adding any import from
  a new addon path.

## Renderer disposal

`ThreeRendererComponent.dispose()` ends with `forceContextLoss()`. A browser allows a page about 16
WebGL contexts and frees a discarded one only at garbage collection, so an app that creates a world
per game session (menu → game → menu → ...) runs out without it. The price: a canvas whose context
was force-lost can't host another renderer, so each renderer gets a canvas of its own. Anything a
subclass disposes that lives in the context (`ThreeComposerRendererComponent`'s render targets)
goes before `super.dispose()`. Verified in Chrome with more than 20 create/dispose round trips of a
full world: every old context reports `isContextLost()`, the live one keeps rendering.

## Testing (jest + jsdom)

`three` is ESM-only as of r186: its `package.json` `"type"` is `"module"`, and the `require` export
condition (`build/three.cjs`) is a shim that emits a `[THREE_CJS_DEPRECATED] DeprecationWarning`
and then `require`s `./three.module.js`. Jest's own "require() of ES modules on Node 24.9+" support
doesn't cover this case - that fallback only applies to files jest's transform pipeline has already
parsed, and node_modules files are excluded from transform by default - so a spec file that imports
from `'three'` fails with `Must use import to load ES Module: .../three/build/three.module.js` even
on a Node version that supports native `require(esm)` outside jest. The `jest` block in
`packages/three/package.json` therefore:

- gives `three`'s build files their own narrow transform instead of relying on jest's ESM interop:
  `babel-jest`, `@babel/core` and `@babel/plugin-transform-modules-commonjs` as devDependencies, a
  `babel.config.js` in the package root with just the commonjs-transform plugin, and a split
  `transform` - `"^.+\\.ts$"` to `ts-jest`, `"/node_modules/three/(build|examples/jsm)/.+\\.js$"` to
  `babel-jest` - paired with `"transformIgnorePatterns": ["/node_modules/(?!three/(build|examples/jsm)/)"]`
  so those paths aren't skipped. The `examples/jsm` half matters as soon as a spec imports anything
  that pulls in an addon (`ThreeLoader` imports `GLTFLoader`/`HDRLoader`, so any spec reaching
  `ThreeSceneComponent` does): those files are ESM too, and fail with the same error otherwise.
- maps `"^three$"` to `"<rootDir>/../../node_modules/three/build/three.module.js"` in
  `moduleNameMapper`, so jest loads the ESM build (through the transform above) without going
  through the deprecation shim, which otherwise prints its warning once per test file. The path goes
  through the repo-root `node_modules` because `three` is hoisted there by the workspace `npm
  install` (what CI and the local dev workflow run); it won't resolve after a standalone `npm
  install` inside `packages/three`, which isn't a supported workflow anyway.

Pin `@babel/core` and `@babel/plugin-transform-modules-commonjs` to the same `^7.x` major, not
`^8.x` - `ts-jest@29.4.12` (this package's other test dependency) declares a peerOptional
`@babel/core@">=7.0.0-beta.0 <8"`. `babel-jest`'s own peer range accepts either major, so nothing
forces 8.x, and mixing majors doesn't fail every install: the root `packages/*` workspace install
resolves it with just an "ERESOLVE overriding peer dependency" warning (a hoisted `@babel/core@7.x`
from elsewhere in the graph papers over it), but `etc/publish_new_version.sh` installs each adapter
standalone (`npm i --workspaces=false`, no hoisting to fall back on) and the same conflict is a hard
`ERESOLVE` failure there - which once shipped `three` to npm without a `dist/` at all (see
`gg-engine-release`'s "Known failure modes"). Local `npm run build`/`npm run test` passing is not
sufficient to catch this; when adding a devDependency, check its range against every other test
devDependency's peer constraints, or run a clean standalone install (`rm -rf node_modules
package-lock.json && npm i --workspaces=false` inside the package) to reproduce the release script's
install mode.

jsdom has no `URL.createObjectURL`/`revokeObjectURL`, no `createImageBitmap` and no WebGL: the spec
for the decode-from-data methods assigns fakes for the first three and spies on the native loader's
`loadAsync` (`test/three-loader.spec.ts`), and `prepare` is tested against fake renderer objects put
into the scene's `renderers` set. Anything that needs a real renderer is smoke-tested in
`examples/3d/primitives` or verified in headless Chromium.

## Keep this skill current

This file is read by future agents fixing or extending `packages/three`, not by end users and not
by agents building a new rendering adapter (they read `gg-engine-visual-adapter`). When a three.js
API quirk, a version-bump break, a build/typing/jest gotcha or a leak bites you here and isn't
covered above, fold a short note (what went wrong, why, the fix) into the relevant section. If the
lesson is about the *general* contract any rendering adapter would hit, it belongs in
`gg-engine-visual-adapter` instead. Describe the resulting state, not the change.
