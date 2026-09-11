---
name: gg-engine-core-development
description: Modify packages/core of gg-web-engine — the dimension-agnostic and 2D/3D abstract interfaces, entities, math, and world classes that every rendering/physics adapter implements. Use when the task touches packages/core itself, not app code or a specific adapter package.
---

# Developing packages/core

`packages/core` (`@gg-web-engine/core`) has **no rendering or physics library dependency** — it
only defines abstractions (interfaces, generics, math, entity/world plumbing) that adapter
packages (`packages/three`, `packages/pixi`, `packages/ammo`, `packages/matter`,
`packages/rapier2d`, `packages/rapier3d`) implement. Treat it as the contract layer: changes here
ripple into every adapter and every app.

## Layout

```
src/base/    dimension-agnostic: IComponent, IEntity, clocks, math (Point2/3, Quaternion,
             Matrix4, Box, splines), inputs, GgWorld base class, body-options base
src/2d/      2D specialization: Gg2dWorld, Entity2d, 2D components/interfaces, 2D shapes
src/3d/      3D specialization: Gg3dWorld, Entity3d, 3D components/interfaces, 3D shapes,
             loaders, controllers (camera/car/free-fly), GgCarEntity, MapGraph3dEntity
src/dev/     in-page console + debugger UI, performance meter
```

Each of `base/2d/3d` mirrors the same sub-structure: `components/{physics,rendering}`,
`entities/`, `interfaces/`, `models/`. When adding a concept to 3D, check whether it belongs in
`base/` instead (dimension-agnostic) before duplicating it into both `2d/` and `3d/`.

The Blender-side authoring tool that produces the `.glb`+`.meta` pair `src/3d/loader.ts`'s
`Gg3dLoader.loadGgGlb` reads is **not** part of this package — it lives at the repo-root
`blender-addon/` as a standalone, independently-versioned Blender add-on (see
`blender-addon/README.md`), not shipped inside the `@gg-web-engine/core` npm tarball. If a change
here touches the `.meta` JSON shape (e.g. `GgMeta`, `packages/core/src/3d/models/gg-meta.ts` or
whatever the loader currently expects), bump `GG_META_FORMAT_VERSION` in
`blender-addon/gg_web_engine_exporter/exporter.py` and update `blender-addon/README.md`'s
object-convention table to match — the two sides aren't type-checked against each other.

## Adding a built-in dev-console command

Built-in commands live in each world class's `registerConsoleCommands` override
(`base/gg-world.ts`, `2d/gg-2d-world.ts`, `3d/gg-3d-world.ts`) plus the global ones in
`dev/gg-static.ts`, all via `ggstatic.registerConsoleCommand(world, name, handler, doc?)`. Two
non-obvious constraints apply to both the `doc` string and any message passed to `throw new
Error(...)` inside the handler:

- **Never use `<...>`-style placeholders** (`<name>`, `<x>`). `dev/gg-console.ui.ts` renders
  command output — including a caught handler error — by assigning straight into
  `output.innerHTML`. `<name>` parses as an (unknown, self-closing) HTML tag, and the browser
  silently drops its "content" instead of showing the literal text, so `usage: foo <name>` renders
  to the user as just `usage: foo` with nothing after it — the exact bug that motivated this note.
  Every existing built-in command instead spells placeholders as bracket-free words —
  `NAME`, `X`, `Y`, `Z`, `ANGLE_RADIANS` — or a bare `first-person|third-person`-style choice list.
  Reserve real `<...>` for a `doc` string that deliberately wants actual markup, e.g. `bind_key`'s
  doc links to a key-code reference with a genuine `<a href=...>` tag.
- **Don't pick a command name that is a prefix-extension of another command's name** (e.g. don't
  add `spawn_player` next to the existing `spawn`). `gg-console.ui.ts`'s tab-autocomplete resolves
  a partial input to the *shortest* registered command that starts with what's typed, so typing the
  shorter command's full name locks autocomplete onto it and never reaches the longer one. This is
  why the default-player commands are named `player_spawn`/`player_mode` rather than
  `spawn_player` — they share the harmless `player_` prefix with each other instead of colliding
  with the unrelated `spawn` command.

## Entity naming: only adopt a non-empty native name

`Entity3d`/`Entity2d`'s constructor (and `CharacterController3dEntity`'s) copies `name` from
whichever native component was passed in (`objectBody.name`, `object3D.name`/`object2D.name`,
`characterController.name`), but **only when that native name is non-empty** — an empty string is
left alone so `IEntity`'s own auto-generated fallback (`'e0x' + counter`, set unconditionally by
the `IEntity` base constructor) survives. This matters because every existing physics/rendering
adapter's native component defaults `name` to `''` unless the caller explicitly named it (e.g. via
Blender-authored level content, where object names come from the `.glb`) — assigning
unconditionally, as this code used to, clobbers the entity's only identifier with an empty string
for every ad hoc, console-spawned, or otherwise unnamed entity. This is what silently broke the
`player_spawn`/`player_mode` console commands: the spawned `CharacterController3dEntity` printed
as `spawned "" at ...`, and `player_mode ""` then failed to resolve. When adding a new entity class
that similarly seeds its `name` from a native component, guard the assignment with an `if (native
name truthy)` check the same way, and add a body/mock with the adapter-realistic empty default
(see `test/mocks/body.mock.ts`, `test/mocks/character-controller.mock.ts`) to any test asserting on
spawned-entity names — a test mock that defaults to a non-empty placeholder name (as
`mockCharacterController` used to) hides exactly this bug.

## `tickOrder`: driving a dynamic rigid body before physics `simulate()` runs

`GgWorld`'s tick loop (`base/gg-world.ts`) fires every listener's `tick$` in ascending `tickOrder`
order, but splits that single loop around one fixed point: `IPhysicsWorldComponent.simulate(delta)`
runs exactly once per frame, right where an entity's `tickOrder` crosses `TickOrder.PHYSICS_SIMULATION`
(200). Anything with a **lower** `tickOrder` ticks *before* `simulate()` this frame; anything
**higher** ticks *after* it, once already-integrated. This matters for any entity/controller that
needs to set a dynamic rigid body's `linearVelocity`/`angularVelocity` and have the physics engine
actually integrate that value this same frame (as opposed to reading the body's position/rotation
back out, which only makes sense *after* `simulate()`) — it must use a `tickOrder` below 200, e.g.
`TickOrder.PHYSICS_SIMULATION - 5` (the convention `CharacterController3dEntity` and
`ObjectGrabController`/`Grabbable3dEntity` both use), not the default `TickOrder.OBJECTS_BINDING`
(400) that `Entity3d` itself ticks at to sync a mesh *from* a body's post-`simulate()` transform.
A single entity subclass can't do both (it only has one `tick$`, firing once at its own declared
`tickOrder`) — this is why `Grabbable3dEntity` (extends `Entity3d`, keeps its inherited
post-physics `OBJECTS_BINDING` tick for the mesh sync every other dynamic prop gets) does **not**
drive its own hold-spring from `tick$`; that logic lives in a separate `updateHold()` method that
`ObjectGrabController` (its own entity, `tickOrder = PHYSICS_SIMULATION - 5`) calls once per frame.
Splitting "pre-physics logic" and "post-physics sync" across a controller entity + a driven entity
this way, rather than cramming both into one entity's single tick, is the established pattern here
for anything that needs to act on both sides of `simulate()` — see `PlayerCharacterController`
(camera, post-physics) driving `CharacterController3dEntity` (movement) for the read-only-camera
version of the same split, and `ObjectGrabController` driving `Grabbable3dEntity` for the
velocity-setting version.

A held/driven dynamic body should also be moved via velocity (`linearVelocity`), not by teleporting
`position` directly, if it needs to keep colliding with the world realistically while driven —
`Grabbable3dEntity`'s own doc comment explains why (teleporting risks tunnelling through geometry
then exploding back out from deep penetration on release); this was verified empirically against a
real Ammo world (a sphere driven by `updateHold()` into a static wall stopped exactly at the wall's
surface plus the sphere's own radius, rather than passing through it).

**Two entities at the same `tickOrder` writing to the same body's velocity this tick: last
subscriber wins, and that order is insertion order, not something to rely on.** `addEntity()` pushes
onto `tickListeners` and re-sorts by `tickOrder` (`Array.prototype.sort` is spec-stable), so ties
fire in whatever order the entities were `addEntity()`'d in - the first-added entity's `tick$` fires
first among same-`tickOrder` peers, every frame. A driver that unconditionally *overwrites* a
dynamic body's `linearVelocity` each tick (rather than reading-then-combining) silently discards
whatever an earlier same-tick write already set, with no error or warning - and which write "wins"
then depends on app-level `addEntity()` ordering that has nothing to do with either driver's own
code. Found via `Grabbable3dEntity`/`ObjectGrabController`: a currently-held prop is excluded from
its own holder's collision entirely now (see `ICharacterController3dComponent.ignoredBodies`), so the
holder's own `pushDynamicBody`-style shove no longer applies to it at all - but *other* dynamic bodies
(not the holder) can still legitimately bump a held prop while `Grabbable3dEntity.updateHold()`'s
spring is also writing its velocity the same tick, and this same hazard applies to them: an earlier
same-tick push landing on the object, then getting silently overwritten by the spring's own (much
smaller, since the object is usually already close to its hold point) velocity before `simulate()`
ever integrates the push. `updateHold()`'s fix generalizes beyond just this one scenario: it never
*reduces* a component of the object's velocity that's already pointed towards the hold point faster
than the spring itself would carry it (`max(current speed towards target, spring's own speed)` along
the spring's direction, rather than always replacing outright - see that method's doc). Any future
controller that sets a shared dynamic body's velocity outright each tick should consider the same
"never fights a faster push already headed the right way" pattern rather than assuming it's the only
writer that tick.

## Collision groups can't express "these two specific bodies don't collide"

`ownCollisionGroups`/`interactWithCollisionGroups` filtering is bidirectional AND logic: a pair
collides only if *each* side's own group appears in the *other* side's mask (see the `tickOrder`
section above's sibling note on this in the bidirectional-filtering context). This flat bitmask
model has a real limitation worth knowing before reaching for it to solve "exclude collision
between exactly these two bodies, but leave both still colliding with everything else": if both
bodies must independently keep colliding with some shared third group (almost always true — e.g.
both need to keep colliding with the level's `mainCollisionGroup` static geometry), that shared bit
alone satisfies the AND-check for the *pair* you wanted excluded too, no matter what other bits get
added or removed from either side. Removing a "the other body's own dedicated group" bit from one
side's mask only helps when that bit was the *only* thing making the pair collide in the first
place — it does nothing if a broader shared group (typically `mainCollisionGroup`) is also present
on both sides, which is the normal/default setup for any two bodies that both need to collide with
ordinary level geometry. There is no way to route around this with cleverer bit assignment; it's a
property of AND-based two-sided filtering, not a configuration mistake to fix by rearranging groups.

Found via `Grabbable3dEntity`/`ObjectGrabController`: `holderCollisionGroups` was meant to stop a
carried prop from colliding with its holder by removing the holder's dedicated group from the
prop's `interactWithCollisionGroups`, but both the holder and the prop keep `mainCollisionGroup` in
their own group/mask (needed to keep colliding with the level), so the pair kept colliding
regardless of that setting — confirmed empirically two ways: holding a prop and deliberately
wedging it under the holder's own capsule (looking down to place it at your own feet) launched the
holder into the sky once the object's velocity spring and the character controller's own
overlap-correction fed back into each other through the holder's camera; and separately, sprinting
into a prop resting on the ground directly ahead (an entirely ordinary way to carry something) got
the holder stuck against its own held object, since the holder's own movement genuinely still
collided with it. Group/mask filtering was never going to fix either, no matter how it was
rearranged — the actual fix is `ICharacterController3dComponent.ignoredBodies`, a real per-pair
exclusion checked directly by each adapter's own sweep/overlap-recovery query rather than via
broadphase bits at all (`ObjectGrabController.tryGrab()`/`throwHeld()`/`dropHeld()` add/remove the
held object's body from `holder.characterController.ignoredBodies`) — see
`gg-engine-physics-adapter`'s own section on this member for the two adapter-side implementation
strategies (a native exclusion predicate where the engine's sweep call supports one, e.g. Rapier's
`computeColliderMovement filterPredicate`; otherwise temporarily pulling the ignored body out of the
collision world's broadphase for the duration of each query, e.g. Ammo — checked: this pinned
Ammo.js embind build exposes no native per-pair mechanism like Bullet's own
`btCollisionObject::setIgnoreCollisionCheck` at all, absent from both the generated bindings and the
compiled `.wasm`'s own symbols). `holderCollisionGroups` itself was removed from
`ObjectGrabControllerOptions` once `ignoredBodies` shipped — it never actually worked (per the
argument above) and there was no scenario where keeping a permanently-inert option around was better
than deleting it. `Grabbable3dEntity.grab()` still takes its own `ignoreCollisionGroups` parameter
directly (a generic "exclude these groups while held" knob with no built-in notion of "the holder"),
and `ObjectGrabController.clampAwayFromHolder()` (keeping the hold point geometrically outside a
cylinder around the holder's capsule) still exists alongside `ignoredBodies` too, but purely as a
cosmetic finishing touch (stops a prop from visibly poking into the holder's own model at the instant
it's picked up) — see that class's own doc for the current division of labor between the two.

## `characterControllerSelfHitSkip()` - the shared fix for "my own capsule self-hits a raycast starting on its axis"

Exported from `packages/core/src/3d/entities/controllers/input/character-controller-self-hit-skip.ts`
(and from the package root), `characterControllerSelfHitSkip(origin, direction, capsuleCenter, up,
radius, centersDistance, maxDistance, skin = 0.05)` returns a safe forward-skip distance, from `origin`
along `direction`, for raycasting from a point on or inside a character controller's own capsule (a
first-person camera, or a third-person camera's look target on the character's centerline) without
ever reading an exit point off the raycast result itself. Two unrelated call sites need exactly this:
`ObjectGrabController.tryGrab()`'s pick-up ray and `PlayerCharacterController`'s third-person
`cameraCollision` ray - both hit the same underlying problem and share this one helper instead of each
re-deriving it.

**Why a raycast result can't supply this distance itself**: `RaycastOptions` has no per-call "exclude
this body" hook, and a raycast whose origin already lies inside a shape has no reliable way to report
where it *exits* that shape either - an adapter using a "solid" ray mode reports the containing shape
hit at distance `0`, from the origin again, not its far boundary (Rapier3d's
`castRay(..., solid: true, ...)`), while Ammo's `rayTest` simply can't see the shape containing its own
origin at all and silently omits it. Building a retry on whatever point such a raycast happens to
report is therefore adapter-dependent by construction: on Rapier (whose solid-ray mode *always*
prefers the containing capsule over anything genuinely beyond it) a retry nudged forward from that
reported point lands right back inside the same capsule, self-hitting again every time - `tryGrab()`
went through exactly this as a real regression, working fine on Ammo (whose `rayTest` never needed the
retry to begin with, since it already skips its own containing shape transparently) while silently
breaking pick-up entirely on Rapier.

**The fix computes the skip geometrically instead, by sphere-tracing the capsule's own exact distance
field**: a capsule is exactly "every point within `radius` of its own medial segment" (the line
between its two hemisphere centers, `centersDistance` apart, clamped to that segment when a point's
axial projection falls outside it), so `radius - distanceToSegment(point)` is the *exact* signed
distance from any point to the capsule's surface - not an approximation. Starting at `origin`, each
iteration advances by exactly that remaining distance and re-measures; because the distance field is
exact and 1-Lipschitz, this can never overshoot past the real exit point, and converges to it (20
iterations gets well under float precision for realistic capsule sizes - verified empirically). The
result plus `skin` (0.05 by default, ordinary float/engine surface tolerance) is clamped to at most
90% of `maxDistance` (the full ray length in play at the call site) so a capsule large relative to a
short ray can't consume the entire cast.

This replaced an earlier, simpler attempt that skipped a flat `radius + skin` regardless of direction
or where on the capsule `origin` actually sat - correct only when `origin` is in the capsule's
cylindrical midsection and `direction` is close to horizontal. That assumption broke on a real
gameplay report at `ObjectGrabController`'s own default settings: a first-person camera sits
`eyeHeight` (0.7 by default) above the character's capsule center, taller than the capsule's own
half-height (`centersDistance / 2`, 0.5 at the example's own player settings) - so the camera actually
starts inside the *rounded top cap*, not the cylindrical body - and a real downward-pitched look
toward a low, close prop meant the flat skip landed the retry still measurably inside the capsule,
self-hitting again and leaving the prop permanently ungrabbable at that exact position (found by
reproducing the reporter's own exact in-game position, read from the dev console's entity inspector,
in a jest harness matching the real scene geometry - not guessed). Sphere-tracing has no separate
"which part of the capsule, which look angle" case to get wrong, since the same distance field
describes the cylindrical body and both rounded caps continuously - this is also why the flat-`radius`
version's own prior fix (see below) needed `holderClearance()` in the first place: that version
couldn't safely handle *any* pitch, so it had to fall back to a worst-case bound for the ones it
couldn't.

The `holderClearance()`-sized skip that came before the flat-`radius` attempt (`radius +
centersDistance / 2 + margin`, `ObjectGrabController`'s own worst-case bound for *any* direction) is
still used, unrelated to the skip distance itself, as the *trigger* for whether to retry at all:
`ObjectGrabController.tryGrab()` only calls into `characterControllerSelfHitSkip()` as a retry, not on
every cast - it casts once from the camera's actual, un-skipped position first, and only retries when
that first hit is closer than `holderClearance()` could ever put a genuinely different object (i.e.
plausibly the holder's own capsule) - this is what lets a prop close enough to be found before any
self-hit would even occur get grabbed directly, without ever needing the skip at all.

This can't be replaced with checking `result.hitBody?.entity === holder` instead (a more "obviously
correct"-looking identity check) - self-hit resolution isn't reliable across every adapter in the
first place: `Rapier3dCharacterControllerComponent`'s own doc notes its collider is never registered
in `Rapier3dWorldComponent.handleIdEntityMap` at all, so a self-hit there always resolves to
`hitBody: undefined`, indistinguishable by identity from any other untracked hit. The distance-based
heuristic works identically regardless of whether a given adapter can resolve the self-hit's identity
at all.

Regression coverage: `character-controller-self-hit-skip.spec.ts` covers the helper directly (default
skin, custom skin, the pitched-above-midsection case, the `maxDistance * 0.9` clamp).
`object-grab.controller.spec.ts`'s `grabbing` describe block has the "found immediately, no retry"
case, the "retries by sphere-tracing past the holder's own capsule" case, and the "does not retry past
a hit farther than `holderClearance()`" case (a real obstacle still correctly blocks the grab).
`packages/rapier3d/test/components/rapier-3d-object-grab-integration.spec.ts` exercises the whole
mechanism end-to-end against a real `Rapier3dWorldComponent` and character-controller collider,
including the exact position/rotation the gameplay report above was reproduced from - real,
adapter-specific regressions like this one are worth reproducing at that level, not just against the
core-level mocked-raycast tests, precisely because the bug lived in how a real adapter's raycast
semantics interact with this helper, not in the helper's own math in isolation.

## The TypeDocRepo generic pattern — read this before touching interfaces

Core interfaces don't hardcode adapter types. Instead each dimension defines a "type doc
repository" — a plain type mapping role names to the types an adapter must supply — and every
interface is generic over it:

```typescript
// packages/core/src/2d/gg-2d-world.ts
export type VisualTypeDocRepo2D = {
  factory: IDisplayObject2dComponentFactory;
  displayObject: IDisplayObject2dComponent;
  renderer: IRenderer2dComponent;
  rendererExtraOpts: {};
  camera: ICamera2dComponent;
  texture: unknown;
};
export type PhysicsTypeDocRepo2D = {
  factory: IPhysicsBody2dComponentFactory;
  rigidBody: IRigidBody2dComponent;
  trigger: ITrigger2dComponent;
};
```

`IVisualSceneComponent<D, R, VTypeDoc>`, `IPhysicsWorldComponent<D, R, PTypeDoc>`, etc. are generic
over these repos with a default equal to the base (unbound) interface. An adapter package
instantiates concrete versions (e.g. `ThreeVisualTypeDocRepo`, `Rapier2dPhysicsTypeDocRepo` in its
own `types.ts`) and implements the interfaces parametrized with them. `Gg2dWorldTypeDocRepo` /
`Gg3dWorldTypeDocRepo` combine a `vTypeDoc` + `pTypeDoc` pair, with `...VPatch`/`...PPatch` utility
types letting an app specify only one side and utility types like `TypedGg2dWorld<VW, PW>` compose
a full app-level world type from an independently-typed visual world and physics world. **Don't
break this indirection** — e.g. never have a base interface reference a concrete adapter type
directly, and when adding a new capability to a component interface, add the new type to the
relevant `TypeDocRepo` rather than hardcoding it.

## Interfaces that are the actual public contract

Changing any of these is a breaking change for every adapter package — grep
`implements I<Name>` across `packages/*/src` before editing, and plan to update every hit:

- `IComponent`, `IWorldComponent` (base)
- `IPhysicsWorldComponent` / `IVisualSceneComponent` (+ 2D/3D specializations)
- `IRigidBodyComponent`, `ITriggerComponent`, `IBodyComponent` (+ 2D/3D)
- `IDisplayObjectComponent`, `IRendererComponent`, `ICameraComponent` (+ 2D/3D)
- `IRaycastVehicleComponent`, `ICharacterController3dComponent` (3D only)
- `IEntity`, `IRenderableEntity`, `IRendererEntity`
- The factory abstracts in `2d/factories.ts` / `3d/factories.ts`

## Math & helpers

`Point2`/`Point3`/`Point4` are plain `{x,y,...}` data objects (not classes) so any adapter's
native vector can satisfy them structurally. `Pnt2`/`Pnt3`/`Qtrn` (in `base/math/`) are static
helper namespaces (add, lerp, `O` origin constant, `lookAt`, etc.) operating on those plain shapes
— prefer extending these over introducing class-based vector types, to keep the structural-typing
story intact for adapters. Both `Pnt2` and `Pnt3` expose named axis constants — `Pnt2.X`/`Pnt2.Y`/
`Pnt2.nX`/`Pnt2.nY` for 2D, `Pnt3.X`/`Pnt3.Y`/`Pnt3.Z`/`Pnt3.nX`/`Pnt3.nY`/`Pnt3.nZ` for 3D (plus
each namespace's own `O` origin) — use those instead of spelling out a unit-vector literal when the
value represents a world axis or up-vector, not an arbitrary position.

**Every 3D world is Z-up, always** — see `CLAUDE.md`'s "Non-obvious repo facts" section for the
full statement; `Pnt3.Z` is "up" everywhere in this engine's 3D code (core, every adapter, every
example), with no per-world way to change it. Any new 3D interface/entity/math helper you add
should assume this rather than taking an axis convention as a parameter.

## Build & test

```bash
cd packages/core
npm install
npm run build   # runs `update-version` (regenerates src/version.ts from package.json) then tsc
npm test        # jest + ts-jest + jsdom
```

Never hand-edit `src/version.ts` — it's generated. Tests live under `test/`, mirroring `src/`
paths, with shared fakes in `test/mocks/` (`body.mock.ts`, `object.mock.ts`, `world.mock.ts`,
`raycast-vehicle.mock.ts`). New core logic should get a `.spec.ts` there, not in an adapter
package, unless it's genuinely adapter-specific behavior.

### TypeScript 6 / Jest 30 pitfalls (hit upgrading off TS 5.5 / Jest 29)

- **`typescript` is pinned below major 7.** TS 7 is the native (Go-ported) compiler; `ts-jest`
  declares `peerDependencies.typescript: ">=4.3 <7"` and does not support it yet. Every package's
  jest-based tests would fail to even transform if bumped to 7 — stay on the latest TS 6.x release
  until `ts-jest` adds TS 7 support.
- **`tsconfig.base.json` needs `"ignoreDeprecations": "6.0"`.** TS 6 turns `moduleResolution: "node"`
  (classic/node10), bare `baseUrl` (without `paths`), and `esModuleInterop: false` into hard errors
  by default — this repo still relies on all three. `ignoreDeprecations` silences them for now; TS 7
  drops the option entirely and removes these features outright, so migrating off them (to
  `moduleResolution: "bundler"`, dropping `baseUrl`, enabling `esModuleInterop`) is required before
  the engine can move past TS 6 — that migration touches emitted-module resolution semantics for
  every published adapter and hasn't been done yet.
- **`tsconfig.base.json` needs an explicit `"lib"` array (`["ES2020", "DOM"]` currently).** With no
  `lib` set, TS infers a lib list purely from `target` (`es2016` → `ES2016,DOM`), and TS 6 got
  stricter about enforcing that inferred list than TS 5 was — `Object.entries`/`Object.values`
  (ES2017) and `Array.prototype.flatMap` (ES2019), used in `src/`, stopped type-checking. Setting
  `lib` explicitly only affects which global declarations type-check; it doesn't change emitted
  syntax (`target` still controls that).
- **A package's `tsconfig.json` needs an explicit `"types"` array if its tests use ambient globals.**
  With no `"types"` compilerOption, TS is supposed to auto-include every `@types/*` package found by
  walking up `typeRoots` from the tsconfig's directory — under TS 5 this silently picked up the
  workspace root's hoisted `node_modules/@types/jest` (and `@types/node`, for test code using
  Node's `global`) with no declaration anywhere in this package. Under TS 6 that walk no longer
  reaches far enough in this nested-workspace layout (`packages/core` has no local
  `node_modules`), so `describe`/`it`/`expect`/`global` all stopped resolving in `test/**/*.spec.ts`
  with `error TS2593: Cannot find name 'describe'` (etc.), even though `npm run build` (which
  excludes `test/`) kept compiling clean. Fix: add `"types": ["jest", "node"]` to the *package's own*
  `tsconfig.json` (not the shared base — packages without jest tests, `pixi`/`three`, don't need
  it), and add `@types/node` as an explicit `devDependency` instead of relying on it being hoisted
  in by some other package. Every adapter with a jest suite (`ammo`, `matter`, `rapier2d`,
  `rapier3d`, plus `core`) needs this same pair of changes.
- **Jest 30 dropped the `toThrowError` matcher alias** (`@types/jest` 30 no longer types it) — it's
  `toThrow` now, same signature. A grep for `toThrowError` across `test/` after bumping `jest`/
  `@types/jest` past 29 catches every call site at once.

## Local dev workflow: core + adapter + example, all in watch mode

`packages/*` (not `examples/*`) is an npm workspace, defined by the root `package.json`. That's
the whole mechanism: `npm install` at the repo root symlinks every adapter's
`@gg-web-engine/core` (and inter-adapter, if any) dependency straight to the local `packages/*`
directories — no version bump, no publish, no manual `npm link` bookkeeping. `packages/*/tsconfig.json`
additionally declare TypeScript project `references` to `../core`, and the root `tsconfig.json` is
a "solution" file referencing every package, so a single `tsc -b` (TypeScript's project-reference
build orchestrator) rebuilds core and every adapter incrementally, in the correct dependency order,
from one process.

Put together, this gives you one long-running command that keeps every package's `dist/` current
as you edit `.ts` anywhere in `packages/`:

```bash
npm install       # one-time bootstrap: links the packages/* workspace (root package.json)
npm run build     # one-time full build (includes the non-TS asset copies — see caveats below)
npm run build:watch  # `tsc -b --watch` at repo root — leave this running
```

To also see the change live in a specific example's dev server, link that example once and start
it (see `gg-engine-examples`):

```bash
bash etc/switch_example_to_local_gg.sh examples/<example-dir>
cd examples/<example-dir> && npm start   # webpack-dev-server, also watches for changes
```

With both of those running, **editing `packages/core/src` (or any adapter's `src`) is reflected in
the browser with no other step**: `tsc -b --watch` notices the source change and re-emits that
package's `dist/` (and, transitively, any adapter whose public types changed); webpack's own
watcher notices the adapter's `dist/*.js` changed on disk (it's resolved through a plain symlink,
so this is indistinguishable to webpack from a normal file edit) and rebuilds/reloads the bundle.
This was verified end-to-end while writing this section: an edit to `packages/core/src/index.ts`
propagated through `tsc -b --watch` into `packages/core/dist`, was picked up by a `webpack --watch`
build of an example with no manual rebuild, and landed in the emitted bundle.

Caveats:

- `tsc -b --watch` only rebuilds what `tsc` itself emits. `ammo` has a non-TS asset copy step in
  its own `build` script (copying the prebuilt `ammo.js` WASM glue into `dist/`) that `tsc -b`
  doesn't run. Do one full `npm run build` (root script) first so those assets exist, then rely on
  `build:watch` for iterating on `.ts` changes; re-run `npm run build` for that package if you
  touch those vendored assets. `three` has no such step — it imports the `three` library's own
  `examples/jsm`/`addons` subpaths directly rather than vendoring a copy (see
  `gg-engine-visual-adapter`), so a plain `tsc -b` rebuilds it completely.
- `npm run build` (the per-package `build` script, or the root `npm run build`) and `tsc -b` are
  two different incremental caches; running one doesn't make the other skip work, and mixing them
  (e.g. `rm -rf dist` then `tsc -b` alone) will skip the asset-copy step above. This is expected,
  not a bug — treat `npm run build` as "full, correct build" and `tsc -b --watch` as "fast
  iteration on top of a build that already ran once."
- This is exactly what CI (`.github/workflows/pull_request_build.yml`) does too (`npm install` at
  the root, then build/test each adapter), so any core interface change should be validated the
  same way locally: run `npm install` at the repo root, then `npm run build && npm test` inside
  each affected `packages/<adapter>` (or all of them, for an interface-level change).
- `switch_example_to_local_gg.sh` always resets the example's `package.json`/`tsconfig.json` to
  their committed state before patching (so re-running it is safe); undo it with
  `etc/restore_example_from_local_gg.sh examples/<example-dir>` to go back to the published
  `@gg-web-engine/*` versions.
- If you ever add a new `packages/<name>/tsconfig.json` (new adapter package) or otherwise touch
  the composite-project setup: every package's tsconfig explicitly sets `rootDir` and
  `tsBuildInfoFile` (both under `./dist/`) alongside `outDir`/`baseUrl`, and this is load-bearing,
  not decoration. With `composite: true` (set once, in `tsconfig.base.json`) but `rootDir`/
  `tsBuildInfoFile` left to their defaults, both `tsc -b` and even a plain per-package `tsc`
  non-deterministically emitted output nested under a stray `dist/src/` (or, for packages whose
  `include` pattern already starts with `src/`, dropped the top-level `dist/index.js` entirely —
  breaking `main`/`types` resolution for consumers) and left an orphaned `tsconfig.tsbuildinfo` at
  the package root instead of inside `dist/`, which then made subsequent builds silently believe
  stale/deleted output was still up to date. Don't remove these two options without re-verifying
  `dist/` layout with a full `rm -rf packages/*/dist && npm run build` afterward — a broken adapter
  package.json (`main: dist/index.js` pointing at a file that doesn't exist) reads as a total build
  failure only when something outside this repo actually imports the package; jest doesn't catch
  it because `moduleNameMapper` bypasses `dist/` for `@gg-web-engine/core` entirely.

## Before starting non-trivial work

Skim `docs/tasks.md` and `milestones.md` — they're a maintained backlog of known architectural gaps
(non-null assertions to remove, rotation-composition FIXME in the 3D loader, DI/event-bus work,
etc.) and may already describe the exact task, its rationale, and acceptance criteria.

## Keep this skill current

This file is read by future agents working on `packages/core`, not by end users of the engine. If
you hit a pitfall it doesn't mention — a build/test step that failed in a non-obvious way, a
generic/type-inference dead end, an interface change that broke more adapters than expected — or
something written here turns out to be wrong or incomplete and you had to dig out the real
answer, add a short note (what went wrong, why, the fix) before finishing the task. Prefer
folding it into the relevant existing section over appending an unstructured log at the bottom.
