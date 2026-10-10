---
name: gg-engine-visual-adapter-pixi
description: Known, already-solved implementation pitfalls specific to packages/pixi (the pixi.js v8 2D rendering adapter) - the hand-rolled cloneContainer/copyContainerState since Container has no clone(), stroked/tinted primitive representation, the background-color-resets-alpha quirk, TilingSprite parallax layers positioned per renderer, AnimatedSprite.update reading only ticker.deltaTime, decoding textures without the page-global Assets cache, prepare() via texture.initSource, Application.destroy() before init() resolves, and the jest situation (pixi.js can't be required under jest because of earcut; specs mock the module or use import type). Use when fixing or extending packages/pixi itself, not when building a new rendering adapter from scratch (see gg-engine-visual-adapter for the general contract every adapter implements).
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
`destroy({ children: true })` so nested children go with the parent.

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
- **`ParticleContainer` has no children and computes no bounds**; `getBoundings` reports the
  (unset) `boundsArea`. It is not covered by `cloneContainer` - the component overrides `clone()`
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

**A spec that imports a real value from `'pixi.js'` fails to run at all.** `pixi.js`'s own
`lib/utils/utils.js` transitively pulls in `earcut` (a pure-ESM package, no CJS build) through its
rendering internals, and jest evaluates the entire module graph a `require`d file pulls in, not just
the named export used - so even a spec needing a trivial `Container`/`Graphics` for a fake pays the
whole chain and dies with `Must use import to load ES Module: .../node_modules/earcut/src/earcut.js`.
The fix would be the same `babel-jest` transform `packages/three` uses for its ESM-only library
(see `gg-engine-visual-adapter-three`), carved out for the offending `node_modules` path and paired
with `transformIgnorePatterns`; it is not applied to this package's `jest` config yet. Until it is:

- A test that only needs a pixi.js *type* (`Container`, `Graphics`, `Sprite`, ...) uses a plain fake
  object cast to it (`{} as unknown as Container`, or richer as needed) and imports the type with
  `import type`, which is elided at compile time and adds no runtime `require('pixi.js')` -
  `test/components/pixi-display-object.component.spec.ts` is the pattern.
- A component that constructs a pixi.js object itself (`PixiParallaxLayerComponent`'s
  `new TilingSprite(...)`) is tested by replacing the module with
  `jest.mock('pixi.js', () => ({ TilingSprite: FakeTilingSprite }))` at the top of the spec - a
  factory mock never loads the real module (`test/components/pixi-parallax-layer.component.spec.ts`,
  `test/pixi-factory-textures.spec.ts`). The mock has to export every name the file under test
  imports at module level, as empty classes if nothing else.
- A test that genuinely needs pixi.js's real behavior (a real `Graphics` draw call, a real `Sprite`
  texture) has no workaround yet; verify such behavior in `examples/2d/primitives` or by rendering in
  headless Chromium instead.

## Keep this skill current

This file is read by future agents fixing or extending `packages/pixi`, not by end users and not by
agents building a new rendering adapter (they read `gg-engine-visual-adapter`). When a pixi.js API
quirk, a version-bump break, a build/typing/jest gotcha or a leak bites you here and isn't covered
above, fold a short note (what went wrong, why, the fix) into the relevant section. If the lesson is
about the *general* contract any rendering adapter would hit, it belongs in
`gg-engine-visual-adapter` instead. Describe the resulting state, not the change.
