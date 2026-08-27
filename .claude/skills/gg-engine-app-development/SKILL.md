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
  and the adapter's own `<lib>-loader.ts` (e.g. `ThreeLoader`). Levels are authored via the Blender
  exporter in `packages/core/blender_exporter`. See the `examples/glb-loader-*` examples.
- **Level JSON loading (2D & 3D)**: `world.loader` turns a JSON document of entities into world
  content, with built-in `"Primitive"`/`"Trigger"`/`"Camera"`/`"Glb"` (3D only) classes and support
  for app-registered custom classes. Loading resolves to a group entity holding everything the level
  produced, so `world.removeEntity(level, true)` tears the whole level back down in one call, and
  `level.getChildEntityByName(name)`/`world.getEntityByName(name)` find a named entity afterwards —
  see the dedicated `gg-engine-level-json` skill, and the `examples/primitives-*` examples for
  complete demos (all four build their scene from a hardcoded `LevelJson` object).
- **Raycasting**: `world.physicsWorld.raycast({ from, to, collisionFilterGroups?, collisionFilterMask? })`.
- **Collision groups**: `world.physicsWorld.registerCollisionGroup()` /
  `deregisterCollisionGroup(group)`; every body has `mainCollisionGroup` set by default. See the
  `examples/collision-groups-*` examples for group/mask usage.
- **Dev tools**: `packages/core/src/dev/` — `gg-console.ui.ts` (in-page command console),
  `gg-debugger.ui.ts` (physics wireframe overlay toggle), `performance-meter.entity.ts`.
- **Vehicles**: `RaycastVehicle3dEntity` / `GgCarEntity` in `packages/core/src/3d/entities/` for
  raycast-based car physics; see `examples/ammo-car-three-ammo` and `examples/shooter-three-ammo`.

## Framework integration

For Angular/React/Vue/vanilla wiring patterns, don't reinvent — copy the structure of
`examples/framework-angular-three-ammo` or `examples/framework-react-three-rapier3d`. Typical
approach: create the `GgWorld` in a lifecycle hook (`ngOnInit`/`useEffect`) once a canvas ref
exists, call `world.dispose()` on teardown.

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
