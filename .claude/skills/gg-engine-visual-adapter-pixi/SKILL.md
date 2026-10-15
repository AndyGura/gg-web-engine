---
name: gg-engine-visual-adapter-pixi
description: Known, already-solved implementation pitfalls specific to packages/pixi (the pixi.js v8 2D rendering adapter) - the hand-rolled cloneContainer/copyContainerState since Container has no clone(), stroked/tinted primitive representation, the background-color-resets-alpha quirk, TilingSprite parallax layers positioned per renderer, AnimatedSprite.update reading only ticker.deltaTime, decoding textures without the page-global Assets cache, prepare() via texture.initSource, Application.destroy() before init() resolves, scale relative to a sized sprite's built size, and the jest setup (a babel-jest transform loads the real ESM-only pixi.js; unit specs still mock it). Use when fixing or extending packages/pixi itself, not when building a new rendering adapter from scratch (see gg-engine-visual-adapter for the general contract every adapter implements).
---

# packages/pixi implementation notes

This file is `pixi.js`-specific history: real issues hit and fixed while building and maintaining
`packages/pixi`, so the next agent touching this package doesn't rediscover them. The general
contract every rendering adapter satisfies (which interfaces to implement, the TypeDocRepo, the
`removeFromWorld(dispose)` rule, `package.json` conventions, how a new adapter is wired into the
repo) lives in `gg-engine-visual-adapter`; read that first if you're new to the adapter pattern,
then come here for what is particular to pixi.js v8.

## Primitives, materials and text

- An untextured shape is a tinted `Texture.WHITE` sprite when that's enough (cheap), but a
  `stroke: { color, width }` outline can't be drawn that way, so an untextured stroked `BOX` becomes
  a `Graphics` rect. `color` fills an untextured shape and tints a textured one. In a `COMPOUND`
  `opacity` is applied once on the container, not again on every part, or the parts multiply it.
- `tint` maps to `Container.tint`, `opacity` to `alpha`; both are inherited by children.
- `createTextureFromCanvas(canvas, options?)` is `Texture.from(canvas)`; the options helper is
  shared with `packages/three` (`utils/texture-options.ts` there). `loadTexture(url, { filter })`
  maps `filter` onto `texture.source.scaleMode` - the source is shared by every texture of that
  image, which pixi's `Assets` cache hands out per url.
- `PixiTextComponent` (`createText(text, style)`) rebuilds the native style object from the merged
  `Text2dStyle` on every `setStyle(partial)`, so a field set earlier is never lost.
- `PixiFactory.createPrimitive` passes its own `material` parameter verbatim into every
  `PixiDisplayObjectComponent` it constructs (not the fully-resolved material - an auto-picked random
  color reads back as `{}`), and only when given, so `isMaterialReadable2d`'s field-presence check
  reports "no capability" for `createAnimatedSprite`'s output.

## Cloning and nesting

pixi has no generic `Container.clone()`, so `src/utils/clone-container.ts` rebuilds each kind of
native object the package creates (`cloneContainer`, sharing only textures), and a component
subclass with its own constructor arguments or state overrides `clone()` to return its own class
(`copyContainerState` copies transform, tint, opacity and children onto a native object the
subclass built itself). **A new kind of native object the package starts creating needs a branch in
`cloneContainer`**, which otherwise copies it as an empty `Container`.

`addChild`/`removeChild` are `Container.addChild`/`removeChild`; `dispose()` is
`destroy({ children: true })` so nested children go with the parent. `name` is the native
`Container.label` (copied by `copyContainerState`), and `popChild(name)` detaches the first child
with that label and wraps it in a new `PixiDisplayObjectComponent`.

## Scale and bounds

An untextured `BOX` (a tinted `Texture.WHITE` sprite) and a textured `BOX`/`CIRCLE` get their size
from the native sprite's `scale` (`sprite.width = ...` writes it). `PixiDisplayObjectComponent`
records that native scale at construction as `baseScale` and reads/writes `scale` relative to it,
so every primitive starts at `scale = { x: 1, y: 1 }` and `scale = { x: 2, y: 2 }` doubles it, as
in three. `clone()` passes `baseScale` on, since the cloned native object already carries any scale
the app set. `getBoundings()` is `Container.getBounds()` (world coordinates, scale and position
included); `boundsArea` is only a user-set override and is usually `undefined`.

## Draw order, backdrops and parallax layers

- The scene's world container is created with `sortableChildren: true`, and
  `IDisplayObject2dComponent.zIndex` maps to the native `zIndex`.
- `PixiRendererComponent.render()` applies the scene environment every frame. A background color
  sets `renderer.background.color` only when it changed: **pixi v8's color setter also resets the
  background alpha to opaque**, so the renderer re-applies the alpha it was created with right
  after. With no environment color it never writes to `renderer.background`, so pixi-native options
  such as `backgroundAlpha` passed through the renderer options stay in effect. A background texture
  becomes a `Sprite` at stage index 0, behind the world container.
- `PixiParallaxLayerComponent` is a `TilingSprite` in the world container (so it sorts by `zIndex`
  against everything else). The scene tracks its layers in `parallaxLayers`, and each renderer
  positions every layer for its own camera right before drawing - `PixiRendererComponent.render()`
  calls `updateView(cameraPosition, halfExtent)` with `halfExtent = hypot(width, height) / 2 / zoom`
  on both axes so a rotated camera stays covered. Per axis, the texture's world origin is
  `offset + camera * (1 - parallax)`; a repeating axis spans the whole view with
  `tilePosition = (origin - viewStart) mod tileSize`, a non-repeating one is placed at the origin one
  tile wide.

## Particle systems

`PixiParticleSystemComponent` (`createParticleSystem`) is a `ParticleContainer` with every
`dynamicProperties` flag on (`vertex`, `position`, `rotation`, `uvs`, `color`) - a particle's size
(scale), frame (uvs) and tint/opacity (color) all change per frame, and a flag left off makes the
container upload that attribute only on `update()`. `particleChildren` is filled directly from
`capacity` pooled plain `IParticle` records (`x`, `y`, `scaleX/Y`, `anchorX/Y` = 0.5, `rotation`,
`color`, `texture`) truncated to the drawn count, then `container.update()`, instead of
`addParticle`/`removeParticle` churn. Things specific to pixi's particle pipeline:

- **`IParticle.color` is packed ABGR** (`alpha << 24 | blue << 16 | green << 8 | red`, forced
  unsigned with `>>> 0`), the same packing `Particle`'s `tint`/`alpha` setters produce; `tint` on a
  real `Particle` is BGR internally too.
- **Every particle of a container must share one texture source.** An atlas frame is a `new
  Texture({ source: base.source, frame: new Rectangle(...) })` sub-texture of the system's texture
  (its `frame` offset included, so a base texture that is itself an atlas region still works), one
  per distinct region cached on the component, destroyed with `destroy(false)` - never the source -
  when the texture is swapped or the system disposed. The whole image (region `0,0,1,1`) uses the
  base texture itself.
- **Sprite size is scale**: `scaleX = size.x / texture.orig.width` (the frame's pixel size), so a
  system without a texture draws `Texture.WHITE` (1x1) scaled to the size in world units.
- **The blend mode is the container's `blendMode`** (`'normal'`/`'add'`/`'multiply'`), which is why
  core's 2D option type is limited to those three - `subtract` and the other advanced modes need
  pixi's optional advanced-blend-modes import and a filter pass.
- **`ParticleContainer` has no children and computes no bounds**; `getBoundings`
  (`Container.getBounds()`) reports its `boundsArea`, empty unless set, in world coordinates. It is not covered by `cloneContainer` - the component overrides `clone()`
  to build a fresh system from its options.
- A spec mocks `pixi.js` with a fake `ParticleContainer`/`Texture`/`Rectangle` (plus the empty
  classes `clone-container.ts` imports), see `test/components/pixi-particle-system.component.spec.ts`.

## Animated sprites

`PixiFactory.createAnimatedSprite(baseTexture, { frameWidth, frameHeight, clips })` builds a
`PixiAnimatedSpriteComponent` from a uniform-grid atlas (one row per named clip, `frameCount`
consecutive columns starting at column 0), slicing each frame as `new Texture({ source:
baseTexture.source, frame: new Rectangle(col * frameWidth, row * frameHeight, frameWidth,
frameHeight) })` - sharing the base texture's source rather than copying pixels. Set
`baseTexture.source.scaleMode = 'nearest'` once, before slicing, for a crisp look when a pixel-art
atlas is scaled up; every sliced sub-texture shares the same source, so one assignment covers all.

**`AnimatedSprite.update(ticker)` only ever reads `ticker.deltaTime`** (confirmed from pixi's own
source, not just its `.d.ts`). The component is driven by the engine's per-tick
`updateAnimations(deltaSeconds)`, never pixi's shared `Ticker`, so it synthesizes a throwaway
`{ deltaTime: deltaSeconds * 60 } as Ticker` (matching `deltaTime`'s "`1` == one frame at 60fps"
convention) instead of constructing a real `Ticker`. Construct the sprite with `autoUpdate: false`
(or the two-arg `new AnimatedSprite(frames, false)`) so `play()` never subscribes it to
`Ticker.shared` on its own.

## Loading and `prepare()`

- `textureFromData(blob, options)` decodes with `createImageBitmap` into an `ImageSource` of its own
  and never touches `Assets`: an `Assets.load` texture lives in a cache global to the page, shared by
  every world, with no owner to free it. `loadTexture(url)` (the url path) still uses `Assets.load`.
- `prepare(resource)` uploads through `renderer.texture.initSource(source)`, exposed by the renderer
  component as `nativeTextureSystem` (`null` until pixi's async `Application.init` is done). Don't
  use `renderer.prepare.upload`: it waits for a `Ticker.system` frame, which a background tab may
  never deliver, and the load would hang.

## Renderer lifecycle

A renderer can be disposed before its async native init has finished (a screen popped while its
world was still starting). pixi 8's `Application.destroy()` throws before `init()` resolves (its
resize plugin's `destroy` calls a function `init` sets up), and the late `init` would then create a
GL context nobody frees. `PixiRendererComponent.dispose()` therefore only marks itself disposed in
that case and the `init` callback destroys the application. Work deferred until init (`render`,
`resizeRenderer`) waits on `onInitialized$.pipe(take(1))`, never `first()`: `dispose()` completes
that subject, and `first()` errors on a subject completed without a value.

`dispose()` otherwise is `Application.destroy(...)` / `Container.destroy()`; `removeFromWorld(world,
dispose)` calls it when `dispose` is `true`.

## Testing (jest + jsdom)

`packages/pixi` needs `@types/offscreencanvas` as a devDependency and `"offscreencanvas"` in
`tsconfig.json`'s explicit `"types"` array (`["jest", "node", "offscreencanvas"]`): `pixi.js`'s own
`.d.ts` reference the `OffscreenCanvas` global, and an explicit `"types"` array replaces TS's
"auto-include everything under `node_modules/@types`" default, so leaving it out silently breaks
that ambient type.

**The real `pixi.js` loads under jest through a `babel-jest` transform.** `pixi.js` and several of
its dependencies (`earcut`, `@pixi/colord`, `tiny-lru`, ...) are ESM-only, which jest's CommonJS
runtime can't `require` from `node_modules` (`Must use import to load ES Module: .../earcut.js`).
`babel.config.js` (`@babel/plugin-transform-modules-commonjs`), a `"/node_modules/.+\\.m?js$":
"babel-jest"` transform and a `transformIgnorePatterns` carve-out listing those packages convert them
for the test run only, the same approach `packages/three` uses (see `gg-engine-visual-adapter-three`
for the `@babel/*` pins; pixi uses the same ranges). A pixi.js dependency that turns ESM-only in a
version bump fails with that same message naming it: add it to the carve-out. Transforming pixi.js
costs ~20 s on the first run (jest caches it afterwards). jsdom has no canvas backend and logs a
"Not implemented: getContext" error whenever pixi.js probes for one, so `test/jest-setup.ts` stubs
`HTMLCanvasElement.prototype.getContext` to return `null`; nothing in the suite draws.

`test/contract/pixi-contract.spec.ts` runs the shared 2D visual contract (see
`gg-engine-visual-adapter`) against the real `PixiFactory`. The unit specs under `test/components/`
still replace `pixi.js` with small stand-ins (`jest.mock('pixi.js', () => ({ ... }))`, or a plain
fake object cast to a type imported with `import type`), because they assert exactly what a
component writes to its native object. A stand-in needs every field the code under test reads -
`PixiDisplayObjectComponent`'s constructor reads `scale`, so every fake container has
`scale: { x: 1, y: 1 }`. Anything that needs a real draw call is verified in
`examples/2d/primitives` or by rendering in headless Chromium.

## Keep this skill current

This file is read by future agents fixing or extending `packages/pixi`, not by end users and not by
agents building a new rendering adapter (they read `gg-engine-visual-adapter`). When a pixi.js API
quirk, a version-bump break, a build/typing/jest gotcha or a leak bites you here and isn't covered
above, fold a short note (what went wrong, why, the fix) into the relevant section. If the lesson is
about the *general* contract any rendering adapter would hit, it belongs in
`gg-engine-visual-adapter` instead. Describe the resulting state, not the change.
