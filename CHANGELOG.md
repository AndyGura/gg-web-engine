# Changelog

All notable changes to GG-Web-Engine are recorded here. Every `@gg-web-engine/*` package ships
together at the version listed, so one section covers `core` and every adapter.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is
`0.0.N` for now: the engine is experimental and the public API can change between any two
releases (see the README's "Project status").

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
- Example-first JSDoc (a one-line summary plus an `@example` snippet) on the main public entry
  points, visible in editors and in the published `.d.ts` files: `Gg3dWorld`/`Gg2dWorld` with
  `addPrimitiveRigidBody`/`addRenderer`, `GgWorld.init`/`start`/`addEntity`/`removeEntity`,
  `LevelLoader.loadLevel`/`registerClass`/`serializeLevel`, `Gg3dLoader.loadGgGlb`,
  `PlayerCharacterController`/`PlayerCharacterController2d`, `GgCarEntity`,
  `GgCarHandlingController`, `RaycastVehicle3dEntity`, `FreeCameraController`,
  `OrbitCameraController`, `KeyboardInput`, `LoadingScreen`, `Network3dController`/
  `Network2dController`, and each adapter's scene/world class (`ThreeSceneComponent`,
  `PixiSceneComponent`, `AmmoWorldComponent`, `Rapier3dWorldComponent`, `Rapier2dWorldComponent`,
  `MatterWorldComponent`).

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

[Unreleased]: https://github.com/AndyGura/gg-web-engine/compare/0.0.81...HEAD
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
