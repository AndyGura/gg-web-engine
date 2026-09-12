---
name: gg-engine-audio-adapter
description: Create or modify an audio-backend adapter package for gg-web-engine (packages/audio, the Web Audio API implementation, or a new one such as a Howler-backed package). Use when the task is to implement core's audio-scene interfaces against a specific audio backend, or to work on the audioScene/AudioSource(2d|3d)Entity contract itself.
---

# Building an audio adapter package

An audio adapter package (`packages/audio`, or a new one) makes an audio backend satisfy
`@gg-web-engine/core`'s 2D/3D audio interfaces so it can plug into `Gg2dWorld`/`Gg3dWorld` as
`audioScene` - the third leg alongside `visualScene`/`physicsWorld`. Read
`gg-engine-core-development`'s "TypeDocRepo" section first if you haven't already; audio follows
the identical generic pattern (`AudioTypeDocRepo(2D|3D)`, `Gg(2d|3d)WorldTypeDocAPatch`,
`Gg(2d|3d)WorldSceneTypeDocAPatch`).

## Unlike rendering/physics, one reference adapter is probably enough

Rendering and physics each have several genuinely different underlying libraries worth adapting
between (three vs. pixi, ammo vs. rapier vs. matter). Audio's underlying primitive - the Web Audio
API - is a single browser standard every JS audio library (Howler, Tone.js) itself wraps, so
`packages/audio` implements it directly rather than through a third-party dependency; there is no
third-party library version to pin in its `package.json` at all, unlike every other adapter here.
The adapter boundary still exists structurally (core never references `AudioContext` directly), so
a second implementation (e.g. a Howler-backed package for wider legacy-browser reach) is additive
if the need ever arises - just not expected to be common.

## Decide dimensionality, same as any other adapter

Implement either the `3d/components/audio/*` interfaces (see `packages/audio`'s 3D classes) or the
`2d/components/audio/*` ones (2D classes) from `packages/core/src`. They're structurally similar
(both extend the base `IAudioSceneComponent`/`IAudioSourceComponent`) but the 3D ones add distance
cone fields (`coneInnerAngle`/`coneOuterAngle`/`coneOuterGain`) and 3D-specific rolloff, mirroring
how `ICamera3dComponent` adds FOV that 2D has no equivalent for.

## The contract you must implement

- **`IAudioSceneComponent<D,R,ATypeDoc>`** (`base/components/audio/i-audio-scene.component.ts`):
  owns the native audio backend (an `AudioContext` for `packages/audio`), the source `factory`,
  `masterVolume`/per-bus `getBusVolume`/`setBusVolume`, the single `activeListener` reference
  (`setActiveListener`), and `update(elapsed, delta)` - called once per world tick by `GgWorld`
  itself (see "How `update()` gets called" below), not by app code.
- **`IAudioSourceComponentFactory<D,R,ATypeDoc>`** (`base/components/audio/i-audio-source.component-factory.ts`):
  unlike the rendering/physics factories, this one is defined once at the *base* level and just
  narrowed by dimension in `2d/factories.ts`/`3d/factories.ts` (`IAudioSource(2d|3d)ComponentFactory
  extends IAudioSourceComponentFactory<Point(2|3), ..., ATypeDoc> {}`, no new methods) - a clip in,
  a positioned source out is identical in shape regardless of dimension, unlike
  `Shape2DDescriptor`/`Shape3DDescriptor` which genuinely differ. Two methods: `loadClip(url)`
  (fetch+decode into whatever native representation `createSource` expects - **must cache by URL**,
  since the `"Sound"` level-JSON class, the `"PlaySound"` blueprint node, and any pooled one-shot
  effect all call it repeatedly for the same clip) and `createSource(descriptor)`.
- **`IAudioSourceComponent<D,R,ATypeDoc>`** (`base/components/audio/i-audio-source.component.ts`):
  one sound instance - `IPositionable<D,R>` (position/rotation proxied to the native
  spatialization node) plus `loop`/`volume`/`playbackRate`/`spatial`/`bus`, `play()`/`pause()`/
  `stop()`, `isPlaying`, and `ended$` (fires once when a non-looping clip finishes - what
  `AudioSource(2d|3d)Entity.playOneShot` and the `"PlaySound"` blueprint node subscribe to for
  self-cleanup). Also an `IWorldComponent` (`addToWorld`/`removeFromWorld`/`dispose`), same
  contract as every other component - see `gg-engine-physics-adapter`'s section on `dispose`.

Core supplies the generic entity wrapper (`AudioSource3dEntity`/`AudioSource2dEntity`,
`3d(2d)/entities/audio-source-(3d|2d).entity.ts`) - **you never need to write this yourself**, only
the components it wraps. It handles all three placement modes (static/attached/one-shot via
`playOneShot`) generically over whatever `TypeDoc['aTypeDoc']['source']` your adapter supplies.

## File layout (mirror `packages/audio`)

```
packages/<lib>/
  src/
    index.ts                                 # barrel
    types.ts                                 # <Lib>TypeDocRepo(2D|3D)
    <lib>-factory.ts                         # IAudioSource(2d|3d)ComponentFactory impl(s)
    components/
      <lib>-scene-base.component.ts          # shared scene logic (context/buses/clip cache/listener)
      <lib>-scene-3d.component.ts             # IAudioScene3dComponent - listener orientation sync
      <lib>-scene-2d.component.ts             # IAudioScene2dComponent - manual pan/gain sweep
      <lib>-source-base.component.ts         # shared source logic (play/pause/stop/bus routing)
      <lib>-source-3d.component.ts           # IAudioSource3dComponent
      <lib>-source-2d.component.ts           # IAudioSource2dComponent
    utils/
      ramp.ts                                # see "The ramped-write rule" below
      distance-gain.ts                       # only needed if your backend has no native distance model
      audio-source-pool.ts                   # optional: see "Pooling" below
```

Splitting scene/source into a dimension-agnostic base class plus two thin 3D/2D subclasses (rather
than duplicating everything twice) is the pattern `packages/audio` uses since the vast majority of
the logic (buffer/element playback, gain ramping, bus routing, clip caching) genuinely doesn't
depend on `D`/`R` - only the spatialization node (`PannerNode` vs `StereoPannerNode`, or your
backend's equivalents) and position/rotation math differ.

## The ramped-write rule - read this before writing any position/gain/pan code

**Every `AudioParam` write this adapter makes - position, gain, pan, whatever your backend exposes
as a native audio-thread parameter - must go through a ramp (`AudioParam.setTargetAtTime` for Web
Audio, or your backend's equivalent smoothing primitive), never a direct assignment.** This isn't a
style preference: a direct `param.value = x` write is a hard discontinuity in the signal, audible
as a click/zipper when repeated every tick - confirmed as the root cause of a real, reported bug
(volume jitter on a chase-cammed vehicle) that motivated this whole subsystem's design. See
`packages/audio/src/utils/ramp.ts`'s `rampParam` helper and its doc comment for the full mechanism;
every position/volume/pan setter in every `WebAudioSource(2d|3d)Component`/`WebAudioScene(2d|3d)Component`
routes through it, with **no exception** anywhere in the codebase - if you find yourself writing
`somAudioParam.value = ...` while extending this package, that's very likely the bug.

Static tuning fields that don't change every frame (`refDistance`, `maxDistance`, `rolloffFactor`,
`distanceModel`, `coneInnerAngle`/`coneOuterAngle`/`coneOuterGain`) are fine to proxy directly to
the native node without ramping - they're not written on a per-tick cadence, so there's no
discontinuity to smooth away. The rule is specifically about anything driven by world state that
changes every tick: position, and any gain/pan value derived from it.

**Default `distanceModel` to `'linear'`, not your backend's own default (Web Audio's is
`'inverse'`).** `'inverse'`'s slope is steepest right at `refDistance` - exactly where a
chase-cammed source sits relative to its own camera - so even ramped, tiny per-tick distance
jitter still reads as an audible volume swing there. `'linear'` doesn't have this problem. See
`AudioDistanceModel`'s own doc comment in core for the full explanation.

## No native distance model? Recompute it yourself in `update()`

Web Audio's `PannerNode` (3D) computes distance-based gain and cone attenuation natively, on the
audio thread, from whatever position you push into it - `update()` only has to keep the listener in
sync (see `WebAudioScene3dComponent.update`). `StereoPannerNode` (used for 2D, since there's no 2D
equivalent of `PannerNode`) is pan-only - it has no distance concept at all. `packages/audio`'s 2D
implementation compensates by tracking every living source (`WebAudioSceneComponentBase.registerSource`/
`unregisterSource`, wired through `IWorldComponent.addToWorld`/`removeFromWorld`) and recomputing
pan + a manual distance `GainNode` for each one, every `update()` tick, from `distance-gain.ts`'s
`computeDistanceGain` - deliberately kept identical to the Web Audio spec's own three distance-model
formulas so a source sounds the same whether it ends up in a 2D or 3D world. If your backend's 2D
story also lacks a distance primitive, reuse this same pattern (or the helper itself) rather than
inventing a new falloff curve.

## How `update()` gets called, and what "listener" means

`GgWorld`'s tick loop calls `audioScene.update(elapsed, delta)` once per frame, after every
entity's own `tick$` (including renderers/camera controllers) has already fired - so by the time
your `update()` runs, `activeListener.position`/`.rotation` reflect this frame's final camera
transform, not a stale one. `activeListener` is just "whatever `IPositionable(2d|3d)` is currently
assigned" - normally a renderer's camera, but nothing stops app code from assigning something else.

`GgWorld.addEntity` auto-binds `activeListener` to a renderer's camera the moment that renderer
becomes the *only* one in the world, and warns (without guessing) once a second renderer shows up
with no listener explicitly chosen - see `GgWorld.maybeBindAudioListener`'s doc comment for the
exact rule, including why "already bound automatically" and "app set it on purpose" have to be
tracked separately (`audioListenerAutoBound`) rather than both just meaning "activeListener !==
null" - a second renderer must still trigger the warning even though the first one already caused
an (automatic, not app-chosen) listener to be set.

**Local-forward convention for 3D**: this engine's camera-facing code (`FreeCameraController`,
`PlayerCharacterController`) treats local `{x:0,y:0,z:-1}` (`Pnt3.nZ`) as "forward" and local
`{x:0,y:0,z:1}` (`Pnt3.Z`) as "up", both rotated into world space via `Pnt3.rot(vector, rotation)`.
Any 3D audio adapter computing a listener's or a directional source's forward/up vector from its
rotation quaternion must use this same convention (see `WebAudioScene3dComponent.update` and
`WebAudioSource3dComponent`'s `rotation` setter) - using a different local axis would make cone
orientation/listener facing silently disagree with which way the camera actually looks.

## Pooling for high-frequency one-shots

`AudioSourcePool<D,R>` (`utils/audio-source-pool.ts`) is a fixed-size, LRU-stealing pool of
`IAudioSourceComponent` instances sharing one `AudioSourceDescriptor` (one pool per distinct sound
effect). What it actually bounds is each voice's own gain/spatialization node chain - a Web Audio
`AudioBufferSourceNode` can only ever be `start()`ed once by spec regardless of pooling, so
`play()` on a reused voice always creates a fresh one internally; the pool's payoff is never
re-allocating the surrounding chain (or, at the browser level, running into the concurrent-node
cap) for a debris field or crowd of impacts firing many sounds per second. It's opt-in - core's own
`playOneShot`/`"PlaySound"` blueprint node don't use it automatically, since deciding whether a
given sound effect is high-frequency enough to warrant pooling is an app-level call, not something
core can infer from a clip alone.

## Autoplay policy (browser gesture requirement)

Every browser suspends (or refuses to start) an `AudioContext` until a user gesture accepts it.
`WebAudioSceneComponentBase.init()` handles the common case by attaching one-shot
`pointerdown`/`keydown` listeners that resume the context, removed automatically the first time
either fires - see that method's doc comment. An app with its own "click to start" screen can call
`world.audioScene.context.resume()` directly from that click handler instead; this makes the
auto-attached listeners inert (harmless) rather than conflicting with it.

## Level JSON: the `"Sound"` built-in class

Both `Gg3dLevelLoader` and `Gg2dLevelLoader` register a `"Sound"` class out of the box
(`Sound3DSettings`/`Sound2DSettings`) - loads a clip via `audioScene.factory.loadClip` and returns
a statically-positioned `AudioSource(3d|2d)Entity`. This covers the "static" and "ambient/level
music" placement modes (the latter is just `spatial: false, loop: true, bus: "music"`, no separate
class) - it deliberately does **not** support "attached to another entity" (a level JSON has no way
to reference a not-yet-loaded entity, the same reason a `"GgCar"` wheel's mesh or a `"Player"`'s
input controller aren't level-JSON-authored either) or one-shot playback (nothing static to
declare - use the `"PlaySound"` blueprint node instead). See `gg-engine-level-json`'s own "Sound"
section for the full settings shape and an authoring example.

## Blueprints: the `"PlaySound"` built-in node

Every `LevelLoader` (base, dimension-agnostic) registers `"PlaySound"`
(`PlaySoundBlueprintNode`, `base/blueprint/nodes/play-sound.node.ts`) with `"trigger"` as its
default input pin - the blueprint analogue of `AudioSource(2d|3d)Entity.playOneShot`, wireable
straight from an `EntityJson.events` binding (e.g. a `"Trigger"` entity's `onEntityEntered`) with
no `blueprints` graph needed. It resolves the sound's position from `settings.position` if given,
else from the triggering payload's own `.position` (true for whatever `onEntityEntered`/
`onEntityLeft` emit - an `IEntity & IPositionable(2d|3d)`) - see that class's own doc for the full
resolution order. This node is dimension-agnostic by construction (it only touches
`audioScene.factory`/`IAudioSourceComponent`, never a dimension-specific entity type), so it needs
no adapter-side work at all - implementing `IAudioSourceComponentFactory` correctly is enough for
it to work.

## package.json / tsconfig conventions

Copy `packages/audio/package.json`/`tsconfig.json` as the template (closest thing to "no vendored
third-party lib" among existing adapters, unlike `three`/`pixi`/`ammo`/`rapier*`/`matter`, all of
which pin an exact third-party dependency version in both `devDependencies` and
`peerDependencies`) - `@gg-web-engine/audio` doesn't have one at all, only `@gg-web-engine/core` and
`rxjs`. If your adapter *does* wrap a third-party library (e.g. a hypothetical Howler-backed
package), follow the usual adapter convention instead (exact-pinned in both dependency lists) - see
`gg-engine-visual-adapter`'s package.json section for that case.

## Testing

jsdom (this repo's jest environment) has no native Web Audio implementation at all - there's no
real `AudioContext` to construct in a test, which is why `packages/audio` has no unit tests
directly exercising `WebAudioSceneComponentBase`/`WebAudioSourceComponentBase` against a real
context. What *is* tested, and should be for any audio adapter: pure logic that doesn't need a
real native node - `computeDistanceGain` (`test/utils/distance-gain.spec.ts`, verified against the
Web Audio spec's own three formulas) and `AudioSourcePool` (`test/utils/audio-source-pool.spec.ts`,
against a hand-rolled fake `IAudioSceneComponent`/`IAudioSourceComponent`, the same "mock the
interface, not the native API" approach `packages/core`'s own tests use for physics/rendering
components). Core-level behavior (the `"Sound"` class, `"PlaySound"` node, `GgWorld`'s
listener-auto-bind) is covered in `packages/core/test/` against `MockWorld`-style fakes - see
`packages/core/test/base/blueprint/play-sound.node.spec.ts` and the "audio listener auto-bind"
describe block in `packages/core/test/base/gg-world.spec.ts` for the pattern.

## Wiring a new adapter into the repo

Same five steps as `gg-engine-visual-adapter`'s own "Wiring a new adapter into the repo" section:
add it to the root `tsconfig.json`'s `references` array, add its name to `etc/publish_new_version.sh`'s
`libs` array, add at least one example under `examples/` (none exist yet for `packages/audio` as of
this writing - a good first one would extend an existing car example with `GgCarEntity.engineRpm$`-driven
engine sound, since that's the case study the audio design doc uses), add it to the root `README.md`
"Integrations" list plus its own `packages/<lib>/README.md`, and `npm install` at the repo root
(no manual registration needed - `packages/*` is an npm workspace, a new directory joins it
automatically). CI (`.github/workflows/pull_request_build.yml`) needs no per-package edit - it
already runs `npm install && npm run build && npm run test` at the root, which covers every
workspace member including a newly added one.

## Keep this skill current

This file is read by future agents building/maintaining audio adapters, not by end users of the
engine. If a backend-specific quirk bites you (a native API that doesn't map cleanly onto
`IAudioSourceComponent`, a browser autoplay-policy edge case, a distance-model formula that doesn't
match what's documented here), or something written here turns out wrong or incomplete once you've
actually implemented it, add a short note (what went wrong, why, the fix) before finishing - folded
into the relevant section rather than left as a loose log entry.
