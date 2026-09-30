# Changelog

All notable changes to GG-Web-Engine are recorded here. Every `@gg-web-engine/*` package ships
together at the version listed, so one section covers `core` and every adapter.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is
`0.0.N` for now: the engine is experimental and the public API can change between any two
releases (see the README's "Current Status").

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
- `LevelLoader.createEntity` now applies an `EntityJson`'s `events` bindings (an optional third
  `blueprints` argument supplies named graphs a binding may reference), parenting the resulting
  binding under the created entity itself so it's torn down whenever that entity is.
- Public sleep API on rigid bodies: `IRigidBodyComponent.isSleeping`/`wakeUp()`/`sleep()`, implemented
  across `ammo`, `rapier2d`, `rapier3d`, and `matter`.

### Fixed
- `matter`: `MatterRigidBodyComponent.rotation`'s setter now calls `Body.setAngle` instead of
  writing `nativeBody.angle` directly, so a rotation write no longer corrupts angular velocity
  (mirrors the existing `Body.setPosition`-based `position` setter).

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

[Unreleased]: https://github.com/AndyGura/gg-web-engine/compare/0.0.73...HEAD
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
