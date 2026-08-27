---
name: gg-engine-level-json
description: Author or load a level/scene as a JSON document with gg-web-engine's LevelLoader (entities array, built-in "Primitive"/"Trigger"/"Camera" classes, app-defined entity classes via registerClass, named-entity lookup via getEntityByName). Use when the task is to write a level JSON file, add a new built-in level entity class in packages/core, or register a custom entity class an app's level JSON can reference.
---

# Building level JSONs

A level JSON is a single static document describing the static (or semi-static) content of a
scene - primitives, triggers, cameras, and anything else an app registers a class for - so it can
be shipped and consumed as one file instead of built up with imperative engine calls. The
mechanism is implemented in `packages/core/src/base/level-loader.ts` (dimension-agnostic
`LevelLoader`) plus `packages/core/src/2d/level-loader.ts` / `packages/core/src/3d/level-loader.ts`
(`Gg2dLevelLoader` / `Gg3dLevelLoader`, which register the built-in classes). Every `Gg2dWorld` /
`Gg3dWorld` exposes one on `world.loader.levelLoader`, with `registerClass`/`loadLevel`/
`loadLevelFromUrl`/`getEntityByName` all also forwarded directly onto `world.loader` itself, so app
code normally never touches `.levelLoader` explicitly.

This skill is for **authoring level JSON content and app-defined entity classes** (consumer-side
work, same audience as `gg-engine-app-development`). Changing the built-in classes themselves, or
`LevelLoader`/`EntityJson` shape, is a `packages/core` change - see `gg-engine-core-development`
and read `packages/core/src/base/level-loader.ts` first.

## Shape of a level JSON

```json
{
  "entities": [
    {
      "class": "Primitive",
      "shape": "BOX",
      "name": "Floor",
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
      "config": {
        "dimensions": { "x": 7, "y": 7, "z": 1 },
        "material": { "color": 8947848 },
        "body": { "dynamic": false }
      }
    }
  ]
}
```

Per entity:

- `class` (required) - a class alias registered against the loader via `registerClass`. Every
  primitive shape shares the single `"Primitive"` alias (see below) - there is no per-shape class
  like `"BOX"` or `"CIRCLE"`.
- `shape` (optional) - only meaningful when `class` is `"Primitive"`; selects which shape to build
  (see next section).
- `position`/`rotation` (optional) - `Point2`/`number` for a 2D level, `Point3`/`Point4`
  (quaternion) for a 3D level. Omit either to leave it at the generator's default.
- `name` (optional) - passed through to the generator, and - if the generator returned a truthy
  value - the key to look that value back up under via `getEntityByName(name)` after loading (see
  below). Two entities sharing a `name` isn't rejected; the later one simply wins the lookup.
- `config` (optional) - class-specific settings (e.g. `dimensions`, `radius`, `material`, `body`
  for `"Primitive"`). Spread directly into the settings object the generator receives.

`LevelLoader.loadLevel` folds `shape`/`position`/`rotation`/`name` into `config` before calling the
generator, so a generator's settings parameter sees one flat object:
`{ ...config, shape?, position?, rotation?, name? }`.

## Built-in classes

### `"Primitive"` - a display object + physics body pair

`shape` uses the same ALL-CAPS values as `Shape2DDescriptor`/`Shape3DDescriptor['shape']` at the
engine API level (no translation needed between a level JSON and e.g.
`Gg3dWorld.addPrimitiveRigidBody`):

- **2D** (`Gg2dLevelLoader`, `PrimitiveSettings`): `"SQUARE"` (needs `dimensions`), `"CIRCLE"`
  (needs `radius`).
- **3D** (`Gg3dLevelLoader`, `Primitive3DSettings`): `"BOX"` (needs `dimensions`), `"SPHERE"`
  (needs `radius`), `"PLANE"`, `"CAPSULE"` (needs `radius` + `centersDistance`), `"CYLINDER"`
  (needs `radius` + `height`), `"CONE"` (needs `radius` + `height`).

Common `config` fields for both: `material` (`DisplayObject2dOpts`/`DisplayObject3dOpts`, e.g.
`{ "color": ... }`) and `body` (`Partial<Body2DOptions>`/`Partial<Body3DOptions>`, merged over a
default dynamic body: `{ dynamic: true, mass: 1, restitution: 0.2, friction: 0.5,
ownCollisionGroups: 'all', interactWithCollisionGroups: 'all' }`). Missing a shape-required field,
or using an unrecognized `shape` value, throws synchronously from `loadLevel`.

### `"Trigger"` - a physics-only trigger volume

`config: { dimensions }` (a box). Returns the raw physics trigger component from
`world.physicsWorld.factory.createTrigger(...)` - it is **not** wrapped in a `Trigger2dEntity`/
`Trigger3dEntity` or added to the world. The app must do that itself, giving the entity a `name` in
the JSON and looking the raw component back up with `getEntityByName` once loading is done:

```typescript
await world.loader.loadLevelFromUrl(LEVEL_URL); // level JSON has a "Trigger" entity named "KillZone"
const killZone = new Trigger3dEntity(world.loader.getEntityByName('KillZone'));
world.addEntity(killZone);
killZone.onEntityEntered.subscribe(entity => world.removeEntity(entity, true));
```

### `"Camera"` (3D only) - a plain perspective camera component

`config: { fov?, aspectRatio?, frustrum?: { near, far } }`. Like `Trigger`, this returns the raw
camera component, not attached to any renderer/canvas - a level JSON has no notion of a canvas.
Give it a `name` and wire it up the same way: `world.addRenderer(world.loader.getEntityByName('MainCamera'), canvas)`.

`loadLevel`/`loadLevelFromUrl` themselves return nothing - `LevelLoader` keeps its own name → entity
map internally (populated as each entity's generator runs, only for entities whose JSON has a
`name` and whose generator returned a truthy value) rather than handing back an opaque array for
callers to positionally destructure. Look a specific entity up afterwards with
`getEntityByName<T = any>(name)` (thrown as `No loaded entity named "..."` if that name was never
loaded, so a typo fails loudly instead of silently returning `undefined`). Purely decorative
entities (most `"Primitive"`s) don't need a `name` at all.

## App-defined entity classes

Register a generator - any `(world, settings) => any` function or arrow wrapping a class
constructor - against a new class alias via `registerClass`, **before** loading the level JSON that
references it:

```typescript
interface ShapeSpawnerSettings {
  interval?: number;
  area: { min: Point3; max: Point3 };
}

class ShapeSpawner {
  constructor(world: Gg3dWorld, settings: ShapeSpawnerSettings) {
    const clock = world.createClock(true);
    clock.tickRateLimit = 1 / (settings.interval ?? 0.5);
    clock.tick$.subscribe(() => {
      /* spawn something inside settings.area, e.g. via world.addPrimitiveRigidBody(...) */
    });
  }
}

world.loader.registerClass('ShapeSpawner', (w: Gg3dWorld, settings: ShapeSpawnerSettings) => new ShapeSpawner(w, settings));
await world.loader.loadLevelFromUrl(LEVEL_URL); // JSON has an entity with "class": "ShapeSpawner"
```

There's nothing engine-specific about `ShapeSpawner` here - it's ordinary app code, registered the
same way the built-in `"Primitive"`/`"Trigger"`/`"Camera"` classes are internally. Nothing requires
the generator to construct an `Entity2d`/`Entity3d` or call `world.addEntity` - return whatever the
app needs to hold onto (or nothing, if the constructor/side effect is enough, e.g. a spawner that
hooks its own clock; give it a `name` in the JSON too if the app needs to fetch it back later via
`getEntityByName`). See `examples/level-json-three-rapier3d` (3D) and
`examples/level-json-pixi-rapier2d` (2D) for a complete `ShapeSpawner` built this way, replacing
what would otherwise be a hand-rolled spawn timer in `index.ts`.

A `class` with no registered generator logs `console.warn('No generator registered for class alias
"..."')` and is skipped rather than throwing - so a level JSON referencing an app class must have
that class registered first, or that entity silently disappears (and `getEntityByName` on it, if it
had a `name`, throws `No loaded entity named "..."`).

## Where level JSON files live

`examples/assets/level-json/*.json` are the existing reference files (`level2d.json`,
`level3d.json`), consumed by `examples/level-json-pixi-rapier2d` and `examples/level-json-three-rapier3d`
via `world.loader.loadLevelFromUrl(...)` against a hosted copy - see `gg-engine-examples` for how
to add/wire a new example. There's no required location for an app's own level JSON files; host
them wherever `fetch(url)` in `loadLevelFromUrl` can reach them (static assets, CDN, same-origin
path), or hand an already-parsed object to `loadLevel` directly if it isn't loaded over the
network.

## Tests

Core `LevelLoader` behavior is covered by `packages/core/test/base/level-loader.spec.ts` (generic
dispatch/merge behavior against a `MockWorld`) and `packages/core/test/{2d,3d}/level-loader.spec.ts`
(the built-in classes, against hand-rolled mock worlds). Follow their existing structure for new
built-in-class test cases - one `it` per shape/error case is the established pattern.

## Keep this skill current

This file is read by future agents authoring level JSONs or the loader itself, not by end users.
If a built-in class gains/loses required `config` fields, a new built-in class is added, or the
generator-registration contract changes, update the relevant section here (and cross-check
`gg-engine-app-development`'s "Level loading" pointer) before finishing the task.
