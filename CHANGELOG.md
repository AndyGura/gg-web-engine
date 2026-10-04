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
- `@gg-web-engine/multiplayer`: `NetworkControllerOptions.clockSyncBurstCount` (default 5) and
  `clockSyncBurstIntervalMs` (default 150): a link that just opened (or reopened) gets a burst of
  clock-sync pings before falling back to `clockSyncIntervalMs`. `ClockSync` gained `ready`,
  `targetOffset` and `advance(localTime)`.

### Changed
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

[Unreleased]: https://github.com/AndyGura/gg-web-engine/compare/0.0.75...HEAD
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
