# Changelog

All notable changes to GG-Web-Engine are recorded here. Every `@gg-web-engine/*` package ships
together at the version listed, so one section covers `core` and every adapter.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). In the `0.0.N`
releases the public API could change between any two versions. From 0.1.0 on, the README's
versioning policy ("Project status") applies: breaking changes come only in a minor release, and
each one is listed under "Changed" or "Removed" with a migration note.

How this file is maintained:

- Every PR with a user-visible change adds a line under the `Unreleased` heading (feature,
  behavior change, bug fix, dependency bump that affects consumers). Internal refactors and
  doc-only changes are omitted.
- The release pipeline (`etc/roll_changelog.sh`, run first thing by the `[pre-release] [X.Y.Z]`
  job) moves those lines into a new `## [X.Y.Z] - YYYY-MM-DD` section, adds the compare link at
  the bottom and leaves a fresh empty `Unreleased` section behind. It requires the bracketed
  `Unreleased` marker to appear exactly twice in this file (that heading and its compare link),
  so never write it anywhere else here. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Gaps in the version sequence (`0.0.41`–`0.0.47`, `0.0.50`–`0.0.55`, `0.0.64`, `0.0.67`–`0.0.69`)
  are release attempts that failed partway through the publish pipeline. npm refuses to
  re-publish an existing version, so each retry took the next number. Nothing was released under
  those numbers.

Entries before this file existed (everything up to `0.0.72`) were reconstructed from git tags and
commit history on 2026-09-30, so early sections are terse and reference pull requests by number
where one exists.

## [Unreleased]

### Added
- core: `KeyboardInput.externalFocusOwnKeys`, elements (CSS selectors) that use only some keys while
  focused, and `KeyboardInput.focusUsesKey(code, element?)`, whether the focused element uses a key
  itself. By default buttons (`<button>`, `<input>` of type button, submit, reset, image and
  checkbox) use Enter, NumpadEnter and Space.

### Fixed
- core: a focused button no longer swallows every key down: `KeyboardInput` skips only the keys it
  clicks on (Enter, NumpadEnter, Space), so a DOM menu whose button has focus (a pause menu focusing
  Resume) still gets Escape and every other bound key. Text fields and selects still skip every key.
  `HTMLButtonElement` left `KeyboardInput.externalFocusBlacklist` for `externalFocusOwnKeys`; put it
  back in the list to skip every key on buttons again. The dev console's `bind_key` follows the same
  rule.

## [0.0.89] - 2026-10-28

### Added
- core: `Gg3dWorld.frame` (with `frame$` and a `frame` constructor option), the global placement of
  a 3D world's local origin - a translation plus a yaw about `+Z` - for open worlds made of
  sections each simulated near its own origin. Identity by default. `toGlobalPoint`/`toLocalPoint`,
  `toGlobalDirection`/`toLocalDirection` and `toGlobalRotation`/`toLocalRotation` convert through
  it; `Frame3d` is the immutable value behind it, with `compose`, `inverse` and `equals`.
- core: `RigidBodyCorrection` and `MoverCorrection` take an optional `NetworkFrame` (`Frame3d`
  implements it): `capture(body, frame)` returns global state, `correct(..., tuning, frame)` converts
  a global target to local; `toGlobal`/`toLocal` convert a state alone. `Entity3d`, `GgCarEntity`
  and `CharacterController3dEntity` (state and input rotation) convert their network state through
  their world's frame.
- core: `Gg3dWorld.switchFrame(newFrame)` moves a world into another frame between two ticks: every
  entity is moved by the rigid transform `newFrame⁻¹ ∘ oldFrame` (positions rotated about `+Z`,
  then translated; rotations get the yaw in front; velocities rotated), so nothing changes
  globally and the next rendered frame looks the same. Called during a tick, it applies after the
  physics step and before rendering (`pendingFrame` holds it until then); called while a switch is
  being applied, it applies right after that one. `frameSwitched$` emits the `FrameSwitch`
  (`delta`, `previousFrame`, `frame`) after each switch.
- core: `IFrameSwitchable` (`onFrameSwitch(delta)`), implemented by `Entity3d` and its subclasses
  (raycast vehicles and cars with their wheels, character controllers, triggers, cameras and every
  built-in camera controller, lights, 3D audio sources, particle systems, the map graph with its
  loaded and loading chunks, surface-following entities, grabbables). Physics components, the
  physics world and the visual scene may implement an optional `onFrameSwitch` for native state a
  pose write misses. Helpers: `isFrameSwitchable`, `switchPoseFrame`, `switchBodyFrame`,
  `claimFrameSwitch`. With the dev console present (`window.ggstatic`), switching a world holding a
  positioned entity without the hook warns once per class.
- ammo, rapier3d: physics components and worlds implement `onFrameSwitch`: bodies keep their
  activation/sleep state, velocities, contacts and (ammo) interpolation; triggers keep their
  overlaps; forces applied before the next step are rotated; queries right after a switch find the
  moved colliders; vehicles keep their wheels and suspension.
- three: the visual scene implements `onFrameSwitch`: the sky and the environment map turn with a
  switch's yaw, so they stay in place globally.
- core: `quantizeNetPosition` (1 mm), `quantizeNetVelocity` (1 mm/s),
  `quantizeNetAngularVelocity` and `quantizeNetRotation` (5 decimals), for network payloads.
- core: `Qtrn.normalize`.
- multiplayer: everything on the wire is in global coordinates. `Network3dController` sends heartbeat
  positions (zoning cells, distance arbitration, takeover elections) and spawn descriptors'
  `position`/`rotation` globally; received state stays global until it is applied, through the
  world's frame as it is then. Peers whose worlds have different frames share entities at the same
  global pose.
- core, three: a shader-drawn sky, `ProceduralSky3dOpts` (`{ type: 'PROCEDURAL', timeOfDay, haze,
  clouds: { coverage, density, scale, wind }, stars, moon, ... }`), accepted by
  `setEnvironment({ background, environmentMap })` and the `"Environment"` level class. Every
  setting can change at any time; `clouds.coverage: 1` gives a full overcast, and an optional
  `cirrus: { coverage, density, scale, wind }` layer adds high streaks above the clouds. `mode: 'DYNAMIC'`
  (default) draws it every frame with drifting clouds, `'BAKED'` draws it into a cube texture only
  when a setting changes. As `environmentMap` it lights `'standart'` and PBR materials.
  `proceduralSkyBodies(sky)` returns the sun and moon directions and the sunlight's color and
  intensity, to drive a directional light. Its settings are global: after a frame switch with a
  yaw the sky stays in place. New example `3d/sky` with sliders for every setting
  and a free camera.
- core: `DirectionInput.pressDirection`/`releaseDirection(direction, holder)` hold a direction the
  way its key does, for an on-screen button or anything else that is either pushed or not: it is
  part of `output$`, and `oppositeKeys` decides it together with the keys. Analog contributions
  (`setAnalogDirection`: sticks, tilt, a gamepad) are still summed.
- mobile-controls: `TouchButton.bindDirection` takes a direction name (`'left'`) to hold that
  direction, besides an `AnalogDirection` to push.
- core: `IInput.running$` reports every input's running state on start and stop.
- core: `DirectionHeldOutput`, the type of `DirectionInput.output$`; `DirectionKeyboardOutput` is
  its deprecated alias.
- core: the level JSON `"Trigger"` class (2D and 3D) takes `shape` and the same shape fields as
  `"Primitive"` - `"COMPOUND"` with `children`, `"SPHERE"`, `"CYLINDER"`, ... `shape` defaults to
  `"BOX"` with `dimensions`, so existing levels load unchanged. `serializeEntity` reconstructs a
  trigger of any shape, a compound one included.
- core: `warnIfMeshTrigger`, `shapeHasMesh` and `shapeContains(shape, kinds)` (whether a shape is,
  or nests in a `COMPOUND`, any of the given kinds). Creating a trigger whose shape contains a `MESH`
  (ammo, rapier3d) logs a one-time warning: a triangle mesh is a surface, so such a trigger does not
  fire for a body fully inside it. Use `CONVEX_HULL` or a `COMPOUND` of convex shapes for a volume.
  ammo adds a warning for a trigger containing a `MESH` or `PLANE`: it reports a `MESH` or `PLANE`
  body whenever their bounding boxes overlap, since Bullet cannot test two concave shapes.

### Changed
- core, multiplayer: network state is quantised: `RigidBodyCorrection.capture`/`MoverCorrection.capture`
  round positions to 1 mm, velocities to 1 mm/s and quaternion components to 5 decimals, and the
  correction helpers normalize the received rotation. Heartbeat positions and spawn descriptors'
  `position`/`rotation` are rounded the same way. A spawn descriptor's received rotation is
  normalized too, and the unit-scaled default `deadzone` stays at least 2 mm, above the rounding.
- multiplayer: `PeerInfo.position` (`peers$`, `netStats().peers`) is the peer's heartbeat position
  as sent: global and rounded to 1 mm. In a 3D world with a frame, `world.toLocalPoint` places it.
- core: `DirectionInput.output$` emits only when the resolved output changes - not on starting the
  input, on a key or press that leaves it as it was, or on a stop with nothing resolved.

### Fixed
- mobile-controls: the car layout's accelerate/brake and steering buttons, and the 2D character
  layout's move buttons, hold their direction instead of pushing an analog one, so both held
  follow the controller's `oppositeKeys` the way the keys do - with `{ upDown: 'down' }` the pedal
  buttons brake, where they used to cancel each other out. The pedal and steering sticks stay
  analog.
- mobile-controls: a `TouchButton`, `TouchStick` or `TouchDPad` bound to a `DirectionInput` that
  stops and starts again while the control is held pushes its direction again, instead of staying
  pressed without effect until the finger lifts.
- core: `DirectionInput.pressDirection` ignores, with a warning, a name that is not a direction.
- ammo: a trigger fires only for a body whose shape overlaps it (touching or fully inside), not
  for one merely inside its bounding box. A box trigger rotated about Z fired for bodies in the
  corners of its bounding box, and a compound trigger anywhere in its children's bounding boxes.
  The test reuses the physics step's own contact results, so it adds no per-tick cost for bodies
  that are not moving.
- rapier2d, rapier3d: a compound trigger, or a compound body entering a trigger, fires
  `onEntityEntered` and `onEntityLeft` once per body, not once per touching part.
- rapier2d, rapier3d: a nested `COMPOUND` child's offset turns with its parent's `rotation`; it
  used to be added unrotated, placing the collider in the wrong spot.
- rapier2d, rapier3d: a body removed from the world while inside a trigger fires `onEntityLeft`,
  and if re-added it enters again. A trigger no longer stays activated with `onEntityLeft` never
  firing after such a body is re-added while another collider took its freed slot, and collision
  and trigger events of a removed collider no longer reach a body created after it.
- matter: a compound trigger fires for bodies inside its parts, and a compound body entering a
  trigger is reported; both used to be missed. Each body enters and leaves once, a sleeping,
  kinematic or character body in the notch of a concave compound trigger is not reported, and a
  body removed and re-added in one tick enters again.
- core: `serializeEntity` reconstructs a `"Primitive"` of any shape - `COMPOUND`, `CONVEX_HULL`,
  `MESH`, and in 2D `CAPSULE` and `POLYGON` - from its live body, instead of falling back to its
  spawn record or returning `undefined`.
- core: an app class whose generator builds a plain `Entity3d`/`Entity2d` with a body, a plain
  `Trigger3dEntity`/`Trigger2dEntity` or a plain `Light3dEntity` serializes as that class with its
  own `config`, not as a `"Primitive"`, `"Trigger"` or `"Light"` that lost the class and its model.
  The same holds for live serializers an app registers with `registerLiveSerializer`.
- core: `loadGgGlb` applies its `rotation` in front of each loaded object's own rotation and each
  prop dummy's rotation. A loaded object whose own rotation did not commute with the load
  rotation (for example a tilted object under a yawed load), and a nested prop whose dummy and
  object rotations did not commute, even under an identity load rotation, ended up wrongly
  oriented.

## [0.0.88] - 2026-10-25

### Added
- Examples: a prompt-to-level demo (`examples/3d/prompt-to-level`). It plays an obstacle course an
  agent wrote as level JSON from the prompt shown beside it, lists the one fix the draft needed,
  and loads any level JSON pasted into the page.
- core: `DirectionInput` takes `options.oppositeKeys` (`DirectionOppositeKeys`, per axis
  `'cancel'`/`'up'`/`'down'` and `'cancel'`/`'left'`/`'right'`): what both opposite direction keys
  held give, in `direction$` and `output$` alike. `'cancel'` (neither direction) stays the default;
  the `oppositeKeys` property changes it while the input runs. `CarHandlingController` and
  `GgCarHandlingController` pass on an `oppositeKeys` option, e.g. `{ upDown: 'down' }` for a brake
  that overrides the throttle. Keys only: gamepad and on-screen directions are summed as before.

### Fixed
- pixi: a renderer no longer draws while its WebGL context is lost (`render()` returns early, a
  WebGPU renderer keeps drawing). Drawing then compiled pixi's shader programs without uniforms
  ("Could not retrieve shader source (WebGL context may be lost)"), and once the context came back
  the uniform sync functions pixi keeps across the restore threw on every frame (`Cannot read
  properties of undefined (reading 'value')` / `(reading 'location')`), seen on Opera Mobile for
  Android.

## [0.0.87] - 2026-10-22

### Added
- audio: an audio scene can run on an existing `AudioContext`:
  `new WebAudioScene3dComponent({ context })` (and `WebAudioScene2dComponent`) builds the scene's
  graph on it without owning it (`ownsContext` is `false`). Scenes on one context leave each other
  playing: while more than one is on it, `setPaused` pauses only the scene's own sources instead of
  suspending the context (playing sources stop where they are and continue on resume, a source
  played while paused starts on resume, timed fades hold), and the owner's `dispose()` hands the
  context to another scene on it instead of closing it - the last one closes it. Only the owner
  binds autoplay gesture listeners. A disposed scene's idle sources never play again. A context the
  app created and passed in is never suspended, resumed or closed by a scene. Volumes, buses,
  reverbs and the voice budget stay per scene. Meant for building every world's scene on an app's long-lived menu scene's context:
  iOS starts a new context on its own only shortly after a tap, so a world created after a long
  load stayed silent until the next tap, and suspending or closing a second context disturbed the
  first one's audio there.

### Fixed
- audio: a voice budget (`maxVoices`, also set by `applyMobileAudioDefaults` on touch devices) now
  works on a scene no world updates, such as a menu scene with `MusicPlayer` and `playOneShot`.
  Such a scene never re-ranked its voices, so once more sources played than the budget allowed,
  the outranked ones stayed virtual for good (virtual one-shots never ended or got disposed) and
  every later sound and music track started virtual: the scene went silent. While any source is
  virtual and no `update()` comes, the scene now does its voice bookkeeping itself every 50 ms
  (`VOICE_UPKEEP_INTERVAL_MS`); while a world updates it, it only checks every 250 ms
  (`VOICE_UPKEEP_WATCH_MS`) that the world still does.
- audio: a scene whose `AudioContext` was created without a user gesture (a world created while a
  level loads) now starts on the next gesture on iOS too. The scene only listened while the
  context was `'suspended'` (WebKit reports one it holds back as `'interrupted'`, and iOS
  interrupts running contexts later), with bubbling listeners that touches on
  `@gg-web-engine/mobile-controls` never reached (they stop propagation), and only once, so a
  gesture while paused or one iOS does not accept for audio (`pointerdown`) used them up: every
  sound stayed silent until WebKit started the context by chance. For its whole life, the scene now
  listens in the capture phase for `pointerdown`, `pointerup`, `touchend`, `click` and `keydown`
  (`RESUME_GESTURE_EVENTS`); each one finding the context neither running nor closed while the
  scene is not paused resumes it and starts a silent one-sample buffer within the gesture. A
  context the app suspended itself (`context.suspend()`) is left suspended until the app's own
  `context.resume()` - neither a gesture nor the end of a pause resumes it. The scene no longer
  sets `context.onstatechange`.

## [0.0.86] - 2026-10-22


### Added
- 2D cameras have an `origin` (`Camera2dOrigin`: `'center'`, the default, or `'top-left'`).
  With `'top-left'` the camera's `position` is the view's top-left corner, and the view zooms and
  rotates around it, so a camera at `{ x: 0, y: 0 }` makes world coordinates canvas pixels (y
  down). This is for a HUD or menu drawn by a physics-less `Gg2dWorld` on a transparent renderer
  over another canvas. It can be changed at any time; pixi reads it on every frame.
- Pixi: `PixiRendererComponent.initialized$` emits once pixi's asynchronous `Application.init`
  has finished, also to a later subscriber, and completes without emitting when the renderer is
  disposed first. `initialized` reads the same as a flag. Wait for it before using
  `application.renderer` directly.
- `RendererOptions.forceResolution` takes an `Observable<number>` as well as a number: every value
  it emits while the renderer is in a world is applied in place through the new
  `IRendererComponent.setResolution(resolution)`, keeping the CSS size - for a game's resolution or
  quality setting. Three resizes the post-processing composer of a `ThreeComposerRendererComponent`
  along with the renderer; Pixi applies a change made before its async init once init is done.
  Until the observable's first value the device resolution is used.
- `measureViewport()` and `viewportSize$(remeasureDelay?)`: the page's visible area as a
  `'fullscreen'` renderer measures it, for app code laying out its own DOM around the game.
- `IDisplayObject3dComponent.makeUnique(resources?)`: gives a display object its own copies of the
  materials (`'materials'`, the default), also the geometry (`'meshes'`) or also the textures
  (`'all'`, `UniqueResources3d`) it shares with other copies of the same model, so one copy can be
  recolored, re-textured or have its geometry edited without changing the others. A resource used
  several times within the object maps to one copy, calling it again with the same or a lower
  level does nothing, and `dispose()` frees exactly the copies it made, never the cached original's
  resources - disposing the original does not touch them either. On three, a skinned mesh keeps its
  skinning attributes, morph targets and skeleton binding, and `resourceOwnership` gains a
  `'materials'` level (`ThreeResourceOwnership`).
- `unique` option of `world.loader.loadModel` (`LoadModelOptions`) and `world.loader.loadGgGlb`
  (`LoadOptions`, props included): calls `makeUnique` on the returned copies. It is not part of the
  cache key, so unique and shared loads of one file still parse it once.
- Mobile controls: `car.pedals: 'stick'` replaces the accelerate and brake buttons of the car layout
  with one analog stick (`'pedal-stick'`, up for throttle, down for brake).
- Mobile controls: `car.keys` (`{ handbrake?, gearUp?, gearDown? }`, or a function of the
  controller called each time the layout is built) gives a bare `CarHandlingController` handbrake
  and gear buttons pressing those keys on its `keyboard`, for a game whose own entity drives the
  vehicle's handbrake and gearbox. `GgCarHandlingController`'s buttons keep pressing its own keys.
- Mobile controls: `MobileControlsOptions.inset` (and `MobileControls.inset`) moves every control
  placed by numbers away from or towards the overlay's edges, in placement units, per edge or for
  all four; also settable from CSS as `--gg-mc-inset-left`/`-right`/`-top`/`-bottom`.
- Mobile controls: `pauseButton` and `fullscreenButton` options (`MobileControls.pauseButton`/
  `fullscreenButton`). The pause button pauses the world and resumes it on the next press (never a
  world whose `localPauseAllowed` is `false`), or runs the app's `onPress` instead; the fullscreen
  button toggles fullscreen of the overlay's container and is hidden where fullscreen is not
  available. New icons `pause`, `resume`, `fullscreen`, `exitFullscreen` in `MobileControlsIcons`.
- Mobile controls: `toggleFullscreen(element?)`, `isFullscreenAvailable(element?)`,
  `fullscreenElement()`, `isFullscreen()` and `fullscreen$()`, covering the standard and the
  WebKit-prefixed Fullscreen API; `toggleFullscreen` never throws or rejects and resolves `false`
  where fullscreen is unavailable (an iPhone) or refused.
- Mobile controls: `TouchButton.onTap(callback)`, called inside the `pointerup` of the finger
  lifting (not on a reset or a cancelled pointer) - the moment a browser grants a touch the user
  gesture that fullscreen and similar APIs need.
- Mobile controls: `MobileControlsOptions.visible$` gates the overlay by an observable (hidden until
  it first emits `true`), releasing everything held when it turns `false`.
- Mobile controls: `mergeControlPlacement(defaults, custom)`, the edge-by-edge placement merge the
  built-in layouts apply to `placements`.
- Particle sprite anchors: `ParticleSimulationOptions.anchor` (live) is the point of every sprite
  that sits at the particle's position and that a rotating sprite turns around, in fractions of the
  sprite as its image shows it (`{ x: 0.5, y: 0.5 }`, the center, by default; `{ x: 0.5, y: 1 }`
  stands smoke, dust, grass or a flame on its base). `ParticleFrame.anchor` overrides it per atlas
  frame, so sprites with different pivots share one atlas and a frame sequence can move the pivot;
  `ParticleFrames.fromPixels` takes a region's anchor in pixels. Drawn by `@gg-web-engine/three`
  (camera-facing and vertical billboards) and `@gg-web-engine/pixi`. `ParticleRenderBuffers` has a
  new `anchor` array (2 floats per particle) that a rendering adapter's particle system reads.
- `@gg-web-engine/three`: `extendThreeParticleVertexShader(material, { declarations?, mainEnd? })`
  inserts an app's own GLSL into the particle material's vertex shader at the stable markers of
  `THREE_PARTICLE_VERTEX_HOOKS` (file scope, and the end of `main()` with `gl_Position`, `mvPosition`
  and `corner` in scope), for use from the `material` option instead of matching the shader's text.
- `IAudioSourceComponent.fadeTo(volume, durationMs): Promise<boolean>`: a timed volume fade (menu
  music fading out, a crossfade) on the audio clock. `volume` reads back the target at once; the
  fade holds while the world is paused or audio is not yet allowed to start, keeps running through
  `stop()`/`play()` and while the source is virtual, and resolves `true` when it reaches the
  target or `false` when a `volume` write, another `fadeTo` or `dispose()` takes over. The voice
  budget ranks a fading source by the level it is heard at.
- `IAudioSceneComponent.playOneShot(descriptor)`: plays a clip once, non-positional, on a bus, and
  disposes the source when it ends - for UI sounds on a scene with no world or entity.
  `AudioOneShotDescriptor` is its descriptor type and `playAudioOneShot(factory, descriptor)`
  implements it over any adapter's factory.
- `MusicPlayer` (core, works with any audio adapter and needs no world): plays a playlist on the
  `"music"` bus with crossfades on `play`/`next`/`stop`, optional shuffle that never repeats a
  track back to back, repeat, per-track volume and loop region, and `nowPlaying$`. A track that
  fails to load is skipped.
- `MOBILE_AUDIO_DEFAULTS` and `applyMobileAudioDefaults(scene, mobile?)`: on a touch device
  (`MouseInput.isTouchDevice()` unless the app passes its own answer), a 16-voice budget and
  `'equalpower'` panning for new 3D sources.
- `RaycastVehicle3dEntity.impact$`: one `RaycastVehicleImpact` each time the chassis begins touching
  another rigid body, with the other body and its entity, contact point and normal, the adapter's
  impulse, and `speed`, the approach speed along the normal from the velocities before the step
  that resolved the hit (the chassis spin at the contact point included, and the other vehicle's
  own pre-step velocity for a hit between two raycast vehicles). A hit between two vehicles is
  reported by both with the same speed, the second one flagged `mirrored`, so a pair-wide effect
  (one crash sound) skips it while per-car damage takes both. Works on Ammo and Rapier.
- `RaycastVehicle3dEntity.airborne$`, `landed$` and `isAirborne`: the vehicle is airborne once
  every wheel has been off the ground for `airborneDelay` ms of world time (default 250, so a bump
  doesn't count); `landed$` reports the speed the chassis came down at along the ground normal and
  the time spent in the air. `resetTo` ends the airborne state without a landing.
- `IEntity.whileSpawned(source)` and `IEntity.onTick(handler)` (protected): an observable that ends
  the next time the entity is removed from its world, and a `tick$` subscription built on it. Called
  from `onSpawned`, they subscribe once per spawn however often the entity is removed and added
  again - the `tick$.pipe(takeUntil(this._onRemoved$)).subscribe(...)` pattern in one call.
- `GgWorld.getOrAddEntity(name, factory, type?)`: the entity named `name` in the world, built by
  `factory`, named and added on the first call - a per-world singleton (one skid-mark mesh, one
  particle pool shared by every car) without an app-side `WeakMap<world, entity>`. With `type`, an
  existing entity of another class throws instead of being returned.
- `loadCubeTexture` takes `filter` (`'linear'`/`'nearest'`), like `loadTexture`: on
  `world.loader.loadCubeTexture(faces, { filter })` (cached per faces and filter), on the 3D
  loader interface (`loadCubeTexture`/`cubeTextureFromData`, optional parameter) and in
  `@gg-web-engine/three`. A `cubeTexture` `AssetRef` takes `options` for `preload`.
- `IDisplayObjectComponent.getLocalBoundings()`: bounds of a display object and its children in
  the object's own frame (as if its position were the origin, rotation identity and scale 1), for
  measuring a model along its own axes (a car's footprint) once it has been turned. Implemented by
  `@gg-web-engine/three` and `@gg-web-engine/pixi`; nested children hidden with `visible = false`
  are left out.
- `RaycastVehicle3dEntity.createWheelEntity(options, index)` (protected): builds the entity
  shown at each wheel (the default clones `display.displayObject`), for a subclass supplying its
  own wheel entities - the vehicle names, adopts and moves them as before. `RVEntityWheelFullOptions`
  and `RVEntityWheelEntity` type its parameter and result.
- `replaceCanvas(canvas)`: puts a blank copy of a canvas (same id, classes, attributes, inline
  style) in its place in the page and returns it. A disposed renderer releases its canvas's WebGL
  context for good, so an app that keeps one `<canvas>` for world after world calls this before
  adding the next world's renderer.
- Multiplayer: a room directory and lobby above signaling. `RoomDirectory` lists rooms (`rooms$`:
  name, capacity, member count, metadata, `started`, `joinable`) and creates or joins one, one
  operation at a time with a fresh peer id per join; the `Lobby` it returns has the members
  (`members$`), the host (`host$`/`isHost$`: the senior member, the next one when it leaves), the
  host-written shared state (`state$`/`setState`), each member's own data (`setMemberData`), a match
  that locks the roster and closes the room to joins (`startMatch`/`endMatch`/`match$`), a ready
  barrier (`setReady`/`readiness`/`waitForReady`), a start time on the backend's clock
  (`serverNow`/`scheduleStart`/`startsAt$`), results written once per round (`writeResult`/
  `results$`) and `closed$` (`'left'`/`'lost'`). Backends: `FirebaseLobbyBackend` (Realtime Database
  under `gg-lobby`, capacity enforced by seat transactions, members removed on disconnect - deploy
  the updated `firebase/database.rules.json`) and `BroadcastChannelLobbyBackend` (tabs of one
  browser); `ILobbyBackend` for others.
- `NetworkController.waitForPeers(peersOrCount, timeoutMs)`: resolves `true` once the links to the
  given peers (or that many) are open, `false` on timeout or when the session ends.
- `resolveFirebaseApp`/`signInToFirebase` and `FirebaseConnectionOptions`, shared by
  `FirebaseSignaling` and `FirebaseLobbyBackend`; App Check is initialized once per Firebase app.

### Changed
- **Breaking** (custom 2D visual adapters only): `ICamera2dComponent` has a new required `origin`
  property, which the adapter's renderer must honor. Apps using `@gg-web-engine/pixi` need no
  change.
- **Breaking** (custom visual adapters only): `IRendererComponent` has a new abstract method,
  `setResolution(resolution)`. A third-party renderer component no longer compiles until it adds
  one; start from the protected `initialResolution` instead of reading `forceResolution`, which can
  now be an observable. Apps using `@gg-web-engine/three` or `@gg-web-engine/pixi` need no change.
- A `'fullscreen'` renderer (and the function form of `size`) measures the page through
  `window.visualViewport` where available (falling back to `innerWidth`/`innerHeight`), ignores a
  pinch zoom, and measures again 300 ms after an `orientationchange`, so an iOS home-screen app no
  longer keeps the size from before a rotation.
- **Breaking** (custom visual adapters only): `IDisplayObject3dComponent` (and so
  `ICamera3dComponent`) has a new required method, `makeUnique(resources?)`. A third-party 3D
  display object implementation no longer compiles until it adds one (a no-op is correct for an
  object that never shares resources). Apps using `@gg-web-engine/three` need no change.
- Mobile controls: over a stick (`steering: 'stick'` for the gear buttons, `pedals: 'stick'` for
  the handbrake) the car layout's small buttons sit at `bottom: 20` instead of 16, clear of the
  stick.
- **Breaking** (custom audio adapters only): `IAudioSourceComponent` has a new required method,
  `fadeTo`, and `IAudioSceneComponent` a new required method, `playOneShot`. A third-party audio
  adapter no longer compiles until it adds both; `playOneShot` can delegate to
  `playAudioOneShot(this.factory, descriptor)`. Apps using `@gg-web-engine/audio` need no change.
- `@gg-web-engine/ammo`: `AmmoRaycastVehicleComponent` adds and removes its chassis' native body
  itself, so the vehicle is the one component of that body in the world - `children`,
  `added$`/`removed$`, collision and trigger events only ever name the vehicle. The `chassisBody`
  component it was created from is never added to the world any more (forces applied to it are
  ignored); use the vehicle component instead.
- **Breaking** (custom visual adapters only): `IDisplayObjectComponent` has a new required method,
  `getLocalBoundings()`. A third-party rendering adapter no longer compiles until its display
  objects implement it. Apps using `@gg-web-engine/three` or `@gg-web-engine/pixi` need no change.
- `addRenderer` (2D and 3D worlds) throws, naming `replaceCanvas`, when given a canvas whose
  previous renderer was disposed (removed with `dispose`, or with its world). Such a canvas has no
  usable WebGL context left; before, the new renderer failed later in an adapter-specific way.
- `@gg-web-engine/pixi`: disposing a renderer leaves a canvas the app passed in its place in the
  page (pixi still releases its WebGL context); only a canvas pixi created itself is removed.

### Fixed
- Pixi: a number `forceResolution` other than 1 no longer changes the canvas's size on the page;
  the canvas keeps the renderer's CSS size at any resolution (`autoDensity` is always on, as it was
  without `forceResolution`).
- Ammo: a rigid body removed or disposed from an `onCollisionStart` subscriber no longer makes the
  rest of that step's collision events (the other body's own event among them) read freed native
  memory, which gave garbage contact data and could corrupt the WASM heap.
- Ammo: `Trigger3dEntity.onEntityLeft` emitted `null` instead of the vehicle entity for a raycast
  vehicle (a `GgCarEntity`'s) removed from the world while inside the trigger.
- Ammo: disposing a body, trigger, character controller or raycast vehicle component a second time
  (directly, or after `removeFromWorld(world, true)`) freed its native objects again; it does nothing.
- Ammo: every raycast vehicle leaked a native `btVehicleTuning`; vehicles share one.
- `@gg-web-engine/rapier3d`: a `COMPOUND` body touching another body with several of its parts got
  one `onCollisionStart` per part, and an `onCollisionEnd` whenever one part let go while another
  still touched. Both now fire once per body pair (`Rapier3dRigidBodyComponent.collidingWith` maps
  each partner to its number of touching collider pairs).

## [0.0.85] - 2026-10-21

### Added
- `IRaycastVehicleComponent.getWheelContact(wheelIndex)`: where and how a wheel touches the ground
  after the last physics step, as a `WheelContact` with the contact point, ground normal, steered
  axle, the chassis velocity at the contact point and its sideways part (`sideSlipSpeed`, m/s), the
  suspension force in Newtons and `skid` (Bullet's share of the needed grip the tyre gave; `null`
  on Rapier, which does not report it). `null` while the wheel is in the air, and after a reset
  (`resetSuspension`, `resetMotion`, `RaycastVehicle3dEntity.resetTo`) until the next step. Tyre
  marks, squeal, smoke and grip assists can read this on Ammo and Rapier instead of reaching into
  `btRaycastVehicle`'s wheel info.
- `buildWheelContact(...)`: builds a `WheelContact` from what a physics engine reports for one
  wheel, for an adapter implementing `getWheelContact`.
- `AudioListenerBasis` (`'camera'` | `'body'`): which local axes of the 3D audio listener's rotation
  are its forward and up. `IAudioScene3dComponent.setActiveListener(target, basis?)` takes one and
  `activeListenerBasis` reads it back; without one, a camera (`Camera3dEntity`, or a camera
  component) is read as `'camera'` (forward local -Z, up local +Y) and anything else as `'body'`
  (forward local +Y, up local +Z), so a listener bound to a player or vehicle entity faces the way
  that entity does. `AUDIO_LISTENER_AXES` and `defaultAudioListenerBasis` expose the same rules to
  audio adapters.

### Changed
- **Breaking** (custom physics adapters only): `IRaycastVehicleComponent` has a new required
  method, `getWheelContact(wheelIndex)`. A third-party adapter implementing the interface no
  longer compiles until it adds one; build the result with `buildWheelContact` so its derived
  fields match the built-in adapters. Apps using `@gg-web-engine/ammo` or
  `@gg-web-engine/rapier3d` need no change.
- Raycast vehicles (Ammo and Rapier): `isWheelTouchesGround` reports `false` after
  `resetSuspension()` (so after `resetMotion()`, `RaycastVehicle3dEntity.resetTo` and a network
  snap) until the next physics step, instead of the ground under the pose the car was reset from.
- **Breaking** (subclasses of `AmmoRaycastVehicleComponent` only):
  `applyBrakeImpulses(subStepLength)` is now `prepareStep`; it also records the steering each step
  uses. `AmmoWorldComponent.simulate()` calls `prepareStep`, so an override of
  `applyBrakeImpulses` is no longer called: override `prepareStep` instead and call `super`.
- **Breaking** (custom audio adapters only): `IAudioScene3dComponent` has a new required
  `activeListenerBasis` property and its `setActiveListener` takes an optional `basis`. Apps using
  `@gg-web-engine/audio` need no change.
- Audio: a 3D source's directional cone points along its local +Y, a body's forward, instead of
  local -Z. A source with the identity rotation, or riding an upright car or character, aims level
  the way it faces; it used to aim at the ground. A cone source given a rotation to aim it along
  local -Z needs that rotation changed.

### Fixed
- Rapier: a raycast vehicle's wheels (`getWheelTransform`) were drawn where the chassis was before
  the last physics substep, behind the car by its speed × the substep length (up to 0.3 m at
  30 m/s).
- Rapier: a raycast vehicle removed from the world and added back lost its wheels' steering.
- Ammo: `isWheelTouchesGround` kept reporting the last step's ground contact after the vehicle was
  removed from the world, and after it was added back until the next step; it reports `false`, as
  on Rapier.
- Ammo: a raycast vehicle's wheel methods (`setSteering`, `applyEngineForce`,
  `setWheelFrictionSlip`, `getWheelFrictionSlip`, `isWheelTouchesGround`) given an index past its
  wheels read and wrote WASM memory outside the wheel array; they ignore it, as on Rapier.
- Ammo: `isWheelTouchesGround` on a raycast vehicle disposed without being removed from the world
  first read the freed native vehicle; it reports `false`.
- Rapier: after a reset (`resetSuspension`, `resetMotion`, `RaycastVehicle3dEntity.resetTo`) a
  raycast vehicle's wheels were drawn compressed as on the ground the car was reset from until the
  next step; they hang at their suspension rest length, as on Ammo.
- `GamepadInput.controlPushed$` no longer reports a trigger axis returning to its rest as a push
  of the axis's other direction: rebinding two actions one after another on a trigger reported as
  an axis (an XInput pad without the standard mapping) bound the second to the trigger's release.
  Where each axis rests is learned per gamepad when the browser lists it (the standard mapping's
  sticks always rest at 0) and learned again when it is plugged in again; sticks and a shared
  axis resting at 0 still report both directions. `inUse` no longer turns on when such an axis
  returns to its rest.
- `GamepadInput.controlPushed$` no longer reports a control held through a restart of the input
  (the world's `inputEnabled` off and on for a menu), or held when a new input starts, as pushed:
  a controls menu opened while the gas trigger is held doesn't capture it. A gamepad seen for the
  first time still reports the press the browser listed it for.
- Audio: the 3D scene's listener up vector was the active listener's local +Z, the exact opposite
  of its forward (local -Z), so the listener had no left/right: positional sources panned
  meaninglessly, and on iOS Safari every positional source played as broken, pitch-garbled audio.
  Up is the listener's local +Y, the camera convention.
- Audio: the 3D listener no longer eases through a degenerate orientation on a turn of more than
  90° in one tick (a camera cut, a snap turn) or a switch to another listener. Easing each
  component on its own took forward and up through near-zero length on the way, which on iOS
  Safari garbled every positional source for the length of the ramp; such a turn, and a new
  listener's position, now apply at once.
- Audio: in Firefox and older Safari, which have no `AudioParam`-based listener, the 3D listener
  snapped to the camera every tick, which can be heard as zipper noise on a moving camera. It eases
  in the same way it does in other browsers.

## [0.0.84] - 2026-10-19

### Added
- `MapGraph3dEntity.prepareChunk(node, loaded, entities, signal)`: an overridable hook awaited
  after a chunk's GLB loads and before the chunk is added to the world, for per-chunk work such as
  shared materials or loading props. The extra entities it returns are added with the chunk and
  removed and disposed when it unloads. The chunk stays "loading" until the hook resolves, so it
  can't be unloaded meanwhile; if the map graph leaves the world or the hook throws, the chunk and
  the extras are disposed. Use it instead of overriding `loadChunk` and awaiting after
  `super.loadChunk(node)`: such an override could put a chunk back into `loaded` after it had
  already been unloaded, leaving an entry without its terrain that never loaded again (or a second
  copy of the chunk).
- Custom key codes in direction keymaps: `DirectionKeymap` (every built-in input controller's
  `keymap` option) also takes `{ up, down, left, right }`, each a `KeyboardEvent.code` or a list
  of them, and `DirectionInput.keymap` can be assigned while the input runs to rebind the keys at
  once. `directionKeyCodes(keymap)` lists the codes a keymap stands for.
- Rebinding controls while the game runs: `setKeys(partial)` and `setGamepad(partial | null)` on
  `PlayerCharacterController`, `PlayerCharacterController2d`, `CarHandlingController`,
  `GgCarHandlingController`, `FreeCameraController` and `ObjectGrabController` write the given
  keys or gamepad controls to `options` and rebind them at once (`null` turns the gamepad off). A
  control already held when it is assigned (the button a controls menu just captured) counts from
  its next push. `bindingsChanged$` (`IRebindableController`, `isRebindableController`) emits
  `'keys'` or `'gamepad'` after either. `followKey`, `followGamepadKey`, `followGamepadPressed`
  and `followGamepadDirection` do the same for an app's own actions, and
  `GamepadInput.released$(controls)` tells when controls are read released.
- Choosing which gamepad drives: `GamepadInput.choice` (`{ id, nth }`, plain data to save) is read
  by every `GamepadInput` without a `gamepadIndex` of its own and finds the same device again
  after a reconnect or a reload. `connectedGamepads()`, `selectedGamepad()`, `chooseNext(step)`,
  `choiceOf(gamepad)`, `gamepadName(gamepad)` and `choice$` are there for a controls menu.
- `FreeCameraController` options `upDownKeys` (`['KeyE', 'KeyQ']`), `zoomOutInKeys`
  (`['KeyZ', 'KeyC']`) and `boostKey` (`'ShiftLeft'`) for the keys it had built in.
- `@gg-web-engine/mobile-controls`: a shown layout is rebuilt when its controller reports a
  `'keys'` change, so its buttons press the new keys, once no finger is on it.
- Helpers for a controls menu on `KeyboardInput`: `keyName(code)` gives a short label ("W",
  "Left", "Num 8", "L Shift") in the player's keyboard layout where the browser reports it
  (`loadKeyboardLayout()`, Chromium), and `isBindable(code)` rejects keys the browser or OS keeps
  for itself (Tab, Escape, function keys, Ctrl/Alt/Meta, lock and media keys).
- Gamepad menu navigation for screens: `Screen.bindGamepadKeys(keys = GAMEPAD_MENU_KEYS)` has the
  gamepad press keys of the screen's `keyboard` while the screen is on top (d-pad or left stick as
  the arrows, repeating while held, A as Enter, B as Escape), only for a button pushed while the
  screen is on top. A game screen binds only its pause key (`this.bindGamepadKeys({ Escape: 'b9' })`).
  `ScreenManager.gamepadInput` is the input it reads. `GamepadInput.bindKeys` takes the options
  behind it: `edge` (press like a real key) and `repeat`/`repeatDelay`/`repeatInterval`.
  `KeyboardInput.isHeldBy(code, holder)` tells whether an emulated hold is still in place.

### Changed
- With no `gamepadIndex` and no `GamepadInput.choice`, a `GamepadInput` keeps reading the gamepad
  in use (a button pressed or an axis moved on it) while it stays connected, so a gamepad listed
  later doesn't take over mid-game. Before that it reads the first gamepad with a button pressed,
  else the first with the standard mapping, else the first connected one: some keyboards and wheel
  pedals list themselves as gamepads and could come first. All running `GamepadInput`s share one
  `navigator.getGamepads()` read per frame.
- `CarHandlingController` and `GgCarHandlingController` keep a copy of the options object passed to
  them as `options`, instead of that object itself, with `options.gamepad` holding the default
  binding when it was left out.
- `DirectionInput.output$` emits `{}` when the input stops, as it does when its keys are rebound:
  nothing is held any more.
- `MapGraph3dEntity` drops queued chunks that left the load window before their turn to load,
  instead of loading them only to unload them right after (a device loading chunks slower than
  the cursor moves).

### Fixed
- `GamepadInput.controlPushed$` no longer reports the controls already held on a gamepad it
  switched to (another choice) as pushed, so a controls menu capturing a control doesn't take
  them. A gamepad read after none was (the first ever, or one plugged back in) still reports
  them: the browser lists it because of that very press.
- `@gg-web-engine/pixi`: a display object built without a name no longer reports pixi.js's
  class-name default `label` ("Graphics", "Sprite", ...) as its `name`. Since 0.0.83 an `Entity2d`
  built around such an object adopted that label as its world-unique entity name, so adding a
  second unnamed primitive of the same kind to a world failed with
  `Cannot add entity - name "Graphics" is already in use`.
- `@gg-web-engine/three`: a display object built without a name reports an empty `name` instead
  of the mesh's `uuid`, so an `Entity3d` built around an unnamed mesh keeps its readable
  `Entity3d_N` default name rather than adopting a generated id.

## [0.0.83] - 2026-10-17

### Added
- Gamepad input. Every world has a `gamepadInput` (`GamepadInput`, started and stopped with
  `inputEnabled`) that polls the Gamepad API on every frame, also while the world is paused, and
  reports controls by index (`'b7'`, `'a0-'`): `value$`/`pressed$`/`direction$`, `connected$`,
  `inUse$` (gamepad used more recently than keyboard or mouse), `controlPushed$` for a controls menu
  capturing a binding, `bindKeys(keyboard, { Space: 'b0' })` to hold keys while buttons are pressed
  and `bindDirection(directionInput, binding)` to add a stick or the d-pad to a direction input.
  The built-in input controllers (`CarHandlingController`, `GgCarHandlingController`,
  `PlayerCharacterController`, `PlayerCharacterController2d`, `FreeCameraController`,
  `ObjectGrabController`) are driven by the world's gamepad out of the box with standard-mapping
  defaults (left stick or d-pad moves/steers, triggers are the pedals, bumpers shift, right stick
  looks, A jumps, ...), each through a new `gamepad` option taking a custom binding or `null` to
  leave the gamepad alone. `CarHandlingControllerOptions.keymap` accepts `null` for a car driven
  by analog sources only.
- Examples: two small complete single-player games built on the screens API, each with a title
  screen, pause, a win screen, game over, three lives, checkpoints and particle effects.
  `examples/3d/tower-climb` is a third-person climb up floating pads to light a beacon (Ammo or
  Rapier); `examples/2d/platformer` is a side-scrolling run past spikes, pits and slimes to a goal
  flag (Rapier or Matter).
- Examples: a car race demo (`examples/3d/car-race`), a complete serverless multiplayer game on
  Rapier or Ammo. Everyone who opens the room link races on one shared track: a countdown on the
  grid, three laps through every checkpoint in order, lap times and results, then the next race.
  Alone, Enter starts a time trial.
- Starter templates under `templates/`: `3d-character` (Three.js + Rapier), `2d-platformer`
  (Pixi.js + Rapier) and `multiplayer-cars` (peer-to-peer driving, Three.js + Rapier). Each is a
  standalone Vite + TypeScript project with a level, controls and a camera wired, started with
  `npx degit AndyGura/gg-web-engine/templates/<name> my-game`, and carries an `AGENTS.md` pointing
  coding agents at the engine guide. The release script bumps their engine versions.
- `@gg-web-engine/core` ships an `AGENTS.md` guide for AI coding agents (Cursor, Codex, Copilot,
  Claude Code, ...): after install it is at `node_modules/@gg-web-engine/core/AGENTS.md`. It is the
  `gg-engine-app-development` skill's text, regenerated from it by `npm run agents-md`.
- The docs site serves `llms.txt` (an index for AI agents) and `llms-full.txt` (pitch, install
  lines, the app-development guide and one complete example game per dimension, in one file),
  generated at release time.
- Errors that say how to fix common setup mistakes. A `Gg3dWorld` given a 2D visual scene, physics
  world or audio scene (or a `Gg2dWorld` given a 3D one) throws, naming the world class it belongs
  in and the matching adapters. Using a scene or physics world before `await world.init()` throws
  an error saying so (and, for `ammo`/`rapier2d`/`rapier3d`, that their WASM module loads
  asynchronously) where it used to throw "X world not initialized" or fail inside the native
  library; `three`/`pixi` display objects added before `init()` throw instead of silently never
  appearing. `world.start()` before `init()` logs a warning. Loading two different
  `@gg-web-engine/core` versions into one page (an adapter pinned to another core version) logs an
  error naming both versions and the install command to align them. Bodies added to a world they
  weren't created for, and lights/renderers/parallax layers added to a world without a visual
  scene, say what to do instead.
- `GgWorld.isInitialized`.
- Audio bus hierarchy. `world.audioScene.setBusParent(bus, parent | null)` makes a bus feed another
  bus instead of the master output, so the parent's volume and reverb apply to it too: separate
  `engine`/`sfx`/`ambient` volumes sharing one `world` bus reverb, with `music` beside it.
  Volumes multiply down the chain, a cycle throws a `RangeError`, and the voice budget ranks a
  source by its bus volume times its parents'. `getBusParent(bus)` reads it back,
  `@gg-web-engine/audio` scenes add `getEffectiveBusVolume(bus)`, and the dev console has
  `audio_bus_parent`. `setBusParent`/`getBusParent` are required members of
  `IAudioSceneComponent`, so a third-party audio adapter has to add them.
- Blender exporter add-on 1.1.0: options to leave vertex data and lights out of the `.glb`
  (normals, tangents, UVs, vertex colors, lights), in the export panel, as `export_glb_meta`
  keyword arguments and as `export_cli.py` flags (`--no-normals`, `--no-tangents`,
  `--no-texcoords`, `--vertex-color`, `--no-lights`). The defaults export what it always did.

### Fixed
- `FreeCameraController`: with a camera that has no field of view (an orthographic one), the boost
  key (`ShiftLeft`) zoomed instead of boosting and never boosted - the key was read from the slot
  of the zoom keys, which are only bound for a camera with a fov.
- `@gg-web-engine/mobile-controls`: a WebGL game stuttered on every touch-button press and release
  on low-end phones (reported on a Samsung A16). The default stylesheet repainted the pressed
  control on every frame of its transitions, made the browser create and drop a layer at each press,
  and repainted the stick on every move of the finger. Now buttons, the stick knob and the floating
  stick base are compositor layers for good, and only `transform` and `opacity` are animated. The
  floating stick moves under the finger by `transform` instead of `left`/`top`. A press costs one small
  repaint, and dragging the stick none. Changes in look and styling: the pressed colour of a
  button or d-pad arm is instant rather than a 60 ms transition. `--gg-mc-opacity` dims each control (the stick: its knob and its base separately)
  rather than the overlay as a whole. An `opacity` an app sets on the overlay now multiplies with it
  instead of replacing it, and costs an offscreen pass on every frame: dim through
  `--gg-mc-opacity` instead. The stick base's border and background are drawn by its `::before`.
  Transitions are off under `prefers-reduced-motion: reduce`.
- `@gg-web-engine/mobile-controls`: on browsers without the `inset` CSS shorthand (iOS Safari
  before 14.5, Chrome before 87) the overlay collapsed to nothing and clipped every control, and a
  `TouchLookArea` without a `placement` had no size, so it never reported drags or taps. The
  overlay, the look area and the stick base now use the `top`/`right`/`bottom`/`left` longhands.
- `rapier2d`: bodies were capped at 400 px/s (4 m/s). Rapier's speed limit and tolerances scale
  with its `lengthUnit`, which the adapter left at 1 while working in pixels; it is now 100 (pixels
  per meter). Sleep thresholds and contact tolerances scale with it too, so they now match the 3D
  backends in physical units: a body slower than about 10 px/s can fall asleep.
- `rapier2d`: a dynamic body weighed its `mass` plus its shape's area in pixels (a 20 px circle with
  `mass: 4` weighed about 1261), so impulses and forces barely moved it. It now weighs exactly
  `mass`, and its rotational inertia follows from that mass.
- `pixi`: `getBoundings()` threw for every display object except particle systems. It now returns
  world-space bounds.
- `pixi`: setting `scale` on an untextured or textured `BOX` (or a textured `CIRCLE`) resized it to
  `scale` pixels. `scale` is now relative to the size the primitive was built with, and a new
  primitive reads `{ x: 1, y: 1 }`, as on three.
- `pixi`: `popChild(name)` always returned `null`. It now detaches the named child; `name` is the
  native `label`, and clones keep it.
- Calling `GgWorld.init()` twice no longer initializes the scenes again and doubles every tick:
  the second call returns the first call's promise. A failed `init()` can be retried.
- Setting `gravity` on a `rapier2d`/`rapier3d` physics world before `init()` threw; it is now kept
  and applied when the world initializes.
- `getBusVolume` and `masterVolume` on `@gg-web-engine/audio` scenes returned the level a volume
  change had faded to so far, so reading one right after setting it gave the old value. They return
  the value last set.

### Changed
- `KeyboardInput`: a key held through `emulateKeyDown` stays down across a real `keyup` of the same
  key, until `emulateKeyUp` (or `resetAllKeys`), so an on-screen or gamepad button holding a key is
  not let go of by a tap on the keyboard - and a key held on the physical keyboard stays down across
  an `emulateKeyUp` of it, until its real `keyup`. A key goes up when its last holder lets go:
  `emulateKeyDown`/`emulateKeyUp` take an optional `holder` token telling emulated holders apart,
  so a touch button and a gamepad button bound to the same key (`GamepadInput.bindKeys` and the
  mobile-controls bindings pass one) do not release each other's hold.

## [0.0.82] - 2026-10-10

### Added
- Particle systems (3D). `world.addParticleSystem(renderOptions, options)` (or
  `new ParticleSystem3dEntity(visualScene.factory.createParticleSystem(renderOptions), options)`)
  adds camera-facing sprites drawn in one draw call per system. The simulation runs in core
  (`ParticleSimulation`, the same for every adapter, dimension-agnostic for a later 2D version) on
  the world clock: manual `emit(count, init)` with a per-particle init callback, a continuous `rate`
  and `bursts`; per-particle position, velocity, acceleration plus system `gravity`, drag, lifetime,
  size (width and height in world units), opacity, rotation, tint, atlas frame (`frames`,
  `ParticleFrames.grid`/`fromPixels`) with frame sequences, and user data; keyframed or function
  curves for size and opacity over life (`sizeOverLife`/`opacityOverLife`, linear or stepped); a
  per-particle `update` callback and a per-step `onStep` hook; an optional `fixedTimeStep` (e.g.
  1/30 s to mirror a 30 Hz original) with interpolated rendering; `overflow` reusing the oldest
  particle or dropping; emitters attached to an entity with a local `offset` (`attachTo`), particles
  in world or `local` space. Rendering options: blend mode (`normal`, `additive`, `multiply`,
  `subtractive`, `premultiplied`), `textureAlpha: 'brightness'` for sprites on an opaque black
  background, camera-facing or vertical billboards, back-to-front sorting per camera, depth test
  on and depth write off by default, fog, no shadows. `@gg-web-engine/three` implements it with an
  instanced quad mesh (`ThreeParticleSystemComponent`) and a `material` hook to adjust or replace
  the built-in shader material; `ThreeSceneComponent.beforeRenderHooks` runs per-camera code before
  each render. Every 3D visual adapter now implements `createParticleSystem`, and
  `VisualTypeDocRepo3D` has `particleSystem`/`particleSystemExtraOpts` members. The raycast vehicle
  example leaves tyre smoke when braking, the portal room's incinerator spits embers and the city's
  driven car puffs exhaust following its engine rpm.
- Particle systems (2D). `Gg2dWorld.addParticleSystem(renderOptions, options)` (or
  `new ParticleSystem2dEntity(visualScene.factory.createParticleSystem(renderOptions), options)`)
  runs the same `ParticleSimulation` with 2D vectors - every simulation option above, sizes and
  speeds in world units, a particle's `rotation` in the 2D world's own sign - and draws it through
  `IParticleSystem2dComponent`. Render options: `capacity`, `texture`, `blending` (`normal`,
  `additive`, `multiply` - the modes every 2D renderer has) and `zIndex`; the component's own
  `tint`/`opacity` multiply the particles'. `@gg-web-engine/pixi` implements it with a
  `ParticleContainer` (`PixiParticleSystemComponent`, atlas frames as sub-textures of the system's
  texture; `roundPixels` extra option). Every 2D visual adapter now implements
  `createParticleSystem`, and `VisualTypeDocRepo2D` has `particleSystem`/`particleSystemExtraOpts`
  members. The coin run example bursts sparks out of every collected coin, and the side-view
  character kicks up animated dust puffs when landing and running.

## [0.0.81] - 2026-10-09

### Added
- Forces and impulses on rigid bodies. `IRigidBodyComponent` gained `applyForce(force, worldPoint?)`,
  `applyImpulse(impulse, worldPoint?)`, `applyTorque(torque)` and `applyTorqueImpulse(torqueImpulse)`
  (Newtons, N·s, N·m, N·m·s; a torque is a `Point3` in 3D and a signed scalar in 2D). A force or
  torque acts during the next `simulate()` call only, for all of its substeps, so a continuous
  force (drag, wind, a thruster) is re-applied every tick and integrates the same at any frame
  rate; an impulse changes the velocity at once. A `worldPoint` makes a force/impulse also spin the
  body. Static and kinematic bodies ignore them. Implemented in `ammo`, `rapier3d`, `rapier2d` and
  `matter`; a third-party physics adapter has to add the four methods.
- `IRaycastVehicleComponent.setWheelFrictionSlip(wheelIndex, frictionSlip)`/`getWheelFrictionSlip`
  and `RaycastVehicle3dEntity.setFrictionSlip(axle, frictionSlip)`/`wheelCount(axle)`: retune a
  wheel's tyre grip on the live vehicle (a sliding handbrake, gravel, ice) without reaching into the
  physics backend. Implemented in `ammo` and `rapier3d`.
- `GgCarProperties` tuning, all optional with defaults that keep today's behavior:
  `transmission.downshiftMargin` (rpm of hysteresis before an automatic shifts back down),
  `transmission.shiftTime` (ms per gear change, engine disconnected and throttle cut meanwhile -
  `GgCarEntity.isShifting`/`shiftRemainingMs`), `transmission.gearEfficiencies` (per forward gear),
  `engine.overRevBrakeForce` (the rev limiter's braking force, `0` for a plain throttle cut),
  `engine.brakingTorquePer1000Rpm` (engine braking as a drivetrain-scaled torque) or
  `engine.brakingForcePerRpm` (as a force at the wheels), `aerodynamics` (`½·ρ·Cd·A·v²` air drag)
  and `rollingResistance` (`Crr·m·g`), the last two applied through `applyForce` so a car now has a
  drag-limited top speed. The `"GgCar"` level class and `GgCarEntity.serializeSettings` carry
  `aerodynamics`/`rollingResistance` too.
- `GgCarEntity` hook methods for subclasses: `computeDrive()` (inputs and state to a drive force and
  brake pedal), `applyDrive(force, brake)` (to the wheels), `selectAutoGear()` (the automatic's
  choice), `applyResistance(delta)` (chassis forces) and `engineBrakingForce(rpm)`.

### Changed
- **Breaking**: `GgCarEntity`'s drive force is now the whole car's, not per driven wheel.
  `tractionForce` (engine torque through the drivetrain over the wheel radius) is split between the
  axles by `tractionBias` and then equally over each axle's wheels, so a four-wheel car is pushed by
  `tractionForce`, where it used to be pushed by twice that (the per-wheel force went to every
  driven wheel). Double a car's `engine.torques` to keep its acceleration. The rev limiter and
  engine braking are whole-car forces too, with defaults equal to the old per-wheel values summed
  over four wheels (24 000 N, 1 N per rpm). In neutral the car no longer receives any drive force
  (it used to be pushed backwards by the engine-braking formula).
- `GgCarNetState` carries `shiftMs`, the gear change in progress; a replica adopts it by age instead
  of restarting the shift from its own `gear` setter.

## [0.0.80] - 2026-10-09

### Added
- Audio voice budget. `world.audioScene.maxVoices` (default `Infinity`, so nothing changes until
  an app sets it) bounds how many playing sources are rendered at once. Beyond it the lowest-ranked
  sources go virtual: faded out, stopped and disconnected (no audio processing), their playback
  position still advancing, and faded back in where they would be once they rank inside the budget
  again. Ranking: audible before silent, then the new `priority` (on `AudioSourceDescriptor` and
  `IAudioSourceComponent`, higher is more important, default `0`; also in the `"Sound"` level class
  and the `"PlaySound"` blueprint node), then loudness at the listener. Sources have `isVirtual`, the
  scene has `voiceCounts`, and the dev console has `audio_voices [int|inf]`. `maxVoices`,
  `voiceCounts`, `priority` and `isVirtual` are required members of `IAudioSceneComponent`/
  `IAudioSourceComponent`, so a third-party audio adapter has to add them.
- Audio bus reverb. `world.audioScene.setBusReverb(bus, settings | null)` puts a reverb on one bus
  (an echoing tunnel, a cave): `AudioReverbSettings` `{ wet, dry, decay, preDelay, damping }`,
  defaults `0.3`/`1`/`1.5`s/`0.02`s/`0.5` (`DEFAULT_AUDIO_REVERB`, `resolveAudioReverbSettings`).
  `wet`/`dry` are ramped, so a game fades it in and out by calling it every frame; at `wet: 0` the
  reverb stops costing audio processing. `@gg-web-engine/audio` renders it with one `ConvolverNode`
  per bus and a procedurally generated impulse response (decaying noise, high frequencies damped
  over the tail). `getBusReverb(bus)` reads the settings back; the dev console has `audio_reverb`.
  `setBusReverb`/`getBusReverb` are required members of `IAudioSceneComponent`, so a third-party
  audio adapter has to add them.
- 3D audio panning model. `panningModel: 'HRTF' | 'equalpower'` on `AudioSource3dDescriptor` (what
  a 3D audio factory's `createSource` and `AudioSource3dEntity.playOneShot` take, and the `"Sound"`
  3D level class) and on `IAudioSource3dComponent`, writable at runtime, and
  `defaultPanningModel` on the 3D audio scene for every source created afterwards. Defaults to
  `'HRTF'`, as before; `'equalpower'` is much cheaper on the audio thread (mobile). Required members
  of `IAudioSource3dComponent`/`IAudioScene3dComponent`.

### Fixed
- `@gg-web-engine/audio`: a paused source resumes where it was paused when its `playbackRate` is not
  `1` or it loops a region (`loopStart`/`loopEnd`); its position was taken as elapsed time from the
  clip's start.

- `@gg-web-engine/core`: `ScreenManager` no longer blanks a leaving screen before its replacement
  shows. A screen that leaves the stack gets `exit()` as before, but its teardowns run and its
  worlds are disposed only when its layer is removed - once the next screen (or the loading view)
  shows - with its worlds paused and their input off in between. A menu whose teardown disposes a
  world rendering into its layer kept showing a blank canvas for the loading delay and the start
  of the next screen's `enter()`. A screen that never finished entering is still cleaned up at
  once. A leaving screen's resources now briefly coexist with the next screen's loading.

## [0.0.79] - 2026-10-08

### Added
- `@gg-web-engine/core`: an engine-provided loading screen. `DefaultLoadingView` is now an opaque
  backdrop with an animated CSS 3D cube and "Loading" (a progress bar and percentage join it once
  a load reports progress), used by `ScreenManager` as before. `LoadingScreen.show()` puts it (or
  an app's own `LoadingView`) over the page until `hide()`, typically around `init()` and a level
  load; `setProgress` feeds it a loader's progress. `LoadingScreen.setDefaultView(() => new
  MyLoadingView())` makes a game's own view the default for every `show()` and for `ScreenManager`.
  Every example that opens straight into a level uses it.
- Every visual scene, physics world and audio scene names its backend: `backendName` (`'three'`,
  `'pixi'`, `'ammo'`, `'rapier3d'`, `'rapier2d'`, `'matter'`, `'webaudio'`). A required member of
  `IVisualSceneComponent`, `IPhysicsWorldComponent` and `IAudioSceneComponent`, so a third-party
  adapter has to add it.
- Dev console: `worlds` shows the backends each world runs on, and `world` prints the selected
  world's backends, clock state, time scale, fps limit, physics step and entity/renderer counts
  under its name.
- `@gg-web-engine/core`: `ScreenManagerOptions.onEnterError` returns a screen to show when a
  screen's `enter()` throws, so a failed game load can fall back to the menu instead of an empty
  page. `Screen.screenTypeName` names a screen class in the dev console in a minified build.
- `@gg-web-engine/core`: a level's progress includes the first chunks of a `"MapGraph"`
  (`MapGraph3dEntity.initialChunks`), and the level's signal cancels them. `AssetScope.adopt`
  holds another scope's assets.
- `@gg-web-engine/mobile-controls`: a built-in layout for `ObjectGrabController` - a grab button
  that turns into a release button while something is held, and a throw button shown only then
  (`grab` option, `grabLayout`). `ObjectGrabController` exposes `heldObject$`, `keyboard`, `options`
  and public `throwHeld()`/`dropHeld()` for it.
- Examples: the coin run and portal room demos show on-screen controls on a phone.
- Examples: the screens, shooter and fly city demos run on Rapier 3D as well as Ammo. A fly city
  room link names the physics engine, so everyone in the room uses the same one.
- Examples: the coin run demo runs on Matter as well as Rapier 2D, with the engine in its invite
  link. 2D examples make their camera with `factory.createCamera()`.
- Examples: 3D examples no longer stub Node built-ins or list `mini-signals` for Ammo.
- Examples: list only `@gg-web-engine/*` packages; three.js, pixi.js, matter-js and Rapier come with
  the adapters.
- `@gg-web-engine/core`: `WheelOptions.maxSuspensionForce` (Newtons per wheel, also in
  `RVEntitySharedWheelOptions` and a `"GgCar"`'s wheel settings), defaulting to
  `defaultMaxSuspensionForce(chassisMass)` - twice the car's weight per wheel. Ammo and Rapier used
  their engines' own 6000 N, which bottoms a 1.5 t car out at ~1.6 g (hard braking, a dip, a landing).
- `@gg-web-engine/core`: `Qtrn.fromTo(from, to)`, the shortest-arc rotation between two directions.
- `@gg-web-engine/core`: `WheelOptions.sideFrictionStiffness` (also in `RVEntitySharedWheelOptions`
  and a `"GgCar"`'s wheel settings), a multiplier on a tyre's sideways grip, default 1. Rapier
  applies it; Ammo has no such setting and ignores it.
- `@gg-web-engine/core`: `IPhysicsWorldComponent.fixedTimeStep`/`maxSubSteps`, the substep settings
  Ammo and Rapier 3D already had, so an app can set them without importing an adapter class. Adapters
  that don't substep (Matter, Rapier 2D) ignore them.
- `@gg-web-engine/core`: `IDisplayObject2dComponentFactory.createCamera()`, so a 2D app makes its
  camera with `world.visualScene.factory.createCamera()` instead of constructing
  `PixiCameraComponent` itself, as a 3D app does with `createPerspectiveCamera`.
- `@gg-web-engine/core`: `Gg3dWorldWithPhysics<W>`/`Gg2dWorldWithPhysics<W>` type a world whose
  physics backend is picked at runtime (`Gg3dWorldWithPhysics<ThreeGgWorld>`): `physicsWorld` is the
  generic physics interface and never `null`, without naming a physics adapter.

### Changed
- `@gg-web-engine/core`: `ScreenManager` operations resolve with `true` when their screen was shown
  and `false` when a later operation cancelled it (they used to report success either way).
  An operation cancels exactly the not-yet-shown screens it removes, judged by the stack the
  queued operations lead to: `push(a); push(b); pop()` never enters `b`, and a `popTo` that fails
  cancels nothing. `pop` rejects a count that isn't a positive integer. The screens leaving stay
  visible until the next one (or the loading view) shows, and the loading view stays at least
  `loadingMinDuration` (300 ms) once shown.
- `@gg-web-engine/core`: `MouseInput.delta$` reports each mouse movement once. It used to report
  every movement twice (once from `pointermove` and once from the `mousemove` fired for the same
  motion), so every mouse-look sensitivity - `OrbitCameraController`'s orbiting/panning/dollying,
  `PlayerCharacterController.mouseSensitivity`, `FreeCameraController.cameraRotationSensitivity` -
  effectively ran at double its documented "radians per 1000px". The same value now turns half as
  far; an app that wants its previous feel back doubles its sensitivity.
- `@gg-web-engine/core`, `ammo`, `rapier3d`: raycast vehicle brakes are forces in Newtons per wheel
  (`IRaycastVehicleComponent.applyBrake`, `RaycastVehicle3dEntity.applyBrake`,
  `GgCarProperties.brake`) and brake the same at any frame rate. The value used to reach the physics
  engine as the impulse of one step, so it braked harder the higher the frame rate: on Ammo a
  1549 kg car braked at 3.4 g at 50 FPS and 5 g at 144 FPS with the same values, on Rapier in
  proportion to the frame rate. Now the car decelerates by the sum of its wheels' forces divided by
  its mass (until the tyres slide). To keep a car's 60 FPS braking, multiply its old brake values by
  120 on Ammo and by 60 on Rapier. An app that converted forces into impulses itself (e.g. by
  multiplying by Ammo's substep length) must stop doing so, or it brakes ~100 times too weakly.
  Engine forces were already Newtons and are unchanged.
- `@gg-web-engine/core`: `RaycastVehicle3dEntity`'s wheel defaults: `frictionSlip` 1.2 instead of
  1000 (it is the tyre friction coefficient, so 1000 kept the car on rails), and `maxTravel` equal to
  `suspension.restLength` instead of 0.5 (a wheel no longer rises above its connection point into the
  body). Pass the old values explicitly to keep them.
- `@gg-web-engine/core`: `SurfaceFollowingEntity`'s planes are static bodies again, oriented by the
  shortest-arc rotation to the surface normal and placed under their collider from the start. As
  kinematic bodies (since 0.0.72) Ammo gave them the collider's own speed, a spin of ~200 rad/s from a
  twist that flipped with a nearly flat road's tilt, and a first step from the world origin - and
  pushed all of it into the car body on every chassis contact.
- `@gg-web-engine/core`: frame-rate independence of `tick$`-driven behavior: a character's jump
  height and fall (`CharacterController3dEntity`/`CharacterController2dEntity` move by the exact
  displacement under gravity, including the takeoff tick), `GgCarEntity`'s auto-shift (every 50 ms of
  world time, no longer a wall-clock throttle), `Grabbable3dEntity`'s blocked-push detection (a time,
  not 6 ticks) and `angularDamping` (now per 1/60 s), `FreeCameraController`'s zoom keys (60°/s, not
  1° per tick), `PlayerCharacterController2d.cameraSmoothing` (per 1/60 s) and the network
  corrections' per-second gains (exponential). Each behaves at 60 FPS about as before.
- `@gg-web-engine/rapier3d`: `simulate()` splits every frame into steps of at most 10 ms
  (`Rapier3dWorldComponent.fixedTimeStep`, `maxSubSteps`) instead of one step of the whole frame, so
  the solver behaves the same at any frame rate: a raycast vehicle cornering at 20 m/s kept 16.2 m/s
  at 30 FPS but 19.0 m/s at 144 FPS, now 18.85-19.03 m/s at 30/60/144 FPS. A `kinematic_pos` body
  moves through its per-tick target in equal parts over the steps, and collision/trigger events of
  every step are delivered after the last one.
- `@gg-web-engine/ammo`: `resetMotion()` stops a body in place instead of taking it out of the world
  for a tick, so it no longer emits `removed$`/`added$` (which made `SurfaceFollowingEntity` drop a
  reset car's road plane). Setting `position`/`rotation` on a dynamic body also moves its motion state
  and interpolation transform, so a reset vehicle's wheels sit at its new pose.
- `@gg-web-engine/rapier3d`: a dynamic body's centre of mass is its origin, as on Ammo, instead of
  the average of its colliders. A `COMPOUND` (a car chassis built from a few boxes) no longer gets
  its centre of mass high above the wheels, and its mass is spread over the parts by volume.
  `BodyOptions.mass` documents the rule for 3D.
- `@gg-web-engine/rapier3d`: `WheelOptions.rollInfluence` is ignored, since Rapier's vehicle
  controller has no roll influence. It used to be passed to Rapier as side-friction stiffness, so the
  default `0.2` left wheels with a fifth of their sideways grip; side grip is now
  `sideFrictionStiffness` (default 1).
- `@gg-web-engine/ammo`: no longer has a `mini-signals` peer dependency (nothing used it), and its
  bundled typings declare `namespace Ammo`, so an app type-checks them without `skipLibCheck`
  under TypeScript 6. An app needs no `tsconfig` path mapping or `browser` field for the adapter any
  more: the package's own `browser` field stubs the `fs` the ammo.js glue references.
- `@gg-web-engine/three`, `@gg-web-engine/pixi`, `@gg-web-engine/matter`, `@gg-web-engine/rapier2d`,
  `@gg-web-engine/rapier3d`: the library each adapter wraps (`three` with `@types/three`, `pixi.js`,
  `matter-js` with `@types/matter-js`, the Rapier compat builds) is a regular dependency of the
  adapter, pinned as before, instead of a peer dependency. An app installs only the
  `@gg-web-engine/*` packages; one that imports the library itself should pin the same version.

### Fixed
- `@gg-web-engine/rapier3d`: a cloned body reports collisions and trigger overlaps again; `clone()`
  dropped the collider's event flags.
- `@gg-web-engine/ammo`: a trigger's `onEntityLeft` reports a body removed *and disposed* while
  inside as that body, as every other adapter does, instead of `null`.
- `@gg-web-engine/core`: looking around by dragging a finger over the canvas (`OrbitCameraController`,
  `PlayerCharacterController`/`FreeCameraController` without an on-screen look area) was far slower
  than with a mouse. `MouseInput` now measures a touch pointer from its own previous position instead
  of the browser's `movementX`/`movementY` and scales it by a new `touchSensitivity` option (3 by
  default, matching the mobile-controls look area). `ObjectGrabController` no longer throws or drops
  on a touch device's drag - the on-screen buttons do that there.
- `@gg-web-engine/core`: load progress no longer jumps to 99.9% as soon as the first step of a load
  is done (the level JSON of `loadLevelFromUrl`, the root file of `loadGgGlb` before its props, the
  preload of `loadLevel` before its entities) and then sits there while the rest loads.
  `LoadProgressGroup` reserves weight for steps that have not reported yet and gains `complete(slot)`.
- `@gg-web-engine/core`: aborting a load rejects at once, also when another load is downloading the
  same asset; a failing asset cancels the rest of `preload`; disposing a world cancels its running
  loads (including `MapGraph3dEntity` chunk loads) and its loader takes no new ones.
- `@gg-web-engine/core`: a pause screen opened while a network session was connecting no longer
  leaves the game frozen after the join, and one open when the session ends now pauses it
  (`GgWorld.localPauseAllowed$`). A pause screen opened while the tab was hidden keeps the game
  paused when the tab is shown again (`pauseWhenHidden`).
- `@gg-web-engine/core`: `GgWorld.dispose()` disposes everything even when one step throws, and
  rethrows the first error afterwards.
- `@gg-web-engine/core`: calling `ScreenManager.dispose()` twice before the first call finished no
  longer detaches a different manager from the shared dev-console `screens` command; every call
  shares the one disposal.
- Every package declares `sideEffects`, so a bundler leaves out the modules an app doesn't use -
  for core that includes the dev console, debugger and stats.js.
- `@gg-web-engine/pixi`: disposing a renderer (a world) before pixi finished initializing no longer
  throws, and frees the WebGL context once initialization completes.
- `@gg-web-engine/core`: an entity detached from its `MapGraph3dEntity` chunk (or moved to another
  chunk) keeps the chunk's geometry, materials and shapes until it is disposed; the chunk unloading
  freed them under it.
- `@gg-web-engine/core`: loads of one file with different options at the same time (a model with
  two offsets, a texture with two filters) download it once.
- `@gg-web-engine/core`: uncovering a screen puts back the `pointerEvents` its layer had;
  `world.inputEnabled = true` after `dispose()` no longer re-attaches keyboard listeners; two
  `ScreenManager`s no longer overwrite each other's dev console commands.
- `@gg-web-engine/ammo`: triangle mesh (`MESH`) colliders collide. Every triangle was built from
  the same point three times, so nothing ever hit one.
- `@gg-web-engine/ammo`: every `simulate()` call runs exactly `ceil(delta / fixedTimeStep)` substeps.
  Bullet's float accumulator sometimes ran one fewer and one more in the next call (about once per
  1000 calls).
- `@gg-web-engine/ammo`: setting a body's `position`, `rotation`, `linearVelocity` or
  `angularVelocity` no longer leaks a native vector in the WASM heap per call (an entity moving a
  body every tick, like `SurfaceFollowingEntity`, ran the page out of memory over time).
- `@gg-web-engine/core`: `Pnt3.angle`/`Pnt2.angle` return 0 instead of `NaN` when a vector has zero
  length.
- `@gg-web-engine/rapier3d`, `@gg-web-engine/rapier2d`: a rigid body or character controller
  removed from the world and added again keeps the position, rotation and velocity it had when
  removed. It used to reappear where it was created - e.g. a car re-parented to another map chunk
  snapped back to its spawn point.
- `@gg-web-engine/matter`: the character controller marches a move in steps of half its radius
  instead of at most 0.1 world units, so a pixel-scale character no longer runs hundreds of collision
  queries per tick (8 characters: from ~1480 to ~35 queries per tick).

## [0.0.78] - 2026-10-05

### Added
- New package `@gg-web-engine/mobile-controls`: an overlay of on-screen touch controls.
  `world.addEntity(new MobileControls())` shows sticks and buttons matching whichever of the car,
  character (3D/2D) and free camera controllers is active, on touch devices only. Layouts have
  variants (buttons/stick/tilt steering, stick/d-pad movement, drag/stick look), can be adjusted
  control by control, replaced, and registered for an app's own controllers; `TouchButton`,
  `TouchStick`, `TouchDPad`, `TouchLookArea` and `TiltInput` are usable on their own.
- `@gg-web-engine/core`: analog input. `DirectionInput.direction$`/`direction` report the
  direction as a vector, combining the keys with contributions set through `setAnalogDirection`
  (a `DirectionInput` created without a keyboard takes those alone); `MouseInput.emulateMove`
  emits a movement through `delta$`. The car, character and free camera
  controllers follow `direction$`, and expose `options` and `keyboard` publicly.
- `@gg-web-engine/core`: `CharacterController3dEntity` moves proportionally slower for a
  `moveDirection` shorter than 1 (a longer one is still capped at full speed).
- `@gg-web-engine/core`, `@gg-web-engine/three`, `@gg-web-engine/pixi`: display-object nesting.
  `displayObject.addChild(child)`/`removeChild(child)` make a child follow its parent's position,
  rotation and scale (and get cloned and disposed with it).
- `@gg-web-engine/core`, `@gg-web-engine/three`: `castShadow`/`receiveShadow` on every 3D display
  object, applied to the whole hierarchy of a loaded model; `loadGgGlb` options and `"Glb"` level
  entries accept `castShadow`/`receiveShadow` too.
- `@gg-web-engine/core`, `@gg-web-engine/three`, `@gg-web-engine/pixi`: `opacity` material option
  (`DisplayObject3dOpts`/`DisplayObject2dOpts`).
- `@gg-web-engine/core`, `@gg-web-engine/three`: `loader.loadTexture` options `repeat` (tile a
  texture across a surface) and `filter` (`'nearest'` for crisp pixel art); `factory.createTextureFromCanvas`.
- `@gg-web-engine/core`, `@gg-web-engine/pixi`: 2D text (`factory.createText(text, style)` returning
  an `IText2dComponent` with `text`, `style` and `setStyle`); `stroke` outlines for untextured 2D
  shapes; `tint` and `opacity` on every 2D display object; `factory.loadTexture(url, { filter })`
  and `factory.createTextureFromCanvas`. A textured 2D primitive's `color` now tints the texture.
- `@gg-web-engine/core` and every physics adapter: `canSleep` body option (default `true`); `false`
  keeps a dynamic body simulated while it rests.
- `@gg-web-engine/core`: screens. `ScreenManager` keeps an app's `Screen`s (menu, game, pause
  overlay, ...) as a stack of DOM layers with `push` (optionally `clearHistory`), `replace`,
  `pop(count)`, `popTo` and `reset`. A screen enters once (`enter(ctx)`, with a loading view fed
  by `ctx.reportProgress` while it is pending and `ctx.signal` aborted if it is removed mid-load),
  is told when it is covered and uncovered, and exits once; worlds it registers with `addWorld`
  are paused and have their input switched off while it is covered, and are disposed on exit.
  `DefaultLoadingView` is the built-in progress bar. With `GgStatic` present, the console gains
  `screens` and `screen_pop`.
- `@gg-web-engine/core`: load progress and cancellation. `loadLevel`, `loadLevelFromUrl`,
  `loadGgGlb`, `loadModel` and the new `world.loader.loadTexture`, `loadCubeTexture` (3D),
  `loadClip` and `preload(assets)` take `{ onProgress, signal, scope }`. Progress
  (`LoadProgress`) covers fetching by bytes and decoding (parsing, GPU upload, audio decoding);
  a level reports one progress for everything it references, loaded in parallel before it is
  built. `registerClass(alias, generator, { assets })` declares what a level entity class loads,
  and generators receive the load's options as a third argument.
- `@gg-web-engine/core`: a per-world asset cache on `world.loader`. Assets are fetched and decoded
  once per world and shared by repeated and concurrent loads; they are held by an `AssetScope`
  (`loader.createAssetScope()`) and freed when the last scope holding them is released. A level
  holds its assets until its group entity is disposed, a `MapGraph3dEntity` chunk until it
  unloads, an entity built with `createEntity` until it is disposed, anything else until the world
  is disposed.
- `@gg-web-engine/core`: `GgWorld.inputEnabled`/`inputEnabled$` switch a world's keyboard, the
  built-in controllers' mouse and direction inputs and the `@gg-web-engine/mobile-controls`
  overlay off and on together; `runWhileInputEnabled` ties an app's own inputs to it.
  `GgWorld.localPauseAllowed` tells UI not to pause a shared world; `@gg-web-engine/multiplayer`
  clears it while a session is joined.
- `@gg-web-engine/core`: `IEntity.disposed$`.
- `@gg-web-engine/three`, `@gg-web-engine/pixi`, `@gg-web-engine/audio`: decoding from fetched
  data (`textureFromData`, `cubeTextureFromData`, `decodeClip`), `prepare` (GPU upload ahead of
  the first frame) and, for pixi, `disposeTexture`.

### Changed
- Examples: one example per feature under `examples/2d` and `examples/3d` instead of one copy per
  renderer/physics combination. Each example picks its physics backend at startup from a
  `?physics=` query parameter (`backends.ts`, loading only the chosen adapter), and the gallery at
  gg-web-demos.guraklgames.com swaps rendering/physics backends in place, forwards other query
  parameters (a coin-run room link works through it) and still opens every example in StackBlitz.
  `examples/examples.json` replaces `examples-list.txt` as the registry. The `ammo-car` example is
  now `3d/raycast-vehicle`.
- `@gg-web-engine/core`: `DirectionKeyboardInput` is renamed to `DirectionInput` and
  `DirectionKeyboardKeymap` to `DirectionKeymap`, now that the input is no longer keyboard-only. The
  old names are gone.
- `@gg-web-engine/core`: `CarKeyboardHandlingController` is renamed to `CarHandlingController`,
  `GgCarKeyboardHandlingController` to `GgCarHandlingController`, and their option types to
  `CarHandlingControllerOptions`/`GgCarHandlingControllerOptions`: they follow any direction
  source now, not the keyboard alone. The old names are gone.
- `@gg-web-engine/core`: `loadGgGlb` and `loadModel` cache by default and return copies of the
  cached original (what `CachingStrategy.Entities` did). `CachingStrategy.Nothing` still loads
  outside the cache; `Files` and `Entities` both mean the default now. `Gg3dLoader.filesCache`/
  `loadResultCache` are gone (`loader.assetCache` replaces them), and `loadGgGlbFiles` takes load
  options instead of a `useCache` flag.
- `@gg-web-engine/core`, `@gg-web-engine/three`: a display object's `clone()` shares geometry,
  materials and textures with its source and no longer frees them when disposed; the source does.
  A model loaded from a `.glb` frees its textures along with its meshes.
- `@gg-web-engine/core`: an `"Environment"` level entity's sky textures are freed with the level
  (or, for one built by `createEntity`, with the entity), not by the entity's own `dispose()`
  inside a level.
- `@gg-web-engine/core`, `@gg-web-engine/audio`: pausing a world pauses its audio
  (`IAudioSceneComponent.setPaused`): every sound stops where it is and continues on resume.
- `@gg-web-engine/three`: disposing a renderer releases its WebGL context immediately. The canvas
  can't host another renderer afterwards.
- `@gg-web-engine/core`: `loadLevelFromUrl` reports a failed request as
  `Failed to load "<url>": <status>`.

### Fixed
- `@gg-web-engine/core`: `MouseInput.isTouchDevice()` did not recognize an iPad (which reports a
  desktop user agent) or any other device whose primary pointer is coarse, so the controllers'
  "unless pointer locked" options blocked touch input there.
- `@gg-web-engine/core`: `FreeCameraController` ignored its up/down/zoom/boost keys until a direction
  key had been pressed once.
- `@gg-web-engine/matter`: `MatterRigidBodyComponent.clone()` and `MatterTriggerComponent.clone()`
  overflowed the stack for every body; they now rebuild the body from its shape, options and
  transform.
- `@gg-web-engine/pixi`: `clone()` of a display object returned a component sharing the original's
  native object, so disposing one destroyed the other; it now makes an independent deep copy
  (children included), and cloning a text or an animated sprite keeps its class, tint and opacity.
- `@gg-web-engine/matter`: a `CAPSULE` rigid body ignored its body options (mass, friction,
  restitution, static/dynamic type).
- `@gg-web-engine/core`: `KeyboardInput.stop()` added a `pointerlockchange` listener instead of
  removing its own, leaking one per stopped input (per disposed world).
- `@gg-web-engine/core`: `KeyboardInput` took the auto-repeat of a held key for a new press, so a
  key held while its input was reset or restarted got pressed again.
- `@gg-web-engine/core`: a `MouseInput.wheel$` subscriber stopped receiving after the input was
  stopped and started again; a drag in progress now ends when the input stops.

## [0.0.77] - 2026-10-05

### Added
- `@gg-web-engine/core`, `@gg-web-engine/three`: library-agnostic lights. `factory.createLight(descriptor)`
  builds an `AMBIENT`, `HEMISPHERE`, `DIRECTIONAL`, `POINT` or `SPOT` light (`Light3dDescriptor`:
  color, intensity, distance/decay/angle/penumbra, `castShadow` and `shadow: { mapSize, area, near,
  far, bias, normalBias }`) as an `ILight3dComponent`; `Gg3dWorld.addLight(descriptor, position?,
  target?)` wraps it in a new `Light3dEntity` (with `lookAt(target)`). Directional and spot lights
  shine along their local `-Z`, like a camera.
- `@gg-web-engine/core`, `@gg-web-engine/three`: scene environment. `visualScene.setEnvironment({
  background, environmentMap, fog })` sets a background color or sky texture, image-based lighting
  and linear/exponential fog; `visualScene.environment` reads it back. The 3D loader gained
  `loadTexture(url, { mapping })` (`.hdr` supported) and `loadCubeTexture({ px, nx, py, ny, pz, nz })`,
  whose faces are named by world direction (`pz` overhead), and `disposeTexture(texture)`; sky
  textures are oriented for the Z-up world automatically.
- `@gg-web-engine/core`: `"Light"` and `"Environment"` level-JSON classes. `"Environment"` creates an
  `Environment3dEntity`, which restores the previous background/environment map/fog when its level
  is unloaded and frees the textures it loaded.
- `@gg-web-engine/core`, `@gg-web-engine/pixi`: 2D draw order and backdrops. Every 2D display object
  has a `zIndex` (higher draws on top, default `0`). `visualScene.setEnvironment({ background })`
  sets a background color or a screen-fixed image scaled to cover the view. Parallax layers
  (`factory.createParallaxLayer(options)`, or `Gg2dWorld.addParallaxLayer(options)` which wraps one
  in a new `ParallaxLayer2dEntity`) draw a texture that scrolls at its own rate as the camera moves
  (`parallax`, per axis), repeating along `x`, `y`, both or neither, with `zIndex`, `offset` and
  `scale`. `factory.loadTexture(url)` loads an image for either.
- `@gg-web-engine/core`: 2D `"ParallaxLayer"` and `"Environment"` level-JSON classes (texture and
  background image given as URLs). `"Environment"` creates an `Environment2dEntity`, which restores
  the previous background when its level is unloaded.
- `@gg-web-engine/core`: `MapGraph3dEntity.detachFromChunk(entities)` releases entities from the chunk
  they are attached to without removing them from the world, so content can outlive the chunk it
  was spawned with (a vehicle driven away from it). `attachToChunk` moves an already attached or
  detached entity to another chunk in place, without respawning it.
- `@gg-web-engine/multiplayer`: `NetworkController.isHidden(entity)` and
  `NetworkControllerOptions.outOfViewGraceMs` (default 2000) for zoning's out-of-view handling;
  `net_owners` marks hidden entities. `ITransport.inStreamRange(peerId)` (optional) tells whether a
  peer is inside the stream range, connected or not. `LoopbackHub.cutStream`/`openStream`/
  `interestManagement` model a zoning stream ring in-process.
- `@gg-web-engine/core`: `GgCarKeyboardHandlingController` option `neutralGear`. With `false` (and
  `autoReverse`) neutral is never used: the throttle keys shift a car found in neutral into first
  gear or reverse themselves, so it drives without the gear keys.

### Changed
- `@gg-web-engine/core`: `VisualTypeDocRepo3D` has a new `light` member, and
  `IDisplayObject3dComponentFactory`, `IVisualScene3dComponent` and `IDisplayObject3dComponentLoader`
  have new required members (`createLight`; `environment`/`setEnvironment`;
  `loadTexture`/`loadCubeTexture`/`disposeTexture`). A third-party 3D visual adapter must implement them.
- `@gg-web-engine/core`: `VisualTypeDocRepo2D` has a new `parallaxLayer` member, and
  `IDisplayObject2dComponent` (`zIndex`), `IVisualScene2dComponent` (`environment`/`setEnvironment`)
  and `IDisplayObject2dComponentFactory` (`createParallaxLayer`, `loadTexture`) have new required
  members. A third-party 2D visual adapter must implement them.
- `@gg-web-engine/pixi`: the scene's world container sorts its children by `zIndex`.
- `@gg-web-engine/multiplayer`: with zoning, what a peer outside the stream ring owns no longer stays
  behind as a frozen replica. Entities its player possesses are hidden (shared content: taken out of
  the world, kept, and shown again at the owner's position with its next state) or removed (runtime
  spawns: rebuilt when the owner is back in view); a Free runtime spawn nobody in view claims is
  removed as well; other replicas are no longer corrected toward their last snapshot. A Free entity
  next to the local player is claimed from an out-of-view owner. Runtime spawns are sent to a peer
  when it enters the stream ring (not when the link opens), and a join dump leaves them out for a
  peer out of view. Nothing changes for a transport without zoning.

### Fixed
- `@gg-web-engine/multiplayer`: `WebRtcMeshTransport` reports a peer on `peerLeft$` when it leaves the
  room after its connection aged out of the zoning connect ring, so what it owned is taken over.
- `@gg-web-engine/core`: `GgCarEntity` and both character controller entities ran their per-tick
  update once more per tick each time they were removed from a world and added again.

## [0.0.76] - 2026-10-04

### Added
- `@gg-web-engine/multiplayer`: `NetworkControllerOptions.clockSyncBurstCount` (default 5) and
  `clockSyncBurstIntervalMs` (default 150): a link that just opened (or reopened) gets a burst of
  clock-sync pings before falling back to `clockSyncIntervalMs`. `ClockSync` gained `ready`,
  `targetOffset` and `advance(localTime)`.

- `@gg-web-engine/multiplayer`: `WebRtcMeshTransportOptions.unreliableBufferLimit` (default 16 KB) and
  the `WebRtcMeshTransport.droppedUnreliable` counter: an unreliable message (state, clock-sync ping)
  is dropped instead of queued while the channel's `bufferedAmount` is above the limit - a queued
  snapshot arrives late and useless, and the queue turned one lost packet into a stall of hundreds
  of ms.

- `@gg-web-engine/multiplayer`: `LinkConditioner` (the `net_lag` console command) also simulates
  jitter (`jitterMs`), delivery stalls (`stallMs` every `stallIntervalMs`, delivered as one burst) and
  retransmitted reliable messages (`reliableDelayRate`, `reliableDelayMs`, with head-of-line blocking
  per sender), plus `reset()` and `describe()`:
  `net_lag MS LOSS% JITTER_MS STALL_MS STALL_EVERY_MS RELIABLE_DELAY_MS RELIABLE_DELAY%`.

- `@gg-web-engine/multiplayer`: `net_panel` console command (`NetworkController.showNetPanel`): a
  live overlay with the session state, entity counts, traffic rates and one row per peer (round trip,
  clock offset and what it still has to slew, snapshot age, incoming rate, owned entities, silence).
  The same numbers are available to an app as `NetworkController.netStats` (cumulative counters;
  bytes are counted only while `measureTraffic` is on, which the panel turns on). Per peer it also
  reports state message loss (state messages carry a counter, `n`), how far new snapshots move the
  replicas' targets, and how often that was a lunge (above a quarter of `snapDistance`) or ended in
  an unrequested snap.
- `@gg-web-engine/core`: `INetworkSyncable.applyNetworkState` may return the `CorrectionOutcome`
  (`'none' | 'blend' | 'snap' | 'sleep'`) of the correction; the built-in entities (`Entity2d`,
  `Entity3d`, `GgCarEntity`, both character entities) do. A network layer uses it for diagnostics
  only, and a `void` implementation stays valid.

- `@gg-web-engine/core`: `RigidBodyCorrection.targetPosition`/`MoverCorrection.targetPosition` (the
  point a replica is steered to for a snapshot of a given age) and `extrapolateNetPosition(state,
  ageMs, tuning)`, the same for a state of unknown class; `isNetStateCoasting(sinceReceivedMs,
  tuning)`. `NetworkApplyContext.sinceReceivedMs` (optional): how long ago the state arrived on this
  peer, which unlike `ageMs` doesn't include the link's latency.

### Changed
- `@gg-web-engine/core`: replicas coast through a stalled state stream. A snapshot older than
  `extrapolateMaxMs` used to pin the replica to the point extrapolation stopped at, so a moving
  replica was snapped back to it every `snapDistance` until the stream resumed. Now, once no newer
  snapshot has arrived for `extrapolateMaxMs` (`NetworkApplyContext.sinceReceivedMs`) and until that
  silence lasts `CorrectionTuning.coastMaxMs` (new, default 1000, 0 = off), a dynamic body with a
  moving target and a character are left to their own simulation (`CorrectionOutcome` `'coast'`);
  past it they are corrected to that point as before. A snapshot that is old only because the link
  is slow is corrected to as before, and so is everything under a network layer that doesn't pass
  `sinceReceivedMs`.
- `@gg-web-engine/multiplayer`: peer clock sync no longer averages its samples. `ClockSync` keeps a
  window of the latest ones and estimates the offset from the fastest way out and the fastest way
  back among them, so a sample delayed on one leg (a busy main thread, a queued packet) is ignored
  instead of blended in; once ready, the offset used to convert remote timestamps slews toward a
  changed estimate (5 ms/s) and steps only for an error above 250 ms. Remote timestamps are
  converted only after 3 samples (they count as "now" until then). The `ClockSync` constructor takes
  a `ClockSyncOptions` object instead of an EMA weight; `PeerInfo.rttMs` is the lowest recent round
  trip instead of a smoothed one.
- `@gg-web-engine/multiplayer`: clock-sync pings and pongs travel on the `unreliable` channel
  (`channelOf` reports it), so a lost one is a missing sample instead of a retransmitted, late one.

### Fixed
- `@gg-web-engine/multiplayer`: replicas of a fast entity lunged or teleported every few seconds on
  a real internet link, at constant speed on a straight path: one late clock-sync sample (a
  retransmitted ping, a main thread busy loading when the link opened) shifted the peer's clock
  offset by tens of ms, and with it the extrapolated target of everything that peer owns.

## [0.0.75] - 2026-10-03

### Added
- `@gg-web-engine/multiplayer`: `NetworkControllerOptions.takeoverPossessed` (default `true`). With
  `false`, the entities a departed or away peer possesses are never taken over: they stay owned and
  possessed by that peer (with neutral input on the others) until it is back; the Free entities it
  owned are still taken over.

### Changed
- `@gg-web-engine/pixi`: upgraded `pixi.js` to `8.22.0`.

### Fixed
- `@gg-web-engine/multiplayer`: a stall of the local peer (frozen main thread, throttled timers) no
  longer makes `NetworkController` declare every other peer departed and take over their entities:
  after a gap of over two heartbeat intervals without a world tick or heartbeat timer, every peer and
  remote owner counts as heard from just now.

## [0.0.74] - 2026-10-02

### Added
- `LevelLoader.createEntity` now applies an `EntityJson`'s `events` bindings (an optional third
  `blueprints` argument supplies named graphs a binding may reference), parenting the resulting
  binding under the created entity itself so it's torn down whenever that entity is.
- Public sleep API on rigid bodies: `IRigidBodyComponent.isSleeping`/`wakeUp()`/`sleep()`, implemented
  across `ammo`, `rapier2d`, `rapier3d`, and `matter`.
- `PausableClock.maxTickDelta` (default 250ms, 0 disables) clamps any single tick's scaled delta
  before it reaches `tick$`, and `GgWorld` gained a matching `maxTickDelta` constructor option plus
  a `pauseWhenHidden` option that auto-pauses/resumes the world on tab visibility changes; a new
  `GgWorld.visibility$` observable reports tab visibility regardless of that option.
- Built-in `"Player"` level-JSON class for 2D, mirroring the existing 3D one: a capsule-bodied
  `CharacterController2dEntity`, ready to use.
- Opt-in fixed physics timestep: `GgWorld`'s (`Gg3dWorld`/`Gg2dWorld`) constructor now accepts a
  `fixedPhysicsStep` (ms) option, driving `physicsWorld.simulate()` off a fixed-timestep
  accumulator instead of the raw per-tick delta, plus a `maxPhysicsStepsPerTick` (default 8)
  spiral-of-death guard.
- `GgWorld.entityAdded$`/`entityRemoved$` observables, emitted after a spawn/removal fully
  succeeds (nested entities included); `IEntity.useDefaultNameMiddleware` now returns an
  unregister function for the middleware it just registered.
- New package `@gg-web-engine/multiplayer`: shared-world multiplayer for 2–8 peers on any 2D/3D
  physics adapter - `Network2dController`/`Network3dController` (ownership with possession,
  distance/contact arbitration, replica correction, runtime spawn/despawn, late join, takeover of
  hidden/departed peers, event-authority gating, mutation lock, `net_*` console commands), a WebRTC
  mesh transport with chunking, reconnection and zoning, Firebase and BroadcastChannel signaling,
  and an in-process `LoopbackTransport` for tests.
- Core networking contracts: `INetworkSyncable`/`INetworkInputDriven`, implemented by `Entity2d`/
  `Entity3d`, `GgCarEntity` and both character entities, with `RigidBodyCorrection`/
  `MoverCorrection` helpers for app classes; `TickOrder.NETWORK_IN`.
- Characters gained `externalDisplacement` (folded into the next `move()`), `jumpCount`,
  `actualVelocity`, and serialize themselves (`"Player"` class) including a runtime `state` block
  the loader applies back; `GgCarEntity.autoShiftEnabled`.
- `GgWorld.eventAuthority` (consulted by level JSON `events` bindings before running) and
  `GgWorld.commandGuard` (consulted before running a console command registered with the new
  `mutates` flag of `GgStatic.registerConsoleCommand`); built-in teleport/spawn/remove/time commands
  are flagged mutating. `GgStatic.deregisterConsoleCommand`.
- `LevelLoader.serializeEntity` echoes the `events` bindings an entity was built with.
- Multiplayer modes in examples: `fly-city-three-ammo` gained rooms (`?room=` link), and the new
  `coin-run-pixi-rapier2d` example.

### Fixed
- `ammo`: several `AmmoWorldComponent`s in one page share one Ammo module instance - initializing a
  second world used to re-instantiate the WASM heap under the first, whose new bodies then silently
  stopped simulating.
- `matter`: trigger sensor bodies are static - they used to fall under gravity (through the level,
  reporting static geometry on the way down). Kinematic and sleeping bodies, which matter-js never
  pairs with a static body, are detected by polling.
- Setting a character's `isCrouching` before it is spawned now takes effect: the capsule is rebuilt
  on spawn, centered at the position as set (so a character serialized while crouching reloads where
  it was).
- `matter`: `MatterRigidBodyComponent.rotation`'s setter now calls `Body.setAngle` instead of
  writing `nativeBody.angle` directly, so a rotation write no longer corrupts angular velocity
  (mirrors the existing `Body.setPosition`-based `position` setter).
- `PlayerCharacterController`/`PlayerCharacterController2d`: setting `active = false` now fully
  detaches input - direction/run/crouch keys and (3D) mouse-look stop writing to `character` while
  inactive, and deactivating mid-input zeroes `moveDirection`/`isRunning` (and, in "hold" crouch
  mode, `isCrouching`) instead of leaving the character stuck mid-motion.
- `Gg2dWorld`/`Gg3dWorld` constructors now accept `maxTickDelta`/`pauseWhenHidden`, matching
  `GgWorld`'s own constructor - passing either through `new Gg3dWorld(...)`/`new Gg2dWorld(...)`
  was a type error since those two options were added to `GgWorld` alone.

### Changed
- Upgraded `three` (`0.186.0` → `0.186.1`) and `@dimforge/rapier2d-compat`/
  `@dimforge/rapier3d-compat` (`0.20.0` → `0.21.0`) dependencies.

## [0.0.73] - 2026-09-30

### Added
- Stable entity naming: every entity class declares `static readonly entityTypeName`, giving
  instances a readable auto-generated default name (`ClassName_0`) that survives minification (#46).
- Player model, and the 3D trigger implementation gaps needed for characters to interact with
  triggers (#48).
- 2D shapes, filling implementation gaps around 2D primitives across `pixi`, `matter`, and
  `rapier2d` (#49).
- Raycast vehicle for `rapier3d` (#50).
- 2D character controller and player support (#51).
- Entity serialization: `ISerializableEntity`, and `serializeEntity`/`serializeLevel` on the level
  loader to round-trip a live entity back into level JSON (#52).
- Reworked GTA-like fly-city example (`examples/fly-city-three-ammo`) with camera controller and
  audio.

### Fixed
- Trigger vs character-controller interaction (#47).
- Bug fixes across the `ammo` character controller, triggers, raycast vehicle and world
  component, `MapGraph3dEntity`, the 3D loaders, and `GgWorld` entity handling (#53).

## [0.0.72] - 2026-09-20

### Fixed
- `@gg-web-engine/three` build: `0.0.71` was published without its `dist/` output. The release
  script now checks every build step's exit status individually instead of relying on `&&` chains.
- Example `package-lock.json` files refreshed.

## [0.0.71] - 2026-09-20

### Added
- Continuous collision detection (`ccd`) flag and kinematic rigid-body types, with richer
  physics body-type options (#44).
- Elliptical cylinder shapes in 3D physics and rendering components.

### Changed
- Upgraded `pixi.js` and `three` dependencies (#45).

## [0.0.70] - 2026-09-14

### Added
- New `@gg-web-engine/audio` package: a Web Audio API adapter with 2D/3D audio source entities.
- Collision events on physics bodies.

### Fixed
- Grabbable objects when using the `rapier3d` physics backend.
- Third-person view disabled in the portal example.
- Framework example dependencies bumped.
- Release pipeline: first-time publishing of a new scoped package (`--access public`, tolerating
  `npm view` 404s while npm indexes it).

## [0.0.66] - 2026-09-10

### Added
- Source-engine-style grabbable objects (`Grabbable3dEntity`) (#43).

## [0.0.65] - 2026-09-08

### Added
- Character entity and player character controller (#42).

### Fixed
- Build of the fly-city example.

## [0.0.63] - 2026-08-31

### Added
- Speed-sensitive maximum steering angle for `GgCarEntity` (#41).

## [0.0.62] - 2026-08-31

### Fixed
- `ammo` package build. CI moved to Node 24.

## [0.0.61] - 2026-08-31

### Fixed
- Blender add-on deployment to GitHub Pages.

## [0.0.60] - 2026-08-31

### Added
- Blender export add-on (`blender-addon/`) producing `.glb` + `.meta` for the 3D loader, published
  as a self-hosted Blender extensions repository on every release, with an end-to-end round-trip
  test under `e2e/blender-export` (#38).
- Dev console extension: apps can register their own console commands (#40).

### Changed
- Dependency upgrades across packages (#39).

## [0.0.59] - 2026-08-28

### Added
- Level JSON: `LevelLoader` base class with `Gg2dLevelLoader`/`Gg3dLevelLoader`, built-in
  `Primitive`/`Trigger`/`Camera`/`Glb` classes, app-registered classes, and blueprint graphs wired
  to entity events (#36).
- 2D camera with zoom and rotation (#35).
- Typing helpers.
- Claude Code skill files under `.claude/skills/` documenting how to work on each package.

### Changed
- Local development flow: `packages/*` became an npm workspace with a root `tsc -b --watch`, and
  examples link to local builds via `etc/switch_example_to_local_gg.sh` (#37).

## [0.0.58] - 2025-05-17

### Added
- Raycasting API on physics worlds (#34).
- Spherical interpolation functions for vectors.

### Changed
- Filled gaps in the physics integrations so every adapter implements the same surface (#33).
- Typing improvements across the public API (#32).

### Fixed
- Precision error in `Pnt3.angle`.

## [0.0.57] - 2025-02-21

### Added
- Surface-following collider entity (#31).

### Changed
- Debug view improvements (#30).
- Collision groups improvements (#29).

## [0.0.56] - 2024-12-12

### Added
- Clock enhancements (#25).
- Dev console improvements (#26).
- Dev tools improvements (#23).

### Changed
- Camera controllers adjustments (#27) and a follow-up hotfix.
- Entity constructor arguments updated (#21).
- Improved FPS (#22).
- CI improvements (#24); framework examples upgraded.

### Fixed
- Loader regression; import fixes; three.js example dependencies (#20).

## [0.0.49] - 2024-11-14

### Changed
- Camera controllers improvements and bug fixes (#19).

## [0.0.48] - 2024-08-16

### Added
- Automated release pipeline on GitHub Actions, triggered by a `[pre-release] [X.Y.Z]` commit.
- Composer renderer component in the `three` package.
- `paused$` event on clock and world.
- `Qtrn.fromMatrix3` convenience function.

### Changed
- Dependency upgrades (#18).
- Reduced frame-rate impact of `MapGraph3dEntity`.
- GLTF export script updated for newer Blender.

### Fixed
- Renderer native options bug; workaround for a three.js regression in the fly-city example.
- `three` hotfix.

## [0.0.40] - 2024-05-18

### Added
- Native renderer options can be passed through to pixi.js / three.js.
- Per-entity performance distribution stats (#17).
- Tick-rate limiter on the clock (#16).

### Changed
- Dependency upgrades.

### Fixed
- Tick-rate limit clock bug.

## [0.0.39] - 2024-05-06

### Added
- New physics debugger view (#14).
- Dev tools improvements (#15).
- Clock improvements (#13).

### Fixed
- Car handling inputs emitting events while inactive.

## [0.0.38] - 2024-04-08

### Added
- Convenience functions for vectors.

### Fixed
- `pixi` integration after the library upgrade.
- `ammo` vehicle reset feature; random crash when resetting an `ammo` object's motion properties.
- Brake behavior of RWD and AWD cars; RxJS subscription leak in map graph.

### Changed
- Minor entity API adjustments.

## [0.0.37] - 2023-12-27

### Added
- Self-built ammo.js binary; raycast vehicle now works with collision groups (#9).
- CI on pull requests (#11).

### Changed
- three.js upgrade; GLTF loader baked into the `three` package (#10).
- Free camera controller constructor arguments.

### Fixed
- Imports from three.js; `ammo` build; local workspace script.

## [0.0.30] - 2023-12-18

### Added
- Collision groups.
- Plane shape.
- Collision groups examples for `ammo` and `rapier3d`.

### Changed
- New typing.

### Fixed
- ammo.js module usage.

## [0.0.28] - 2023-12-11

### Added
- Rapier integration: new `@gg-web-engine/rapier2d` and `@gg-web-engine/rapier3d` packages (#4).
- Vehicle improvements (#8).
- Dev tools refinement (#7).

### Changed
- Better examples (#6).

## [0.0.24] - 2023-10-27

### Changed
- New component-based architecture: entities compose visual and physics components instead of
  subclassing per backend (#5).

## [0.0.20] - 2023-05-28

### Added
- Raycast car brake enhancements; handbrake.
- Orbit camera controller properties can be changed from the outside.
- Renderable entity mixin; `parent` field on entities; basis-vector constants.
- `avg` convenience functions for vectors.

### Fixed
- Input controllers freezing when removed from and re-added to the world; input start/stop made
  synchronous.
- `three`: crash when re-using a canvas after destroying the renderer; static renderer size.
- Car keyboard handling controller emitting steering events after being stopped.

## [0.0.18] - 2023-04-29

### Added
- Orbit camera controller; new mouse input; improved free camera.
- Support for canvases of different sizes.

### Removed
- `gg-viewport` and the outdated viewport manager.

### Fixed
- Mobile rendering issues; canvas scaling.
- `pixi` ticks still running in the background.

## [0.0.16] - 2023-04-15

### Changed
- Upgraded `rxjs`, `three`, `pixi.js`, and `matter-js`.

## [0.0.15] - 2023-04-13

### Changed
- Migrated to ES modules; resolved import issues when installed from npm.

## [0.0.05] - 2023-04-13

### Added
- three.js `GLTFLoader` included in the `three` package.
- Closed graph from array; default names for entities; angle-between-vectors math.

### Fixed
- World disposal; RxJS error when disposing a world with sub-entities.

## [0.0.04] - 2023-04-10

### Changed
- All world entities are tick listeners (`ITickListener` removed); entities have an active state.
- Controllers refactored into inputs; world clock API.
- `onRemoved` called on each entity when the world is disposed.

### Removed
- `fs-web` and `path-browserify` dependencies from `ammo`.

## [0.0.03] - 2023-04-03

### Added
- New clock architecture; pause support.
- Entity animations and camera animation controller.
- Convenience rigid-body factory on the world; `Qtrn.rotAround`.

### Changed
- Point fields declared readonly.
- Improved transform bindings for 2D and 3D entities.

### Fixed
- Broken rotations caused by quaternion clone logic; resume-world functionality; motion
  controller tick order vs physics binding.

## [0.0.02] - 2023-03-25

### Fixed
- Package manager issues; `pixi` integration installation docs.

## [0.0.01] - 2023-03-24

First published version: `@gg-web-engine/core`, `three`, `pixi`, `ammo`, and `matter`.

[Unreleased]: https://github.com/AndyGura/gg-web-engine/compare/0.0.89...HEAD
[0.0.89]: https://github.com/AndyGura/gg-web-engine/compare/0.0.88...0.0.89
[0.0.88]: https://github.com/AndyGura/gg-web-engine/compare/0.0.87...0.0.88
[0.0.87]: https://github.com/AndyGura/gg-web-engine/compare/0.0.86...0.0.87
[0.0.86]: https://github.com/AndyGura/gg-web-engine/compare/0.0.85...0.0.86
[0.0.85]: https://github.com/AndyGura/gg-web-engine/compare/0.0.84...0.0.85
[0.0.84]: https://github.com/AndyGura/gg-web-engine/compare/0.0.83...0.0.84
[0.0.83]: https://github.com/AndyGura/gg-web-engine/compare/0.0.82...0.0.83
[0.0.82]: https://github.com/AndyGura/gg-web-engine/compare/0.0.81...0.0.82
[0.0.81]: https://github.com/AndyGura/gg-web-engine/compare/0.0.80...0.0.81
[0.0.80]: https://github.com/AndyGura/gg-web-engine/compare/0.0.79...0.0.80
[0.0.79]: https://github.com/AndyGura/gg-web-engine/compare/0.0.78...0.0.79
[0.0.78]: https://github.com/AndyGura/gg-web-engine/compare/0.0.77...0.0.78
[0.0.77]: https://github.com/AndyGura/gg-web-engine/compare/0.0.76...0.0.77
[0.0.76]: https://github.com/AndyGura/gg-web-engine/compare/0.0.75...0.0.76
[0.0.75]: https://github.com/AndyGura/gg-web-engine/compare/0.0.74...0.0.75
[0.0.74]: https://github.com/AndyGura/gg-web-engine/compare/0.0.73...0.0.74
[0.0.73]: https://github.com/AndyGura/gg-web-engine/compare/0.0.72...0.0.73
[0.0.72]: https://github.com/AndyGura/gg-web-engine/compare/0.0.71...0.0.72
[0.0.71]: https://github.com/AndyGura/gg-web-engine/compare/0.0.70...0.0.71
[0.0.70]: https://github.com/AndyGura/gg-web-engine/compare/0.0.66...0.0.70
[0.0.66]: https://github.com/AndyGura/gg-web-engine/compare/0.0.65...0.0.66
[0.0.65]: https://github.com/AndyGura/gg-web-engine/compare/0.0.63...0.0.65
[0.0.63]: https://github.com/AndyGura/gg-web-engine/compare/0.0.62...0.0.63
[0.0.62]: https://github.com/AndyGura/gg-web-engine/compare/0.0.61...0.0.62
[0.0.61]: https://github.com/AndyGura/gg-web-engine/compare/0.0.60...0.0.61
[0.0.60]: https://github.com/AndyGura/gg-web-engine/compare/0.0.59...0.0.60
[0.0.59]: https://github.com/AndyGura/gg-web-engine/compare/0.0.58...0.0.59
[0.0.58]: https://github.com/AndyGura/gg-web-engine/compare/0.0.57...0.0.58
[0.0.57]: https://github.com/AndyGura/gg-web-engine/compare/0.0.56...0.0.57
[0.0.56]: https://github.com/AndyGura/gg-web-engine/compare/0.0.49...0.0.56
[0.0.49]: https://github.com/AndyGura/gg-web-engine/compare/0.0.48...0.0.49
[0.0.48]: https://github.com/AndyGura/gg-web-engine/compare/0.0.40...0.0.48
[0.0.40]: https://github.com/AndyGura/gg-web-engine/compare/0.0.39...0.0.40
[0.0.39]: https://github.com/AndyGura/gg-web-engine/compare/0.0.38...0.0.39
[0.0.38]: https://github.com/AndyGura/gg-web-engine/compare/0.0.37...0.0.38
[0.0.37]: https://github.com/AndyGura/gg-web-engine/compare/0.0.30...0.0.37
[0.0.30]: https://github.com/AndyGura/gg-web-engine/compare/0.0.28...0.0.30
[0.0.28]: https://github.com/AndyGura/gg-web-engine/compare/0.0.24...0.0.28
[0.0.24]: https://github.com/AndyGura/gg-web-engine/compare/0.0.20...0.0.24
[0.0.20]: https://github.com/AndyGura/gg-web-engine/compare/0.0.18...0.0.20
[0.0.18]: https://github.com/AndyGura/gg-web-engine/compare/0.0.16...0.0.18
[0.0.16]: https://github.com/AndyGura/gg-web-engine/compare/0.0.15...0.0.16
[0.0.15]: https://github.com/AndyGura/gg-web-engine/compare/0.0.05...0.0.15
[0.0.05]: https://github.com/AndyGura/gg-web-engine/compare/0.0.04...0.0.05
[0.0.04]: https://github.com/AndyGura/gg-web-engine/compare/0.0.03...0.0.04
[0.0.03]: https://github.com/AndyGura/gg-web-engine/compare/0.0.02...0.0.03
[0.0.02]: https://github.com/AndyGura/gg-web-engine/compare/0.0.01...0.0.02
[0.0.01]: https://github.com/AndyGura/gg-web-engine/releases/tag/0.0.01
