---
name: gg-engine-app-development
description: Build an application, game, or simulation on top of gg-web-engine (as a consumer of @gg-web-engine/* npm packages). Use when the task is to write app/game code that uses the engine, not to modify the engine itself.
---

# Building apps with gg-web-engine

This skill is for writing consumer code against the published `@gg-web-engine/*` packages —
gameplay, scenes, UI glue. It does **not** cover modifying the engine's own packages; for that see
`gg-engine-core-development`, `gg-engine-visual-adapter`, or `gg-engine-physics-adapter`.

## Mental model

`GgWorld` (via `Gg3dWorld` or `Gg2dWorld`) is the root object. It composes two independent,
swappable halves that must share dimensionality (both 2D or both 3D):

- **visualScene** — a rendering backend component (`@gg-web-engine/three` for 3D,
  `@gg-web-engine/pixi` for 2D).
- **physicsWorld** — a physics backend component (3D: `@gg-web-engine/ammo` or
  `@gg-web-engine/rapier3d`; 2D: `@gg-web-engine/matter` or `@gg-web-engine/rapier2d`).

Either half can be `null`/omitted if you only need rendering or only physics. Both halves are
optional generics on `GgWorld`, so entities gracefully no-op the missing side.

An **Entity** (`Entity3d`/`Entity2d`) pairs a visual display object with a physics body and keeps
their transforms in sync each tick. Renderer, trigger, raycast vehicle, and the built-in
`GgCarEntity` are all specialized entities/components layered on top of this.

## Setup

```bash
npm install --save @gg-web-engine/core
# pick exactly one visual + one physics package of matching dimensionality:
npm install --save @gg-web-engine/three @gg-web-engine/ammo        # 3D
# or
npm install --save @gg-web-engine/pixi @gg-web-engine/rapier2d     # 2D
```

Check `peerDependencies` in the chosen adapter packages' `package.json` — `three`/`pixi.js`/the
Rapier WASM build are pinned to exact versions per engine release; install matching versions
alongside (or let npm peer resolution pick them). All `@gg-web-engine/*` packages in one app must
share the same version.

## Bootstrap pattern

```typescript
import { Gg3dWorld, Pnt3, Qtrn } from '@gg-web-engine/core';
import { ThreeSceneComponent } from '@gg-web-engine/three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';

const world = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new AmmoWorldComponent(),
});
await world.init(); // must await before touching factories/renderers

const renderer = world.addRenderer(
  world.visualScene!.factory.createPerspectiveCamera(),
  document.getElementById('gg') as HTMLCanvasElement, // element must already exist in DOM
);
renderer.position = { x: 12, y: 12, z: 12 };
renderer.rotation = Qtrn.lookAt(renderer.camera.position, Pnt3.O);

world.addPrimitiveRigidBody({
  shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 1 } },
  body: { dynamic: false },
});

world.start(); // starts the tick clock (visual RAF loop + physics simulate())
```

The 2D equivalent (`Gg2dWorld`) uses `Shape2DDescriptor` (`SQUARE`/`CIRCLE`) and `Point2`/`number`
rotation instead of quaternions.

## Where to find capabilities

- **Available 3D shapes**: `Shape3DDescriptor` in `packages/core/src/3d/models/shapes.ts` —
  `PLANE`, `BOX`, `CONE`, `CYLINDER`, `CAPSULE`, `SPHERE`, `COMPOUND`, `CONVEX_HULL`, `MESH`.
- **Available 2D shapes**: `Shape2DDescriptor` in `packages/core/src/2d/models/shapes.ts` —
  currently `SQUARE`, `CIRCLE` only.
- **Body options** (`Partial<Body3DOptions>`/`Body2DOptions`): `mass`, `dynamic`, friction/
  restitution, collision groups — see `packages/core/src/base/models/body-options.ts`.
- **Ready-made controllers** (attach to entities via `entity.addController(...)`):
  `FreeCameraController`, `OrbitCameraController`, `CarKeyboardHandlingController` /
  `GgCarKeyboardHandlingController` in `packages/core/src/3d/entities/controllers/input/`.
- **GLB scene loading (3D)**: GLB + `.gg` meta sidecar, driven by `packages/core/src/3d/loader.ts`
  and the adapter's own `<lib>-loader.ts` (e.g. `ThreeLoader`). Levels are authored in Blender and
  exported with the `GG Web Engine Exporter` add-on in `blender-addon/` (see `blender-addon/README.md`
  for install/usage). See the `examples/glb-loader-*` examples.
- **Level JSON loading (2D & 3D)**: `world.loader` turns a JSON document of entities into world
  content, with built-in `"Primitive"`/`"Trigger"`/`"Camera"`/`"Glb"`/`"GgCar"`/`"MapGraph"` (the
  last four 3D only) classes and support for app-registered custom classes. Loading resolves to a
  group entity holding everything the level
  produced, so `world.removeEntity(level, true)` tears the whole level back down in one call, and
  `level.getChildEntityByName(name)`/`world.getEntityByName(name)` find a named entity afterwards —
  see the dedicated `gg-engine-level-json` skill, and the `examples/primitives-*` examples for
  complete demos (all four build their scene from a hardcoded `LevelJson` object).
- **Raycasting**: `world.physicsWorld.raycast({ from, to, collisionFilterGroups?, collisionFilterMask? })`.
- **Collision groups**: `world.physicsWorld.registerCollisionGroup()` /
  `deregisterCollisionGroup(group)`; every body has `mainCollisionGroup` set by default. See the
  `examples/collision-groups-*` examples for group/mask usage.
- **Dev tools**: `packages/core/src/dev/` — `gg-console.ui.ts` (in-page command console),
  `gg-debugger.ui.ts` (physics wireframe overlay toggle), `performance-meter.entity.ts`. See
  "Debugging with the dev console" below — it's the preferred way for an agent to inspect/mutate a
  *running* game instance instead of poking internals through devtools.
- **Vehicles**: `RaycastVehicle3dEntity` / `GgCarEntity` in `packages/core/src/3d/entities/` for
  raycast-based car physics; see `examples/ammo-car-three-ammo` and `examples/shooter-three-ammo`.

## Framework integration

For Angular/React/Vue/vanilla wiring patterns, don't reinvent — copy the structure of
`examples/framework-angular-three-ammo` or `examples/framework-react-three-rapier3d`. Typical
approach: create the `GgWorld` in a lifecycle hook (`ngOnInit`/`useEffect`) once a canvas ref
exists, call `world.dispose()` on teardown.

## Debugging with the dev console

Every `GgWorld` wires itself into one global command console (`packages/core/src/dev/`). This is
the preferred way to inspect or mutate a *running* game instance — including from a browser
automation session — instead of reverse-engineering bundled/minified internals through devtools.
Commands go through the game's own public API (entity `.position`/`.rotation` setters, world
getters, etc.), so they can't desync physics from rendering the way poking a raw property would.

### Turning it on

```typescript
import { GgStatic } from '@gg-web-engine/core';
GgStatic.instance.devConsoleEnabled = true; // dev-only; gate behind an env/query flag for prod
```

This does two independent things:
- Enables the backquote (`` ` ``) key to toggle the visual console UI (`gg-console.ui.ts`) — a
  draggable panel with input, scrollback, ↑/↓ command history, and tab-style autocompletion.
- Creates the `GgStatic` singleton and publishes it as `window.ggstatic`. Note this second part
  happens from *any* access to `GgStatic.instance` (e.g. `GgStatic.instance.showStats = true`),
  with or without `devConsoleEnabled`. Until some access happens, worlds queue their per-world
  command registration on a `ggstatic_added` window event, so touch `GgStatic.instance` once
  early (before or right after creating the first `GgWorld`) if you want per-world commands
  registered from the start.

### Driving it headlessly — this is what an agent should use

`window.ggstatic` is a real scriptable object; the visual panel is just one frontend for it. From
a browser automation tool (e.g. `claude-in-chrome`'s `javascript_tool`, or plain DevTools),
evaluate:

```javascript
await window.ggstatic.console('set_position player 10 0 5')                        // one line, same parsing as the UI input box
await window.ggstatic.runConsoleCommand('set_position', ['player', '10', '0', '5']) // same, pre-split args
```

Both resolve to a string (HTML with color `<span>`s, as shown in the visual console; strip tags
if consuming it programmatically). Neither call needs `devConsoleEnabled` true, the backquote key,
or the panel visible — they work as soon as `window.ggstatic` exists.

### Built-in commands

Global (always available): `commands` (list all available commands), `help <name>` (print a
command's doc string), `worlds` (list worlds), `world [name]` (get/select the active world —
world-scoped commands only run while their world is selected; `GgWorld.documentWorlds` lists all
worlds and the first one created is auto-selected), `stats_panel [0|1]`, `debug_panel [0|1]`,
`bind_key <code> <command> [args...]` / `unbind_key <code>` (bind a command to a keyboard key —
handy for a cheat-code hotkey).

Per-world, registered by the base `GgWorld` (so identical for `Gg2dWorld`/`Gg3dWorld`):
`timescale [float]`, `fps_limit [int]`, `renderers`, `debug_view [0|1] [rendererName]` (physics
wireframe overlay), `performance [avg|peak] [sampleCount]`, and three **generic, dimension-agnostic
entity commands that need no game-rules knowledge**:

- `entities [nameFilter?]` — list every entity's name and class in the selected world (`children`
  is already a flat list, nested entities included), optionally filtered by a substring.
- `entity <name>` — dump one entity's class, active/visible flags, position/rotation (if it has
  any — printed generically via duck-typing, so this works for both 2D and 3D entities), parent,
  and children names.
- `remove <name> [dispose=0|1]` — `world.removeEntity`, dispose defaults to on.
- `step [ms]` — advance the world clock by exactly one manual tick of `ms` milliseconds (default
  `8`, i.e. `1000/120`), for frame-by-frame physics debugging. Only works while the world is
  paused (`timescale 0`) — it rejects otherwise, since stepping and letting the clock run freely
  don't mix. `worldClock.elapsedTime` genuinely advances by `ms` (never throttled by `fps_limit`),
  so anything keyed off elapsed time — animation mixers, tweens/lerps, child clocks from
  `world.createClock()` — progresses correctly frame by frame; the world just stays paused (no
  automatic ticking resumes) until you explicitly raise `timescale` again.

`Gg2dWorld`/`Gg3dWorld` each additionally register their own copies of a few commands whose
argument *shape* differs by dimension (mirroring how `addPrimitiveRigidBody` and its position/
rotation args already differ) — same command names, different parsing:

- `gravity` — 3D takes a `z` scalar or a full `x y z` vector; 2D takes a `y` scalar or `x y`.
- `set_position <name> <x> <y> [z]` — teleport any named entity that has a `.position` (3D takes
  `x y z`, 2D takes `x y`). This is the generic "teleport" command — it works on *any* named
  entity, not just a "player", since it goes through the same `Entity3d`/`Entity2d` position
  setter gameplay code uses, keeping physics and rendering in sync.
- `set_rotation <name> ...` — 3D accepts either 3 numbers (Euler angles, radians, converted via
  `Qtrn.fromEuler`) or 4 (a raw quaternion `x y z w`); 2D takes a single angle in radians.
- `spawn <shape> <x> <y> [z] [dynamic=0|1]` — drop a default-sized primitive rigid body at a point
  for probing physics/collisions without touching game code. 3D shapes: `BOX|SPHERE|CYLINDER|
  CONE|CAPSULE|PLANE`; 2D shapes: `SQUARE|CIRCLE`. `dynamic` defaults to `1` (falls under gravity).

Pausing is already covered by `timescale 0` (and the underlying `world.pauseWorld()`/
`resumeWorld()` methods) — there's no separate `pause`/`resume` command. `timescale 0` + `step`
together give a full pause/frame-advance/resume debug loop: `timescale 0`, then `step` as many
times as needed, then `timescale 1` (or whatever the original scale was) to resume normally.

Beyond these, there is **no built-in game-specific introspection** (health, inventory, win
conditions, "the player" as a concept distinct from any other named entity) — that state is
app-specific, so it's on the app (or the debugging agent) to register whatever verb the debugging
session needs, per "Registering your own commands" below.

### Registering your own commands

`GgStatic.instance.registerConsoleCommand(world, name, handler, doc?)`:
- `world`: a specific `GgWorld` instance scopes the command to it (only runs/shows up while that
  world is selected — the common case for a single-world app); `null` registers a global command.
- `handler`: `(...args: string[]) => Promise<string>` — args are whitespace-split from the raw
  input; the resolved string is what gets printed/returned. Throw to report an error (rendered in
  red by the UI).
- `doc`: shown by `commands`/`help` — write one; it's the only way a later session (human or
  agent) discovers the command's argument shape without reading source.

```typescript
GgStatic.instance.registerConsoleCommand(
  world,
  'give_item',
  async (...args: string[]) => {
    const player = world.getEntityByName('player') as PlayerEntity; // this game's own entity class
    const [itemId, countArg] = args;
    if (!itemId) throw new Error('usage: give_item <itemId> [count=1]');
    player.inventory.add(itemId, countArg === undefined ? 1 : +countArg);
    return `gave ${countArg ?? 1}x ${itemId}`;
  },
  'args: [itemId, count?]; add an item to the player inventory',
);
```

This is the pattern for anything genuinely game-specific — the engine has no idea what an
"inventory" is, so a command like this can only live in app code. Positioning entities, by
contrast, doesn't need a custom command at all: `set_position`/`set_rotation` above already work
on any named entity, including the player.

### Two ways to use this while debugging as an agent

1. **Temporary, source-free** — for a one-off session (e.g. "why does the player fall through the
   floor at this spot"), don't edit the app's source at all: call `registerConsoleCommand` (and/or
   `world.getEntityByName`, `window.ggstatic.selectedWorld`, `GgWorld.documentWorlds`) straight
   from `javascript_tool`/DevTools to close over whatever entity you need and add the missing verb
   as a console command on the spot — reach for this once the built-in `entities`/`entity`/
   `set_position`/`set_rotation`/`spawn`/`step` commands above aren't enough, e.g. a probe that
   needs to read a game-specific field. This is far faster and more reliable than reverse-engineering the
   game's internal class names/state shape by hand — it reuses the
   entity's real `.position`/method API instead, so physics and rendering stay in sync exactly as
   they would from normal gameplay code.
2. **Permanent cheat codes** — a genuinely reusable debug affordance (`give_item`, `noclip`,
   `set_health`, `skip_level`) is worth registering in the app's own bootstrap/entity code
   permanently, gated the same way as `devConsoleEnabled` (dev build / query flag / env check), so
   it's available every session without re-registering by hand. Pair with `bind_key` if a hotkey
   is more convenient than typing the command.

## Common pitfalls

- Forgetting `await world.init()` before calling `.factory`, `.addRenderer`, etc. (adapters throw
  "not initialized" errors by design — see e.g. `AmmoWorldComponent.factory` getter).
- Passing a canvas element that isn't attached to the DOM yet when calling `addRenderer`.
- Mixing 2D and 3D packages, or mismatched `@gg-web-engine/*` versions across packages.
- Not disposing entities/world (`world.removeEntity(entity, true)`, `world.dispose()`) — native
  physics engines (Ammo/Rapier WASM) leak memory if handles aren't explicitly destroyed.
- Assuming feature parity across physics/render backends — the engines are facades over quite
  different libraries; check the specific adapter's source under `packages/<adapter>/src` when a
  capability seems missing, and consult `docs/tasks.md`/`milestones.md` for known parity gaps
  before assuming a bug.

## Reference material

- Root `README.md` — quickstart, feature overview, integrations list.
- `https://andygura.github.io/gg-web-engine/` — generated API docs (TSDoc/docs-ts).
- `examples/` — one working project per renderer+physics combination; the fastest way to see a
  feature used correctly is to grep the examples for it.
