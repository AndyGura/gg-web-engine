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

## What belongs in the engine, and what stays in the game

An audio feature joins core's contract (and `packages/audio`) when it is a generic mixer concept:
something game audio middleware (Wwise, FMOD, Unity's AudioMixer) also has, useful to any game
regardless of genre - buses and their hierarchy, per-bus reverb, a voice budget, listener handling,
pause. What a particular game decides with those tools stays in that game: which settings screen
drives which bus volume, which panning model a given device gets, a stylized output effect (a mono
downmix, a bit-crushed retro output), a tuned reverb preset for one level. Before adding a request
coming from one app, check whether it can already be built from the existing API with a few lines
of app code; if so, that is where it belongs. When a game had to subclass a scene or override
`getBusNode` to get something, that is the signal worth looking at - work out the generic concept
it is missing rather than upstreaming the game's workaround.

Several scenes can share one `AudioContext` (`packages/audio`: the `context` constructor option) -
see "Sharing one AudioContext" below for what that changes and why an app needs it.

## Decide dimensionality, same as any other adapter

Implement either the `3d/components/audio/*` interfaces (see `packages/audio`'s 3D classes) or the
`2d/components/audio/*` ones (2D classes) from `packages/core/src`. They're structurally similar
(both extend the base `IAudioSceneComponent`/`IAudioSourceComponent`) but the 3D ones add distance
cone fields (`coneInnerAngle`/`coneOuterAngle`/`coneOuterGain`), 3D-specific rolloff and a
`panningModel` (`'HRTF'`/`'equalpower'`), mirroring how `ICamera3dComponent` adds FOV that 2D has no
equivalent for. `panningModel` is the one 3D field also set at creation: `AudioSource3dDescriptor`
(the base descriptor plus `panningModel`) is what `IAudioSource3dComponentFactory.createSource`
narrows its parameter to, and an unset one falls back to the 3D scene's `defaultPanningModel`
(`'HRTF'` by default; the app's one switch for a cheaper mobile mix). A backend with no HRTF can
map both values to its own panner, but must keep the property readable/writable.

## The contract you must implement

- **`IAudioSceneComponent<D,R,ATypeDoc>`** (`base/components/audio/i-audio-scene.component.ts`):
  owns the native audio backend (an `AudioContext` for `packages/audio`), `backendName` (a short,
  stable name for the dev console's `worlds`/`world` commands - `'webaudio'` there), the source `factory`,
  `masterVolume`/per-bus `getBusVolume`/`setBusVolume` (both read back the value last set, not
  the level a ramp has reached so far), the bus hierarchy `setBusParent`/`getBusParent` (see
  "Bus hierarchy" below), per-bus `setBusReverb`/`getBusReverb` (see "Bus reverb" below), the
  single `activeListener` reference
  (`setActiveListener`), the voice budget `maxVoices` plus its `voiceCounts` (see "Voice budget"
  below), `playOneShot(descriptor)` (a non-positional, self-disposing one-shot on a bus - delegate
  to core's `playAudioOneShot(this.factory, descriptor)`, as `packages/audio` does, rather than
  writing it again), and `update(elapsed, delta)` - called once per world tick by `GgWorld`
  itself (see "How `update()` gets called" below), not by app code. A scene used without a world
  (an app's menu scene) never gets `update()` at all, so nothing a scene-level feature needs to
  finish may wait on it - see "Timed fades" and "Voice budget" below.
- **`IAudioSourceComponentFactory<D,R,ATypeDoc>`** (`base/components/audio/i-audio-source.component-factory.ts`):
  unlike the rendering/physics factories, this one is defined once at the *base* level and just
  narrowed by dimension in `2d/factories.ts`/`3d/factories.ts` (`IAudioSource(2d|3d)ComponentFactory
  extends IAudioSourceComponentFactory<Point(2|3), ..., ATypeDoc> {}`, no new methods) - a clip in,
  a positioned source out is identical in shape regardless of dimension, unlike
  `Shape2DDescriptor`/`Shape3DDescriptor` which genuinely differ. Three methods:
  `decodeClip(data: ArrayBuffer)` (decode an already-fetched file into whatever native
  representation `createSource` expects), `loadClip(url)` (fetch+decode by itself, caching by URL)
  and `createSource(descriptor)`. Core's own loading (`world.loader.loadClip`, which the `"Sound"`
  level class and the `"PlaySound"` blueprint node use) does the fetch itself - that is where
  progress, cancellation and the per-world cache live - and calls `decodeClip`; `loadClip` is the
  direct shortcut for app code, and what core falls back to (without byte progress) when a factory
  has no `decodeClip`.
- **`setPaused(paused)`** on the scene: `GgWorld` calls it whenever its clock pauses or resumes.
  It has to freeze every source in place and continue from there. `packages/audio` suspends and
  resumes the whole `AudioContext` when the scene owns it, which does that for free, including
  sources scheduled but not yet audible; nothing is tracked per source. A scene on a shared context
  pauses its own sources instead - see "Sharing one AudioContext" below. Two things to keep: the autoplay-gesture handler must
  not resume a context that is paused this way (it returns early while paused, and
  `setPaused(false)` does the resume - or, if that call comes outside a gesture and the browser
  refuses, the next gesture after it), and `suspend()`/`resume()` reject on a closed context or one
  the browser hasn't allowed to start yet - both are swallowed.
- **`IAudioSourceComponent<D,R,ATypeDoc>`** (`base/components/audio/i-audio-source.component.ts`):
  one sound instance - `IPositionable<D,R>` (position/rotation proxied to the native
  spatialization node) plus `loop`/`loopStart`/`loopEnd`/`volume`/`playbackRate`/`spatial`/`bus`/
  `priority`, `play()`/`pause()`/`stop()`, `fadeTo(volume, durationMs)` (see "Timed fades" below),
  `isPlaying`, `isVirtual`, and `ended$` (fires once when a non-looping clip
  finishes - what `AudioSource(2d|3d)Entity.playOneShot` and the `"PlaySound"` blueprint node
  subscribe to for self-cleanup). `loopStart`/`loopEnd` (seconds, both default `0` - `loopEnd: 0`
  means "end of clip", matching `AudioBufferSourceNode.loopEnd`'s own default) confine looping to a
  sub-region of the clip rather than the whole thing - needed for any clip authored with a lead-in
  before its seamless loop point (a real, common asset-authoring pattern for engine/ambience loops;
  `examples/3d/fly-city`'s engine sound is a real consumer of this). Also an
  `IWorldComponent` (`addToWorld`/`removeFromWorld`/`dispose`), same contract as every other
  component - see `gg-engine-physics-adapter`'s section on `dispose`.

Core supplies the generic entity wrapper (`AudioSource3dEntity`/`AudioSource2dEntity`,
`3d(2d)/entities/audio-source-(3d|2d).entity.ts`) - **you never need to write this yourself**, only
the components it wraps. It handles all three placement modes (static/attached/one-shot via
`playOneShot`) generically over whatever `TypeDoc['aTypeDoc']['source']` your adapter supplies.
The same goes for core's `MusicPlayer` (`base/audio/music-player.ts`: playlists, crossfades,
shuffle, `nowPlaying$`) and `applyMobileAudioDefaults` (`base/audio/mobile-audio-defaults.ts`):
both are written against the scene/source contract only (`factory`, `fadeTo`, `ended$`,
`maxVoices`, a 3D scene's `defaultPanningModel`), so a correct `fadeTo` is all an adapter owes them.

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
      playhead.ts                            # clip position after N seconds, Web Audio loop rules
      impulse-response.ts                    # procedural reverb impulse response (bus reverb)
      voice-ranking.ts                       # pure ranking behind the voice budget
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
routes through it, with **no exception for any write to an already-live node's `AudioParam`** - if
you find yourself writing `someAudioParam.value = ...` against a node that's already connected/
playing while extending this package, that's very likely the bug. The legitimate direct
assignments in this package are all an *initial* value on a node that was just created and isn't
producing output yet - there's no previous value playing to click against, so there's nothing for a
ramp to smooth: `gainNode.gain.value = this._volume` in `WebAudioSourceComponentBase`'s constructor
and `bufferSource.playbackRate.value = this._playbackRate` in its `play()` (both in
`web-audio-source-base.component.ts`), each set once on a freshly-created node before it's started,
and a bus reverb's new `wet` gain starting at `0` before it is connected (`takeReverbChain` in
`web-audio-scene-base.component.ts`), then ramped up. The other exception is `setParamNow`
(`utils/ramp.ts`), in two cases. One is a jump on a chain that is silent right now - a virtual
source's gain/position/pan, re-applied just before it is started again and faded in (see "Voice
budget" below), or its gain restored on a `play()` while no buffer source is playing into it. The
other is the 3D listener on a cut, where a ramp is worse than the jump: a newly set listener
(position and orientation), and a turn of more than 90° between ticks (orientation only) - see
"Listener orientation" below. A timed fade (`fadeTo`) is a ramp too, just a long linear one - see
"Timed fades" below for the one rule it adds to every other gain write.

Static tuning fields that don't change every frame (`refDistance`, `maxDistance`, `rolloffFactor`,
`distanceModel`, `panningModel`, `coneInnerAngle`/`coneOuterAngle`/`coneOuterGain`) are fine to proxy directly to
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

## Listener orientation and source cones (3D)

This Z-up engine has two local-axis conventions, and the listener can be either kind of object.
Core names them `AudioListenerBasis` (`3d/components/audio/audio-listener-basis.ts`):

- `'camera'`: forward local -Z (`Pnt3.nZ`), up local +Y (`Pnt3.Y`) - every camera, built like a
  three.js camera (`Qtrn.lookAt` puts the world's `Pnt3.Z` on a camera's local +Y; what
  `FreeCameraController`/`ObjectGrabController` read as the look direction).
- `'body'`: forward local +Y, up local +Z - every other entity (`RaycastVehicle3dEntity`,
  `CharacterController3dEntity`), so an upright body with the identity rotation faces level.

`IAudioScene3dComponent.setActiveListener(target, basis?)` stores the basis (`activeListenerBasis`);
without one it takes `defaultAudioListenerBasis(target)`: `'camera'` for a `Camera3dEntity` or
anything with a `fov` (a bare camera component), `'body'` otherwise. That covers `GgWorld`'s
auto-bind (a renderer's `Camera3dEntity`) and the `audio_set_listener` console command (a renderer
or any positionable entity), neither of which passes a basis. Every 3D adapter reads the listener's
forward/up as `Pnt3.rot(AUDIO_LISTENER_AXES[basis].forward|up, rotation)` (see
`WebAudioScene3dComponent.syncListener`), so all agree on which way a listener faces.

A directional source's cone points along its local +Y (`AUDIO_LISTENER_AXES.body.forward`, in
`WebAudioSource3dComponent.writeOrientation`): sources ride bodies (a car's horn, a speaker
entity) or sit in a level with a rotation, and either way the identity rotation should aim level,
not at the ground. A `PannerNode` source has no up, only the cone axis.

**Forward and up must never be degenerate** (up parallel to forward, `cross(forward, up) = 0`, or
either near zero length). Such an orientation has no left/right: Chrome then pans every
`PannerNode` source meaninglessly (silently wrong), and iOS Safari's `PannerNode`, while the
listener/source position params are under automation (ramped every tick, so always), renders every
positional source as severely broken, pitch-garbled audio, HRTF and `'equalpower'` alike - it
looks like an automation/ramping bug but is the orientation. Two ways to get there:

- A wrong axis pair: reading up from the axis forward already uses (local +Z with local -Z
  forward). Both `AUDIO_LISTENER_AXES` pairs are perpendicular by construction.
- The ramp itself. `setTargetAtTime` on each of the six params moves each component on its own,
  so forward and up travel the straight line between where the listener is and where it is going.
  Across a turn near 180° (a camera cut, a snap turn, a switch to a listener facing the other way,
  the first bind from the native default) both pass through near-zero length midway.
  `syncListener` therefore models where the native listener is right now - the last target eased
  from the last known value by `1 - exp(-(currentTime - lastTime) / DEFAULT_RAMP_TAU)`, the law
  `setTargetAtTime` follows - and jumps the orientation (`setParamNow`) when forward or up would
  have to turn more than `MAX_EASED_TURN` (90°) from there. A new listener (`setActiveListener`
  with a different target or basis) also jumps its position, instead of sweeping the ears across
  the level. Comparing against the modelled current value rather than the last target matters on
  a fast continuous turn, where the ramp lags a few ticks behind.

**Firefox (and older Safari) have no `AudioParam`-based listener** (`listener.positionX` is
undefined), only the legacy `setPosition`/`setOrientation`, which apply at once - this is the
everyday path for every Firefox user, not a fallback for ancient browsers. `syncListener` writes
the same modelled current value there, so the listener eases in on the main thread, tick by tick,
the way the ramp would; the same 90° and new-listener jumps apply. (`PannerNode.positionX` exists in
Firefox, so sources use the `AudioParam` path there.)

## Timed fades (`fadeTo`)

`fadeTo(volume, durationMs)` is a deliberate, audible fade (music out over a second), not the
~40 ms smoothing `rampParam` gives every write. `packages/audio` (`WebAudioSourceComponentBase`)
implements it as follows; a new adapter should keep the observable behavior:

- **On the audio clock.** A `linearRampToValueAtTime(volume, now + durationMs / 1000)` on the
  source's gain, mirrored on the main thread as `fade` (`from`, `to`, start and end in context
  time), so the level reached so far (`heardVolume`) is computed, never read back from
  `param.value` (not dependable across browsers for an automated param). The promise is resolved by
  a `setTimeout` that re-checks `context.currentTime` against the end and re-arms itself (at least
  every `MIN_FADE_POLL_MS`) until it is past: a suspended context (a paused world, a context the
  browser hasn't allowed to start) stops the clock, so fade and promise wait together. A closed
  context (the scene disposed) resolves `false` and stops the polling - its clock never moves
  again, and a source the scene doesn't dispose itself (one never added to a world, such as a
  `MusicPlayer` track) would otherwise poll forever. Not resolved from `update()`: a scene used
  without a world is never updated.
- **`volume` reads the target at once**, like every setter here; the voice ranking uses
  `heardVolume()` instead (`estimateGain`), so a source fading out keeps its rank while it is still
  heard rather than counting as silent from the first frame.
- **Every other gain write freezes a pending fade first** (`holdParam`, `utils/ramp.ts`, while
  `fadeScheduledUntil` is ahead of the clock). Two Web Audio rules make this necessary: a
  `setTargetAtTime` at the current time sorts *before* the fade's end event, so the linear ramp
  carries on from it and the write is lost; and `cancelScheduledValues` alone removes the ramp in
  progress, so the param snaps back to the value of the event before it - where the fade started,
  an audible click. `holdParam` uses `cancelAndHoldAtTime` where it exists (not Firefox), else
  cancels and re-anchors with `setValueAtTime` at the modelled level.
- **Interruptions resolve `false`**: a `volume` write, another `fadeTo` (which starts from
  `heardVolume()`, so a fade reversed halfway has no jump) and `dispose()`. An interruption after
  the clock already passed the end still resolves `true`. `stop()`/`pause()`/`play()` don't touch
  the fade - the gain's automation runs on regardless; a `play()` that has to restore a silenced
  gain jumps it to `heardVolume()` and schedules the rest of the fade.
- **Virtual sources schedule nothing** (the chain is disconnected - see "Voice budget" below).
  `demote` freezes a fade before ramping to 0 and records where it started (`demotedFrom`/
  `demotedAt`, the exponential `setTargetAtTime` follows from there, for the fallback anchor);
  `promote` (`rampGainIn`) ramps linearly to where the fade will be `FADE_CATCH_UP_SECONDS` later,
  then follows the rest of it - linear ramps chain cleanly from an anchor, while a linear ramp
  after a `setTargetAtTime` event starts from a point browsers disagree on.

## Sharing one AudioContext (`ownsContext`)

`new WebAudioScene3dComponent({ context })` (2D likewise; `WebAudioSceneOptions`) builds the scene's
whole graph - master gain, buses, reverbs, every source's nodes - on an existing context, which it
does not own (`ownsContext` is `false`). Why (nfs-web on iPhone, 0.0.86): an app keeps one menu
scene for its lifetime, unlocked by the first tap; every race created a world whose scene created a
new context, and iOS lets a new context start on its own only within ~2 s of a tap. Races load
longer, so race audio stayed silent until a tap-like gesture (holding a touch control does not
count). Suspending (pause) and closing (race end) the world's context also disturbed the menu
context's audio there. On the menu's context nothing new ever needs permission, and nothing is
suspended or closed under the menu. What a non-owning scene does differently:

- **`dispose()`** never closes the context. It disconnects what it created (master gain, bus gains,
  reverb chains) and, besides the world-registered sources, disposes every source of its own still
  playing or fading (`voices`, `fadingSources`): closing the context is what silenced those on an
  owning scene - a `MusicPlayer` track or pooled voice is never in `sources`, and a looping one
  would otherwise play on into a disconnected graph. The owner's nodes are never touched.
- **`setPaused`** must not suspend the shared context. The scene's `clock` (what every source
  timestamp is measured on: playhead anchor, fade start/end, `fadeEndsAt`, `demotedAt`) stands
  still at the pause (`pausedAt`), while `context.currentTime` runs on. `holdForScenePause` (each
  source playing or fading) stops heard voices' buffer sources (chain left connected), turns a
  voice fading out to virtual at once, and clears the fade's end check; `holdsSources` is `true`
  meanwhile. `releaseFromScenePause(shift)` moves every clock timestamp on by the paused time - so
  outside a pause `clock === context.currentTime` again and all existing scheduling code (which
  passes fade times straight to `linearRampToValueAtTime`) stays right - restores the gain
  (`restoreGain`: `setParamNow` to `heardVolume()` plus the rest of the fade; the gain's automation
  ran on with the context clock while nothing played into it), starts a new buffer source from the
  playhead, and re-arms the fade check. While held, nothing timed on the clock may be scheduled on
  an `AudioParam` (the two clocks differ): `play()` registers the voice and wires the chain but
  starts the buffer on release, `fadeTo` only records the fade, `demote` goes straight to virtual,
  `promote` wires up and leaves `gainSilenced` for the release, `watchFade` doesn't re-arm. Pause
  and resume are hard stops/starts, like `suspend()`/`resume()`.
- **No gesture listeners** (`init()` returns early): the owner unlocks the context, and a resume from
  this scene could undo the owner's own pause.
- **The listener is per context.** A 3D scene writes it only from `update()` while it has an active
  listener; non-owning scenes do too. Two updated scenes with listeners on one context would fight
  every frame - the app gives the listener to one (a world-less menu scene never writes it).
- Buses, master volume, reverbs and the voice budget stay per scene; both master gains feed
  `context.destination`.

## Pooling for high-frequency one-shots

`AudioSourcePool<D,R>` (`utils/audio-source-pool.ts`) is a fixed-size, LRU-stealing pool of
`IAudioSourceComponent` instances sharing one `AudioSourceDescriptor` (one pool per distinct sound
effect). What it actually bounds is each voice's own gain/spatialization node chain - a Web Audio
`AudioBufferSourceNode` can only ever be `start()`ed once by spec regardless of pooling, so
`play()` on a reused voice always creates a fresh one internally; the pool's payoff is never
re-allocating the surrounding chain for a debris field or crowd of impacts firing many sounds per
second. It bounds allocations, not what is heard at once across the scene - that is the voice
budget's job (below). It's opt-in - core's own
`playOneShot`/`"PlaySound"` blueprint node don't use it automatically, since deciding whether a
given sound effect is high-frequency enough to warrant pooling is an app-level call, not something
core can infer from a clip alone.

## Voice budget: `priority`, `maxVoices`, virtual sources

Browsers have no hard cap on simultaneous sources or panners; what runs out, on a phone especially,
is audio-thread CPU (an HRTF `PannerNode` is a convolution per source), and an overloaded render
thread glitches or drops sound. `maxVoices` on the scene (default `Infinity`) bounds how many
playing sources are rendered; the rest are *virtual*. `packages/audio` implements it as follows,
and a new adapter should keep the same observable behavior:

- **Who counts**: every source between `play()` and `pause()`/`stop()`/its end, added to a world or
  not (an `AudioSourcePool` voice never is). Sources report to the scene (`voiceStarted`/
  `voiceStopped`); this set is separate from the world-registered `livingSources` the 2D panning
  sweep uses.
- **Ranking** (`utils/voice-ranking.ts`, pure and unit-tested): audible before silent (estimated
  gain <= `SILENT_VOICE_GAIN`, so a loop parked at volume 0 never takes a voice from a sound being
  heard, whatever its priority), then `priority`, then estimated gain at the listener (volume as
  heard, `heardVolume()` - mid-fade, the level reached - x effective bus volume - its own times every parent bus's, `getEffectiveBusVolume` - x the source's
  own distance model through `computeDistanceGain` - cones ignored) with
  `AUDIBLE_VOICE_BIAS` for the sources already heard (otherwise two near-equal sources at the
  budget's edge swap every frame), then the one already heard, then creation order. Re-ranked every
  `update()` (both scenes end theirs with `updateVoices()`) and synchronously in `play()` when the
  budget is full, so a newcomer that ranks low starts virtual with no buffer source at all. A
  scene with no virtual source and no more playing sources than the budget skips all of it -
  `Infinity` costs nothing.
- **A scene no world updates still keeps its budget.** `MusicPlayer`, `playOneShot` and
  `applyMobileAudioDefaults` (a 16-voice budget on any touch device) all work on a world-less
  menu scene, which never gets `update()`. Everything that frees a voice only *removes* it
  (`voiceStopped`), and only the bookkeeping pass gives it to a virtual source, finishes a fade-out
  and ends a virtual one-shot - so without a pass, sources once outranked stay virtual for good,
  keep counting toward the budget, and every newcomer (a click, a new track fading in from 0) is
  outranked: the scene goes silent. `packages/audio` therefore runs the same pass
  (`upkeepVoices`) from a timer while it is needed: any ranking that leaves a source virtual arms a
  `setTimeout` of `VOICE_UPKEEP_INTERVAL_MS` (50 ms), which re-arms itself until nothing is virtual
  and the budget isn't exceeded. A world-driven scene is left alone: `updateVoices()` (the
  `update()` path) sets `voicesUpdatedByWorld`, and a timer tick that finds it set only clears it
  and re-arms (so a world that stops ticking is taken over a tick later). `setPaused(true)` clears
  the timer, `setPaused(false)` re-arms it, `dispose()` clears it for good (on a shared context too). Don't instead promote
  from `voiceStopped`: it runs inside `rankVoices` (a promoted one-shot that already ran out ends
  there) and would change when a world-driven scene hands voices over.
- **Going virtual** (`demote`): ramp the gain to 0, and once `VIRTUAL_FADE_SECONDS` (5 ramp time
  constants) have passed, stop the buffer source and disconnect the gain/spatial chain from the bus,
  so neither renders. **Coming back** (`promote`): mid-fade, just ramp the gain back up (the buffer
  source never stopped); fully virtual, reconnect, `setParamNow` the stored position/pan and a gain
  of 0, start a new buffer source at the computed playhead and ramp the gain up.
- **Playhead**: tracked on the main thread for every playing source - an offset plus the context
  time it was taken at, re-anchored before every `playbackRate`/`loop`/`loopStart`/`loopEnd` change
  so time already played keeps the rate it was played at, and wrapped with the Web Audio loop rules
  (`utils/playhead.ts`). `pause()` uses the same tracker, so a paused source resumes at its real
  position whatever its rate or loop region.
- **Don't schedule `AudioParam` events on a disconnected chain.** A node outside the rendered graph
  never processes its automation timeline, so a per-tick `setTargetAtTime` on a virtual source's
  panner just piles events up (WebKit's own panner slowdown, bug 230950, was exactly an
  ever-growing timeline). While virtual, `volume`/`position`/`rotation`/2D pan only store their value
  (`isOutputConnected`, `gainSilenced`). The chain stays disconnected after a virtual source ends,
  pauses or stops, so every path that reconnects it - `promote` *and* `play()` - must
  `resyncSpatialParams()` right after `connectOutput()`, before the buffer source starts; otherwise
  a pooled voice moved and replayed after ending virtually is heard from its previous position.
- **One-shots stay virtual until they would have ended** (not dropped): the bookkeeping pass
  (`advanceVirtual`, from `update()` or the timer) ends them then and fires `ended$`, so `playOneShot`/`"PlaySound"`/
  `AudioSourcePool` cleanup keeps working, and one promoted halfway through resumes halfway through.
- `isPlaying` stays `true` while virtual; `isVirtual` is `true` from the moment a source is demoted
  (fade-out included). `voiceCounts` is `{ playing, audible, virtual }`; the dev console's
  `audio_voices [int|inf]` reads/sets the budget and prints it.

## Bus hierarchy: a bus feeds its parent or the master gain

Every bus feeds the master gain until `setBusParent(bus, parent)` points it at another bus. In
`packages/audio` that means the bus's outputs - its `dry` gain and its reverb's `wet` gain(s) -
connect to the parent's `input` instead of `masterGain` (`busOutput`), so a child is heard through
the parent's volume and the parent's reverb, and volumes multiply down the chain. The bus stores
its parent's *name*, so a parent is created lazily like any bus.

- Reparenting disconnects those outputs from the old destination and connects them to the new one,
  releasing reverb chains included (they still feed their bus's output until disconnected). This
  is a live rewire that can drop a render quantum, which is why the contract calls it a setup-time
  operation rather than adding a crossfade. Nothing upstream changes: sources and child buses stay
  connected to the bus's `input`.
- Cycles are rejected before anything changes, by walking up from the new parent.
- Bus volumes are stored on the bus (`volume`) as well as ramped into `input.gain`: an
  `AudioParam`'s `.value` reads where a ramp is *now*, so reading it back right after a set returns
  the old value. `getBusVolume`/`masterVolume`/`getEffectiveBusVolume` all use the stored targets.
- The voice ranking needs the multiplied volume (a muted parent must make its children's sources
  count as silent), which is why `estimateGain` calls `getEffectiveBusVolume`, not `getBusVolume`.

## Bus reverb: one convolver per bus, none while off

`setBusReverb(bus, settings | null)` (contract and defaults in core: `AudioReverbSettings`,
`resolveAudioReverbSettings` - validation and defaults live there so every adapter agrees) puts a
reverb on a bus, made to be called every frame with a changing `wet` (a game fading a tunnel echo
in and out). `packages/audio`'s graph per bus (`WebAudioSceneComponentBase.getBus`):

```
sources, child buses -> input (GainNode, bus volume) -> dry (GainNode) -------------------> output
                                                     \-> ConvolverNode -> wet (GainNode) -/
```

where `output` is the parent bus's `input`, or `masterGain` (see "Bus hierarchy" above).

- `input` is what `getBusNode` returns and sources connect to; `dry` exists on every bus from the
  start (a plain gain at `1` costs nothing), so turning a reverb on never rewires the dry path -
  a disconnect/connect pair on a live path can drop a render quantum in between.
- The reverb sits after the bus volume, so muting a bus mutes its reverb too. It is per bus, not
  per source: virtual voices and the voice budget need nothing from it (`estimateGain` ignores
  `wet`/`dry`).
- The impulse response is generated (`utils/impulse-response.ts`, pure and unit-tested: stereo
  decorrelated noise, exponential 60 dB fall over `decay`, a one-pole low-pass sliding down over the
  tail by `damping`, `preDelay` of leading zeros, seeded so it is deterministic) when the settings'
  shape (`decay`/`preDelay`/`damping`) is first given or changes - `wet: 0` included, so an app can
  prepare it at load time. Loudness is left to `ConvolverNode.normalize` (default `true`).
- `wet`/`dry` are ramped, and skipped when equal to the previous call's value (a per-frame call
  with nothing changing schedules no automation).
- **No convolver while `wet` is 0.** Going to 0 (or `null`) ramps the chain's `wet` gain to 0 and
  queues it in `releasingReverbs`; `updateReverbs()` (end of both scenes' `update()`) disconnects
  it `REVERB_RELEASE_SECONDS` later. Fading in again takes the releasing chain back if it is still
  there (just ramps up), else creates a **fresh** `ConvolverNode`: a disconnected convolver is not
  processed, so one kept around would still hold the old tail and play it on reconnection.
- A shape change crossfades: the old chain is released (fades out), a new one with the new impulse
  ramps in.
- `null` releases the chain, ramps `dry` back to `1` and forgets the settings.

## Autoplay policy (browser gesture requirement)

Every browser holds an `AudioContext` back until a user gesture accepts it, and a world is often
created without one (while a level loads). `WebAudioSceneComponentBase.init()` handles it for the
app: for the scene's whole life it listens on `window` for `RESUME_GESTURE_EVENTS` (`pointerdown`,
`pointerup`, `touchend`, `click`, `keydown`), capture phase, passive; each one that finds the
context neither `'running'` nor `'closed'`, while the scene is not paused, calls
`context.resume()` (rejection swallowed) and starts a one-sample silent `AudioBufferSourceNode`
into the destination within the gesture. `dispose()` removes the listeners (`resumeListener`).
An app with its own "click to start" screen can still call `world.audioScene.context.resume()`
from that click; the listeners then find the context running and do nothing.
A scene on a shared context (`ownsContext` false) binds none: its owner does this. That is also the
app-level fix for a world created long after the last gesture (iOS starts a new context on its own
only within ~2 s of a tap): build the world's scene on the menu scene's running context.

Pitfalls this design exists for (found with nfs-web on iPhone, 0.0.86 - every sound of a world
created during a race load stayed silent until WebKit happened to start the context on its own):

- **WebKit's `'interrupted'` state.** A context WebKit holds back can report `'interrupted'`
  instead of `'suspended'` (Playwright WebKit: a context created before any gesture starts
  `'interrupted'`), and iOS interrupts a running context later (a call, other audio, the app in
  the background). Test "not running and not closed", never `=== 'suspended'`;
  `'interrupted'` is not in TypeScript's `AudioContextState`, compare it as a `string`.
- **Not only until the first resume.** Because of the later interruptions, the listeners stay for
  the scene's life; a gesture on a running context costs one state check.
- **Capture phase.** `@gg-web-engine/mobile-controls`' `TouchControl` calls `stopPropagation()` in
  its pointer handlers, so bubbling listeners on `window` never see a touch on a control - on a
  phone with the overlay, nearly every touch during play.
- **Never `{ once: true }`.** The first gesture may not resume anything: the world is paused (the
  handler returns early, see `setPaused`), or the browser does not count that event as a user
  activation for audio. iOS ignores `pointerdown`; it accepts `pointerup`, `touchend`, `click`,
  `keydown` - hence all of them.
- **`resume()` alone is not always enough on iOS.** Starting a node inside the gesture is what
  makes WebKit start a context it held back (the classic silent-buffer unlock); a node started by a
  game sound during a touch (a tyre squeal) did it by accident before the fix.
- **SSR / node.** Nothing is bound without a `window`; the silent buffer is built lazily and
  wrapped in `try`, so a test double context without `createBuffer` keeps working.

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
`gg-engine-visual-adapter`'s package.json section for that case. Declare `"sideEffects": false`
(see that same section for when a package lists files instead).

## Testing

jsdom (this repo's jest environment) has no native Web Audio implementation at all - there's no
real `AudioContext` to construct in a test. What *is* tested, and should be for any audio adapter:

- Pure logic that needs no native node: `computeDistanceGain` (`test/utils/distance-gain.spec.ts`,
  verified against the Web Audio spec's own three formulas), `wrapPlayhead`
  (`test/utils/playhead.spec.ts`, the Web Audio loop rules), `generateImpulseResponse`
  (`test/utils/impulse-response.spec.ts`), `rankVoices`
  (`test/utils/voice-ranking.spec.ts`), and `AudioSourcePool`
  (`test/utils/audio-source-pool.spec.ts`, against a hand-rolled fake `IAudioSceneComponent`/
  `IAudioSourceComponent` - the same "mock the interface, not the native API" approach
  `packages/core`'s own tests use for physics/rendering components).
- The real scene/source classes against a hand-rolled fake `AudioContext` installed as
  `global.AudioContext`: `test/components/web-audio-scene-base.component.spec.ts` (the gesture
  listeners - dispatched as real DOM events, including one a child element stops in the bubbling
  phase and contexts starting `'interrupted'` - `setPaused`, `decodeClip`), `test/components/web-audio-buses.spec.ts` (the bus
  reverb graph and bus parents on both scenes; its fake nodes record their outgoing connections, so a test asks
  whether a convolver is fed by the bus and reaches the master gain),
  `test/components/web-audio-voice-budget.spec.ts` (the
  voice budget end to end on a `WebAudioScene3dComponent`; the fake context's `currentTime` is
  advanced by the test, and its fake `AudioParam`s record the last ramp target, which is how a
  fade is asserted; its world-less describe block uses jest fake timers, advances clock and timers
  together in `VOICE_UPKEEP_INTERVAL_MS` steps without calling `update()`, and fires a fake buffer
  source's `onended` once its clip has played through, as the browser would), `test/components/web-audio-fade.spec.ts` (`fadeTo` and `playOneShot`; its
  fake `AudioParam` keeps the automation timeline and computes the value at any time, run with and
  without `cancelAndHoldAtTime` - sample it only from the current time on, since a cancellation
  rewrites the timeline's past, which the real audio thread had already rendered) and
  `test/components/web-audio-shared-context.spec.ts` (an owning and a non-owning 3D scene on one fake
context: dispose never closes it or touches the owner's nodes, per-scene pause keeps playheads
across the paused time, plays and fades started while paused, the voice budget while paused, the
shared listener) and
`test/components/web-audio-listener.spec.ts` (the listener's basis, and
  its easing: its fake `AudioParam` follows `setTargetAtTime`/`setValueAtTime` as the browser does,
  so a test samples what the audio thread renders between ticks and asserts forward/up never go
  degenerate across turns, snap turns and listener switches; plus the legacy-listener easing).

Core-level behavior (the `"Sound"` class, `"PlaySound"` node, `GgWorld`'s
listener-auto-bind, `MusicPlayer`, `playAudioOneShot`, `applyMobileAudioDefaults`) is covered in
`packages/core/test/` against `MockWorld`-style fakes - see
`packages/core/test/base/blueprint/play-sound.node.spec.ts`, the "audio listener auto-bind"
describe block in `packages/core/test/base/gg-world.spec.ts` and `packages/core/test/base/audio/`
(over `test/mocks/audio-scene.mock.ts`, whose fake source leaves each `fadeTo` pending until the
test settles it) for the pattern.

## Wiring a new adapter into the repo

Same five steps as `gg-engine-visual-adapter`'s own "Wiring a new adapter into the repo" section:
add it to the root `tsconfig.json`'s `references` array, add its name to `etc/publish_new_version.sh`'s
`libs` array, add at least one example under `examples/` (`examples/3d/fly-city`'s
`GameAudio`/`game-audio.ts` is the reference one, wiring `GgCarEntity.engineRpm$`-driven engine
sound plus gear-change/honk one-shots into a car example), add it to the root `README.md`
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
