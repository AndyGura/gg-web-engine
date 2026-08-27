---
name: gg-engine-level-json
description: Author or load a level/scene as a JSON document with gg-web-engine's LevelLoader (entities array, built-in "Primitive"/"Trigger"/"Camera"/"Glb" classes, app-defined entity classes via registerClass, name lookup via GgWorld.getEntityByName/IEntity.getChildEntityByName, level removal via the returned group entity). Use when the task is to write a level JSON file, add a new built-in level entity class in packages/core, or register a custom entity class an app's level JSON can reference.
---

# Building level JSONs

A level JSON is a single static document describing the static (or semi-static) content of a
scene - primitives, triggers, cameras, GLB models, and anything else an app registers a class for -
so it can be shipped and consumed as one file instead of built up with imperative engine calls. The
mechanism is implemented in `packages/core/src/base/level-loader.ts` (dimension-agnostic
`LevelLoader`) plus `packages/core/src/2d/level-loader.ts` / `packages/core/src/3d/level-loader.ts`
(`Gg2dLevelLoader` / `Gg3dLevelLoader`, which register the built-in classes and are themselves base
classes of `Gg2dLoader`/`Gg3dLoader`). Every `Gg2dWorld`/`Gg3dWorld` exposes one directly as
`world.loader` - `world.loader.registerClass`/`.loadLevel`/`.loadLevelFromUrl` are the entry points
app code calls.

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
- `name` (optional) - if the generator's result is an `IEntity`, its `.name` is set to this
  (overriding whatever default it had), so it can be found afterwards - see "Finding entities by
  name" below. Ignored for a generator that returns something other than an `IEntity`.
- `config` (optional) - class-specific settings (e.g. `dimensions`, `radius`, `material`, `body`
  for `"Primitive"`). Spread directly into the settings object the generator receives.

`LevelLoader.loadLevel` folds `shape`/`position`/`rotation`/`name` into `config` before calling the
generator, so a generator's settings parameter sees one flat object:
`{ ...config, shape?, position?, rotation?, name? }`. A generator may be `async`/return a `Promise`
(the built-in `"Glb"` 3D class does) - `loadLevel` awaits each one before moving to the next entity.

## Loading a level, and tearing it back down

```typescript
const level = await world.loader.loadLevelFromUrl(LEVEL_URL);
// ... later, e.g. to swap in a different level:
world.removeEntity(level, true);
```

`loadLevel`/`loadLevelFromUrl` resolve to a `GroupEntity` (`packages/core/src/base/entities/group.entity.ts`)
representing the whole loaded level: a plain, do-nothing `IEntity`, already added to the world by
the time you get it back. Every `IEntity` a generator produces is parented under it
(`GroupEntity.addChildren`), so `world.removeEntity(level, true)` cascades removal + disposal down
through every child in one call - that's the whole story for "how do I unload a level."

The one exception is an entity a generator marks with `standaloneEntity()` (exported from
`base/level-loader.ts`): it's still added to the world, but deliberately left unparented, so it
survives `world.removeEntity(level, true)`. The built-in `"Camera"` 3D class does this - see its
section below for why. Results that aren't an `IEntity` at all (e.g. a `ShapeSpawner` that's a
plain class instance, not an entity) aren't parented or tracked anywhere by `loadLevel`; if an app
wants such a class's cleanup tied to level lifecycle, make it an `IEntity` instead and let
`loadLevel` pick it up automatically.

If a generator throws partway through a `loadLevel` call, the already-in-progress group (and
everything added to it so far) is torn down (`world.removeEntity(level, true)`) before the error is
rethrown - a failed load doesn't leave orphaned entities behind, since the caller never gets a
`level` reference to clean up itself in that case.

Optionally name the group itself: `loadLevel(json, 'MyLevel')` / `loadLevelFromUrl(url, 'MyLevel')`
sets `level.name` - handy for a debugger/console entity listing, or so
`world.removeEntity(world.getEntityByName('MyLevel'), true)` works without holding onto the
returned value.

## Finding entities by name

Two general (not level-JSON-specific) lookups, not the level loader itself, are how you get a named
entity back after loading:

- `level.getChildEntityByName(name)` (`IEntity.getChildEntityByName`, any entity has this) searches
  `level`'s own descendant subtree recursively. This is the normal way to fetch something the level
  produced, since basically everything ends up parented under `level` (see above).
- `world.getEntityByName(name)` (`GgWorld.getEntityByName`) searches every entity in the world - a
  flat scan, not a tree walk, since `world.children` already contains every spawned entity
  regardless of parenting. Use this for a `standaloneEntity()`-marked result (e.g. `"Camera"`),
  since it was never made a child of `level`.

Both throw (`No child entity named "..." found under "..."` / `No entity named "..." found in the
world`) rather than returning `undefined`, so a typo fails loudly. Both search live state, not a
cache - a removed/disposed entity simply stops being found, it doesn't linger as a stale reference.
If more than one entity shares a name, whichever is encountered first (child-array order for
`getChildEntityByName`, insertion order for `getEntityByName`) wins; a level JSON generally
shouldn't reuse a `name`, but nothing enforces that.

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
or using an unrecognized `shape` value, throws (and fails the whole `loadLevel` call - see above).

### `"Trigger"` - a physics-only trigger volume, ready to use

`config: { dimensions }` (a box). Returns a `Trigger2dEntity`/`Trigger3dEntity` wrapping the raw
physics trigger component: already positioned, already parented under the level's group entity
(hence already in the world), and ready to subscribe to:

```typescript
const level = await world.loader.loadLevelFromUrl(LEVEL_URL); // has a "Trigger" entity named "KillZone"
const killZone = level.getChildEntityByName<Trigger3dEntity>('KillZone');
killZone.onEntityEntered.subscribe(entity => world.removeEntity(entity, true));
```

### `"Camera"` (3D only) - a `Camera3dEntity`, deliberately unparented

`config: { fov?, aspectRatio?, frustrum?: { near, far } }`. Returns a `Camera3dEntity` (`.camera`
holds the raw camera component - pass that to `Gg3dWorld.addRenderer`, since a level JSON has no
notion of a canvas). Unlike `Trigger`, it's marked `standaloneEntity()` rather than parented under
the level's group entity: apps commonly own a camera independently of any one level (create it
once, then load/swap several levels against it), so a camera must not get torn down as a side
effect of `world.removeEntity(level, true)`. Look it up with `world.getEntityByName`, not
`level.getChildEntityByName` (it isn't `level`'s child):

```typescript
const cameraEntity = world.getEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
world.addRenderer(cameraEntity.camera, canvas);
```

### `"Glb"` (3D only) - a GG GLB+meta model, loaded and added to the world

```json
{ "class": "Glb", "name": "Scene", "position": { "x": 0, "y": 0, "z": 0 }, "config": { "path": "assets/my-scene" } }
```

`config` (`Glb3DSettings`): `path` (required - passed straight to `Gg3dLoader.loadGgGlb`, see
`gg-engine-app-development`/`packages/core/src/3d/loader.ts` for the GLB+`.meta` sidecar format and
the Blender exporter that produces it), plus optional `cachingStrategy`/`loadProps`/`propsPath`
mirroring `loadGgGlb`'s own `LoadOptions`. Missing `path` throws `Path is required for Glb class`.

A GLB (with `loadProps` on, the default) can expand into several `Entity3d`s - the model itself plus
any nested props/scenes. All of them - flattened, regardless of nesting depth - are added as
children of one `GroupEntity` (distinct from the level's own root group), which is what
`level.getChildEntityByName` on the `"Glb"` entity's own `name` hands back. That group *is* parented
under the level's root, so it's still torn down along with the rest of the level.

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

world.loader.registerClass('ShapeSpawner', (w: Gg3dWorld, settings: ShapeSpawnerSettings) =>
  new ShapeSpawner(w, settings),
);
await world.loader.loadLevelFromUrl(LEVEL_URL); // JSON has an entity with "class": "ShapeSpawner"
```

There's nothing engine-specific about `ShapeSpawner` here - it's ordinary app code, registered the
same way the built-in `"Primitive"`/`"Trigger"`/`"Camera"`/`"Glb"` classes are internally. Nothing
requires the generator to construct an `Entity2d`/`Entity3d` or call `world.addEntity` - return
whatever the app needs to hold onto (or nothing, if the constructor/side effect is enough, e.g. a
spawner that hooks its own clock). Give it a `name` in the JSON too if the app needs to fetch it
back later, and make the return value an `IEntity` if either its lifecycle should be tied to the
level's (see "Loading a level, and tearing it back down" above) or you want it findable via
`level.getChildEntityByName`/`world.getEntityByName` (see "Finding entities by name" above) - a
non-`IEntity` result can't be looked up by name at all. See `examples/level-json-three-rapier3d`
(3D) and `examples/level-json-pixi-rapier2d` (2D) for a complete `ShapeSpawner` built this way,
replacing what would otherwise be a hand-rolled spawn timer in `index.ts`.

A `class` with no registered generator logs `console.warn('No generator registered for class alias
"..."')` and is skipped rather than throwing - so a level JSON referencing an app class must have
that class registered first, or that entity silently disappears.

## Where level JSON files live

`examples/level-json-pixi-rapier2d/level.json` and `examples/level-json-three-rapier3d/level.json`
are the reference files, kept as a plain source file inside each example's own directory (not
under the shared `examples/assets/`) and imported directly - `import level from './level.json'`,
then `world.loader.loadLevel(level)` - rather than fetched by URL. This is deliberate: these
examples are meant to be opened on StackBlitz, where a visitor can edit `level.json` right in the
IDE pane and rerun to see the change; a shared/hosted asset fetched by URL wouldn't reflect a local
edit at all. `tsconfig.json` needs `"resolveJsonModule": true` (and `"esModuleInterop": true`) for
the JSON import to type-check under `ts-loader`; webpack bundles a JSON import out of the box, no
loader config needed. See `gg-engine-examples` for how to add/wire a new example.

There's no required location for an app's own level JSON files in general - this is just the
convention for these two reference examples. Host a level JSON wherever `fetch(url)` in
`loadLevelFromUrl` can reach it (static assets, CDN, same-origin path) if it should be swappable at
runtime without a rebuild, or import/inline it and hand the parsed object to `loadLevel` directly
(as these examples now do) when it's fine to ship baked into the bundle.

## Tests

Core `LevelLoader` behavior (dispatch, `shape`/`position`/`rotation`/`name` merging, group-entity
parenting/teardown, `standaloneEntity()`) is covered by `packages/core/test/base/level-loader.spec.ts`
against a real `MockWorld` (so `world.addEntity`/`removeEntity` behave for real, not as jest mocks -
needed to exercise spawn/parent/dispose cascades meaningfully). `GgWorld.getEntityByName` and
`IEntity.getChildEntityByName` themselves have their own direct coverage in
`packages/core/test/base/gg-world.spec.ts` and `packages/core/test/base/entities/i-entity.spec.ts`.
`packages/core/test/{2d,3d}/level-loader.spec.ts` cover the built-in
`"Primitive"`/`"Trigger"`/`"Camera"` classes against hand-rolled mock worlds (there,
`addEntity`/`removeEntity` are plain `jest.fn()` stubs - fine since those tests only care about
generator dispatch, not full spawn semantics). `packages/core/test/3d/loader.spec.ts` covers
`Gg3dLoader` - the `"Glb"` class, and that `registerClass`/`loadLevel`/`loadLevelFromUrl` are
available directly on it - stubbing `loadGgGlb` itself rather than the whole fetch/parse pipeline
(which has no tests of its own - see `gg-engine-app-development`). Follow their existing structure
for new built-in-class test cases - one `it` per shape/error case is the established pattern.

## Keep this skill current

This file is read by future agents authoring level JSONs or the loader itself, not by end users.
If a built-in class gains/loses required `config` fields, a new built-in class is added, the
generator-registration contract changes, or the group-entity/teardown/lookup mechanics change,
update the relevant section here (and cross-check `gg-engine-app-development`'s "Level loading"
pointer) before finishing the task.

When you do, describe the API as it is now - don't narrate what it used to look like or how it
changed. That kind of delta is noise to a reader who only ever knew the current shape; it belongs
in `milestones.md`'s changelog-style status entries, not here. Overwrite the relevant paragraph
outright rather than appending a "this used to be X" caveat next to it.
