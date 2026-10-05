---
name: gg-engine-level-json
description: Author or load a level/scene as a JSON document with gg-web-engine's LevelLoader (entities array, built-in "Primitive"/"Trigger"/"Camera"/"Light"/"Environment"/"ParallaxLayer"/"Player"/"Glb"/"GgCar"/"MapGraph"/"Sound" classes, app-defined entity classes via registerClass, blueprint graphs - including the built-in "RemoveEntity"/"PlaySound" nodes - wired to entity events via registerBlueprintNode, name lookup via GgWorld.getEntityByName/IEntity.getChildEntityByName, level removal via the returned group entity). Use when the task is to write a level JSON file, add a new built-in level entity class in packages/core, wire an entity's event straight to behavior via a blueprint, or register a custom entity class/blueprint node an app's level JSON can reference.
---

# Building level JSONs

A level JSON is a single static document describing the static (or semi-static) content of a
scene - primitives, triggers, cameras, GLB models, cars, streaming map graphs, and anything else an
app registers a class for - so it can be shipped and consumed as one file instead of built up with
imperative engine calls. The
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
        "body": { "bodyType": "static" }
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
- `name` (optional) - the generator's returned entity's `.name` is set to this (overriding whatever
  default it had), so it can be found afterwards - see "Finding entities by name" below. Omitted
  entirely, the entity is instead named `` `${levelName}__${classAlias}_${index}` `` (`index` its
  position in `entities`) - deterministic purely from the level document's own content and the
  `levelName` the app loads it under, so two peers loading the same JSON under the same `levelName`
  always agree on every unnamed entity's name too (this is why `levelName` is a required argument
  to `loadLevel`/
  `loadLevelFromUrl` - see "Loading a level, and tearing it back down" below).
- `config` (optional) - class-specific settings (e.g. `dimensions`, `radius`, `material`, `body`
  for `"Primitive"`). Spread directly into the settings object the generator receives.

`LevelLoader.loadLevel` folds `shape`/`position`/`rotation`/`name` into `config` before calling the
generator, so a generator's settings parameter sees one flat object:
`{ ...config, shape?, position?, rotation?, name? }`. A generator may be `async`/return a `Promise`
(the built-in `"Glb"` 3D class does) - `loadLevel` awaits each one before moving to the next entity.

## Loading a level, and tearing it back down

```typescript
const level = await world.loader.loadLevelFromUrl(LEVEL_URL, 'MainLevel');
// ... later, e.g. to swap in a different level:
world.removeEntity(level, true);
```

`loadLevel`/`loadLevelFromUrl` resolve to a `GroupEntity` (`packages/core/src/base/entities/group.entity.ts`)
representing the whole loaded level: a plain, do-nothing `IEntity`, already added to the world by
the time you get it back. A generator is required to return an `IEntity`; `loadLevel` parents each
one under this group (`GroupEntity.addChildren`), so `world.removeEntity(level, true)` cascades
removal + disposal down through every child in one call - that's the whole story for "how do I
unload a level." Multiple levels can be loaded at once (each `loadLevel` call gets its own
`GroupEntity`), so content that should outlive any one level swap - a camera, persistent UI/lighting,
global game state - belongs in its own level (or created directly with plain engine calls, no level
JSON at all) that the app loads once and never passes to `world.removeEntity`, kept separate from
the level(s) it loads and unloads freely; see the `"Camera"` section below for the reference case.
If a generator returns anything other than an `IEntity` (including `null`/`undefined`), `loadLevel`
logs a `console.warn` and skips that entity entirely - it's never parented, named, or tracked. A
class whose behavior isn't naturally entity-shaped (e.g. a spawner that just hooks a clock
subscription) still needs to extend `IEntity` to be usable as a generator's result - see the
`ShapeSpawner` example below, which ties its own cleanup to level teardown via an `IEntity.dispose`
override.

If a generator throws partway through a `loadLevel` call, the already-in-progress group (and
everything added to it so far) is torn down (`world.removeEntity(level, true)`) before the error is
rethrown - a failed load doesn't leave orphaned entities behind, since the caller never gets a
`level` reference to clean up itself in that case.

### Progress, cancellation, and what happens to a level's assets

Both calls take a third argument, `{ onProgress, signal }`:

```typescript
const controller = new AbortController();
const level = await world.loader.loadLevelFromUrl(LEVEL_URL, 'MainLevel', {
  onProgress: p => bar.style.width = `${p.fraction * 100}%`, // also p.loadedItems/totalItems/bytesLoaded/bytesTotal/current
  signal: controller.signal, // controller.abort() rejects the load with an AbortError
});
```

A level loads in two steps under that one progress. First every asset its entities and blueprints
declare is loaded, all in parallel: a class says what it loads through an `assets` hook (see
"App-defined entity classes"), and every built-in class that loads something has one (`"Glb"` with
the props its `.meta` references, `"Player"`'s model, `"Sound"`, the `"Environment"` textures,
`"ParallaxLayer"`, a `"PlaySound"` node's clips). Then the entities are built in document order,
finding those assets in the loader's cache. `fraction` counts an asset's download by bytes and
keeps a share of it for decoding, so it reaches 1 only when the level is built; it never goes
down, though `totalItems` grows when an asset references more (a model's props) or a generator
without a hook loads something. `bytesTotal` is `null` while a server hides a file's size.
`"MapGraph"` chunks are not part of it: they stream in after the level is built (wait for the
entity's `initialLoadComplete$` to keep a loading screen up until the first ones are there).

An aborted load leaves nothing behind: no level entity, nothing cached.

The level holds everything it loaded: removing it (`world.removeEntity(level, true)`) frees what
only that level used. To switch levels without loading shared assets twice, load the new level
before removing the old one. See `gg-engine-app-development`'s "Loading assets" for the cache this
goes through.

`levelName` is a required second argument - `loadLevel(json, 'MyLevel')` /
`loadLevelFromUrl(url, 'MyLevel')` - and sets `level.name`, so `world.removeEntity
(world.getEntityByName('MyLevel'), true)` works without holding onto the returned value; it also
scopes every unnamed entity's derived default name (see the `name` field above), so pick something
unique per loaded *instance*, not just per level type - loading the same level JSON twice (e.g. two
copies of one room) needs two distinct `levelName`s, the same way two `GroupEntity`s can't otherwise
be told apart by name. `GgWorld` enforces this: `loadLevel` throws if `levelName`, or any entity
name (explicit or derived) it produces, collides with a name already in use anywhere in the world.

## Finding entities by name

Two general (not level-JSON-specific) lookups, not the level loader itself, are how you get a named
entity back after loading:

- `level.getChildEntityByName(name)` (`IEntity.getChildEntityByName`, any entity has this) searches
  `level`'s own descendant subtree recursively. This is the normal way to fetch something the level
  produced, since every `IEntity` a generator returns ends up parented under `level`.
- `world.getEntityByName(name)` (`GgWorld.getEntityByName`) searches every entity in the world - a
  flat scan, not a tree walk, since `world.children` already contains every spawned entity
  regardless of parenting. Prefer `level.getChildEntityByName` for anything a level just produced;
  reach for this instead once you've reparented an entity out from under its level (see "Loading a
  level, and tearing it back down" above) or for an entity the app created outside any level.

Both throw (`No child entity named "..." found under "..."` / `No entity named "..." found in the
world`) rather than returning `undefined`, so a typo fails loudly. Both search live state, not a
cache - a removed/disposed entity simply stops being found, it doesn't linger as a stale reference.
Names are enforced unique world-wide - `GgWorld.addEntity` and `IEntity`'s own `name` setter both
throw immediately on a collision - so a level JSON reusing a `name` (or colliding with an entity
from another level/the app's own code) fails loudly at load time rather than silently shadowing.

## Building a single entity outside a level - `world.loader.createEntity`

`loadLevel` always builds a whole `LevelJson`'s worth of entities at once, parented under one
`GroupEntity`. For a runtime spawn that doesn't come from (and shouldn't be forced into) a level
document - e.g. a networked "spawn this entity" message carrying one `EntityJson`, or a
gameplay-triggered spawn built from a small hand-written descriptor - `world.loader.createEntity(entityJson)`
builds a single entity the same way (dispatching `entityJson.class` to its registered generator),
without any level/group involved:

```typescript
const crate = await world.loader.createEntity({
  class: 'Primitive',
  shape: 'BOX',
  position: { x: 3, y: 0, z: 1 },
  config: { dimensions: { x: 1, y: 1, z: 1 }, body: { mass: 5 } },
});
if (crate) {
  world.addEntity(crate); // safe even if the generator already self-added it (e.g. addPrimitiveRigidBody does)
}
```

Unlike `loadLevel`, the returned entity is **not** parented under any group and is **not** added to
the world automatically - the caller does both itself (`world.addEntity(entity)`, and optionally
`someParent.addChildren(entity)`). `entity.name` is left at whatever default the entity itself
generated unless `entityJson.name` is explicitly given or a `defaultName` is passed as the optional
second argument (`createEntity(entityJson, defaultName)`) - there's no level/index to derive a
fallback name from outside `loadLevel`, which is exactly what passes its own
`` `${levelName}__${classAlias}_${index}` `` fallback through this argument. Whichever name is
resolved is also handed to the generator as `settings.name` *before* the entity is built (so it is
always present in `settings` under `loadLevel`, and present under `createEntity` whenever either
source supplies one) - a generator that needs to derive something from the entity's final name can,
e.g. the built-in `"Glb"` class scopes every sub-entity a model expands into under it (see that
class below). Returns `undefined` (logged via `console.warn`, same as `loadLevel`'s per-entity
posture) if `entityJson.class` has no registered generator, or that generator didn't return an
`IEntity`.

`createEntity` also honors `entityJson.events` (see "Blueprints" below), via an optional third
`blueprints` argument (`createEntity(entityJson, defaultName, blueprints)`) supplying the named
graphs a string binding may reference by name - the same role `levelJson.blueprints` plays for
`loadLevel` (which is, in fact, implemented as a `createEntity` call per entity, passing its own
`levelJson.blueprints` through this argument). Each binding is resolved exactly as it is under
`loadLevel` and the resulting binding entity is parented directly under the just-built entity
(`entity.addChildren(bindingEntity)`) rather than under any group - `createEntity` doesn't have one.
This means disposing/removing (with `dispose: true`) the entity on its own - not just tearing down a
whole level - tears the binding's subscription and blueprint down right along with it, with nothing
extra for the caller to clean up:

```typescript
const killZone = await world.loader.createEntity({
  class: 'Trigger',
  config: { dimensions: { x: 10, y: 1, z: 10 } },
  events: { onEntityEntered: 'RemoveEntity' },
});
if (killZone) {
  world.addEntity(killZone);
}
// ...later...
world.removeEntity(killZone!, true); // tears the "onEntityEntered" binding down along with killZone
```

## Serializing an entity or a level back to JSON

`world.loader.serializeEntity(entity)` is the inverse of `createEntity`/`loadLevel`: given a live
entity, it returns the `EntityJson` that could reproduce it. It tries three mechanisms, in order:

1. **Live serializers** - read the entity's own *current* physics/visual state directly, so they
   work for an entity regardless of how (or by what code) it was actually built, and reflect
   however much its state has drifted since spawn (moved, given a different velocity, ...). The
   built-in `"Primitive"`/`"Trigger"` classes (2D and 3D) work this way: they recover `shape`/
   `dimensions`/`radius`/etc. from the physics body's own `debugBodySettings.shape`,
   `body`/`linearVelocity`/`angularVelocity` from the live body itself (`bodyOptions`,
   `linearVelocity`, `angularVelocity`), and `material` from the live display object when it
   implements `IMaterialReadable3dComponent`/`IMaterialReadable2dComponent` (see below) - not from
   whatever JSON (if any) the entity happened to be loaded from:

   ```typescript
   const crate = world.addPrimitiveRigidBody(
     { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 2 } },
     { x: 0, y: 0, z: 5 },
     undefined,
     { color: 0x990000 },
   ); // built directly, no level JSON or createEntity call involved at all
   // ...gravity pulls it down, a push gives it some velocity...
   world.loader.serializeEntity(crate);
   // => { class: 'Primitive', shape: 'BOX', name: 'Entity3d_0', position: {x, y, z now},
   //      rotation: {...}, config: { dimensions: {x:1,y:1,z:1}, material: {color: 0x990000},
   //      body: {...live bodyOptions...}, linearVelocity: {...}, angularVelocity: {...} } }
   ```

   `IMaterialReadable3dComponent`/`IMaterialReadable2dComponent` (`packages/core`'s
   `3d`/`2d/components/rendering`) are opt-in capabilities a display object implements when it
   remembers the `DisplayObject3dOpts`/`DisplayObject2dOpts` it was actually built with - true for
   anything built via `IDisplayObject(2d|3d)ComponentFactory.createPrimitive` (or a shortcut on it,
   e.g. `createBox`/`createCylinder`) in `packages/three`/`packages/pixi`, checked via
   `isMaterialReadable3d`/`isMaterialReadable2d` rather than an adapter-specific `instanceof`. A
   mesh with no such capability (a loaded `.glb`, an adapter that hasn't wired the capability up)
   simply omits `material` - same as omitting it when building one in the first place. A richer
   subclass isn't silently mis-serialized either: the live `"Primitive"`/`"Trigger"` serializers
   match an entity's *exact* concrete class, not `instanceof`, so e.g. a `Grabbable3dEntity`
   (extends `Entity3d`, built via `world.addGrabbablePrimitive` - not itself a registered
   level-loader class) falls through instead of being mistaken for a plain, non-grabbable primitive.

2. **The entity's own `ISerializableEntity.serializeSettings()`**, if it implements that interface
   (`packages/core`'s `base/interfaces/i-serializable-entity.ts`) - the class-owned counterpart of
   (1), for a class that *does* have one dedicated entity class to hold the logic (unlike
   `"Primitive"`, which can produce many different shapes off one `Entity3d`/`Entity2d`). The
   built-in `"GgCar"` class works this way: `GgCarEntity.serializeSettings()` returns its
   construction-time tuning (`engine`/`brake`/`transmission`/`suspension`/`tractionBias`/
   `maxSteerAngle`/`mpsToRpmFactor`, plus `wheelBase`/`wheelOptions` geometry - all already held on
   `carProperties`), chassis `dimensions`/`material`/`body` recovered from the live chassis body/
   mesh the same way (1) does for a `"Primitive"`, and a `state` block (`gear`/`acceleration`/
   `brake`/`handBrake`/`steeringFactor`) capturing the car's *current* driving state - none of
   which a spawn-time `config` alone could ever reflect, since all five change continuously as the
   car is driven. The built-in `"Player"` class (2D and 3D) works the same way:
   `CharacterController(2d|3d)Entity.serializeSettings()` returns `radius`/`centersDistance`, every
   option that differs from its default, `display` (the `display` block the loader built it from,
   kept on the entity's `displaySettings` - so a loaded model's path round-trips - else the capsule
   mesh's material) and a `state` block (`isCrouching`/`isRunning`/`moveDirection`/`fallVelocity`/
   `airHorizontalVelocity`). `serializeEntity` resolves this tier's `class` alias from the entity's spawn
   record if it has one (see (3)), or otherwise from the constructor->alias mapping an optional
   third `registerClass` argument sets up (see "App-defined entity classes" below) - so a
   self-serializing entity is reconstructable even when built directly (`new GgCarEntity(...)`,
   `new SomeAppEntity(...)`), not only through `createEntity`/`loadLevel`. This is the mechanism to
   reach for on your own app-defined entity class, rather than (3) or a `registerSerializer` layered
   on top of it (see below) - the serialization logic lives directly on the class that owns the
   state it describes, so it can't drift out of sync with that class the way external, loader-side
   logic could.

3. **Spawn-record echo** - the final fallback, tried only if neither (1) nor (2) applied. Works
   only for an entity that was itself built by the loader (`createEntity`, and therefore
   `loadLevel` too): the loader remembers the `class`/`shape`/`config` each entity was built from
   and echoes them straight back, still reading `name`/`position`/`rotation` live off the entity (so
   a moved or renamed entity serializes to where it actually is now, not its spawn-time values) -
   this is the only option left for a class with neither a live nor a self-serialized equivalent to
   read from (`"MapGraph"`'s graph structure, `"Sound"`'s clip URL - neither is recoverable from any
   live component today).

Tiers (2) and (3) also echo the `events` bindings an entity was built with (by `createEntity`), so
re-creating an entity from its own serialization (e.g. on another peer) rebinds them - against
whatever `blueprints` map that `createEntity` call is given.

An entity matched by none of the three - built some other way with no live/self-serializer
applicable, or a child an entity class adds to itself (a `"Player"`'s
`CharacterAnimationController`, one of a `"GgCar"`'s individual wheel components) - has nothing to
reconstruct it from; `serializeEntity` logs a warning and returns `undefined` rather than guessing.

`world.loader.serializeLevel(level)` is the level-wide counterpart: it walks `level.children` and
serializes each one that either a live/self-serializer recognizes or has a spawn record, into a
`LevelJson`'s `entities` array - silently skipping a child that's neither (e.g. a blueprint event
binding `loadLevel` itself parents under the level - see "Blueprints" below) rather than warning
about it, since that kind of internal child is expected there. `serializeLevel` only reconstructs
`entities` - each one carries its own `events` bindings, but the level's top-level `blueprints` map
isn't rebuilt (a live binding doesn't expose the `BlueprintJson` it was built from); keep the original
`blueprints` alongside if those bindings reference named graphs.

Two extension points, for a class whose built-in handling isn't enough:

- `world.loader.registerLiveSerializer((entity) => EntityJson | undefined)` - register a fully
  independent, state-reading reconstruction (the same mechanism `"Primitive"`/`"Trigger"` use) for
  an app-defined class whose live state can be read back well enough to reconstruct an `EntityJson`
  without needing a spawn record at all. Tried in registration order, ahead of every other
  registered one (built-ins included), tier (2), and the spawn-record echo. Reach for this only for
  a class like `"Primitive"` with no single dedicated entity class of its own to implement
  `ISerializableEntity` on directly - prefer that interface (tier (2) above) for anything that does.
- `world.loader.registerSerializer(classAlias, (entity, defaultJson) => EntityJson | undefined)` -
  layers onto whichever of tier (2)/(3) produced an entity's `class`/`shape`/`config` (if any did):
  receives what that tier would have produced (`defaultJson`) and returns the `EntityJson` to
  actually emit, typically adding extra fields onto `defaultJson.config` rather than building one
  from scratch. This is an escape hatch for overriding a class's serialization *from outside* the
  class - prefer implementing `ISerializableEntity` directly on the entity class itself when you own
  that class (see (2) above), so the logic lives next to the state it describes.

`"Primitive"`'s `config` also accepts optional `linearVelocity`/`angularVelocity` (2D: `Point2`/a
radians-per-second number; 3D: `Point3`/`Point3`), applied once right after the body is created -
this is what lets a serialized primitive's velocity round-trip through `loadLevel` too, not just
through `serializeEntity`'s own read side. `"GgCar"`'s `config` similarly accepts an optional
`state` block (see (2) above), applied once right after the car is built - see that class's own
section below - and so does `"Player"`'s (`CharacterState3d`/`CharacterState2d`), applied right
after the character is built (a crouch set before spawning takes effect when it spawns).

## Built-in classes

### `"Primitive"` - a display object + physics body pair

`shape` uses the same ALL-CAPS values as `Shape2DDescriptor`/`Shape3DDescriptor['shape']` at the
engine API level (no translation needed between a level JSON and e.g.
`Gg3dWorld.addPrimitiveRigidBody`):

- **2D** (`Gg2dLevelLoader`, `PrimitiveSettings`): every `Shape2DDescriptor` member - `"BOX"` (needs
  `dimensions`), `"CIRCLE"` (needs `radius`), `"CAPSULE"` (needs `radius` + `centersDistance`),
  `"CONVEX_HULL"`/`"POLYGON"` (need `vertices`), `"COMPOUND"` (needs `children`: an array of
  `{ position?, rotation?, shape, ...shape-specific fields }`, recursing through the same
  `Primitive2DShapeSettings` shape - a child's own `shape` may itself be `"COMPOUND"`, nesting
  arbitrarily deep). See `packages/core/src/2d/level-loader.ts`'s `CompoundChild2DSettings`/
  `buildShapeDescriptor`.
- **3D** (`Gg3dLevelLoader`, `Primitive3DSettings`): every `Shape3DDescriptor` member - `"BOX"`
  (needs `dimensions`), `"SPHERE"` (needs `radius`), `"PLANE"`, `"CAPSULE"` (needs `radius` +
  `centersDistance`), `"CYLINDER"` (needs `height`, plus either `radius` for a circular
  cross-section or `radiusX`+`radiusY` together for an elliptical one - see below), `"CONE"` (needs
  `radius` + `height`), `"CONVEX_HULL"` (needs `vertices`), `"MESH"` (needs `vertices` + `faces`,
  the latter vertex-index triples), `"COMPOUND"` (needs `children`: an array of
  `{ position?, rotation?, shape, ...shape-specific fields }`, recursing through the same
  `Primitive3DShapeSettings` shape - a child's own `shape` may itself be `"COMPOUND"`, nesting
  arbitrarily deep; a child's `rotation` is a `Point4` quaternion, same as the top-level
  primitive's). See `packages/core/src/3d/level-loader.ts`'s `CompoundChild3DSettings`/
  `buildShapeDescriptor`.

`"CYLINDER"`'s elliptical form (`radiusX`/`radiusY` instead of `radius`) is 3D-only and
cylinder-only - `"CONE"` and the 2D shapes have no elliptical counterpart.

Common `config` fields for both: `material` (`DisplayObject2dOpts`/`DisplayObject3dOpts`, e.g.
`{ "color": ... }`), `body` (`Partial<Body2DOptions>`/`Partial<Body3DOptions>`, merged over a
default dynamic body: `{ bodyType: 'dynamic', mass: 1, restitution: 0.2, friction: 0.5,
ownCollisionGroups: 'all', interactWithCollisionGroups: 'all' }`), and optional `linearVelocity`/
`angularVelocity` (2D: `Point2`/a radians-per-second number; 3D: `Point3`/`Point3`) applied once
right after the body is created, e.g. to spawn something already moving. Missing a shape-required
field, or using an unrecognized `shape` value, throws (and fails the whole `loadLevel` call - see
above).

### `"Trigger"` - a physics-only trigger volume, ready to use

`config: { dimensions }` (a box). Returns a `Trigger2dEntity`/`Trigger3dEntity` wrapping the raw
physics trigger component: already positioned, already parented under the level's group entity
(hence already in the world), and ready to subscribe to:

```typescript
const level = await world.loader.loadLevelFromUrl(LEVEL_URL, 'MainLevel'); // has a "Trigger" entity named "KillZone"
const killZone = level.getChildEntityByName<Trigger3dEntity>('KillZone');
killZone.onEntityEntered.subscribe(entity => world.removeEntity(entity, true));
```

### Collision events - `onCollisionStart`/`onCollisionEnd` on any physics-bodied entity

Unlike a `"Trigger"` (a sensor with no collision response), any entity built on `Entity3d`/`Entity2d`
with a real rigid body exposes `onCollisionStart`/`onCollisionEnd` too - this covers a `"Primitive"`
entry above, `RaycastVehicle3dEntity` (and therefore `GgCarEntity.raycastVehicle` - a `"GgCar"`
entry's chassis), and any app-defined `Entity3d`/`Entity2d` subclass. `onCollisionStart` fires once
per pair of bodies that just started touching, carrying `entity` (the other body's owning entity, or
`null` if it has none - same convention as `onEntityEntered`), `position` (world-space contact
point), `normal`, `relativeVelocity`, and `impulse` (a rough hit-strength scalar - see
`CollisionEvent`'s own doc for why it isn't directly comparable across different physics adapters).
`onCollisionEnd` fires once contact stops, emitting just the other entity (or `null`) - no further
contact geometry is available at that point. Wire it exactly like a trigger event:

```typescript
const car = level.getChildEntityByName<GgCarEntity>('PlayerCar');
car.raycastVehicle.onCollisionStart.subscribe(({ entity, impulse }) => {
  if (impulse > 50) playCrashSound(entity);
});
```

or declaratively from a level JSON's `events` (see "Blueprints" below) - the built-in `"PlaySound"`
node's `impactClips` setting is built specifically for this: picking a different clip for a light tap
versus a hard crash off this same `impulse` field.

### `"Camera"` (3D only) - a `Camera3dEntity`, ready to use

`config: { fov?, aspectRatio?, frustrum?: { near, far } }`. Returns a `Camera3dEntity` (`.camera`
holds the raw camera component - pass that to `Gg3dWorld.addRenderer`, since a level JSON has no
notion of a canvas), already parented under the level's group entity - look it up with
`level.getChildEntityByName`:

```typescript
const cameraEntity = level.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
world.addRenderer(cameraEntity.camera, canvas);
```

A camera loaded this way is torn down along with whichever level declared it, since it's an
ordinary child of that level's group entity. Two supported ways to give a camera a lifetime
independent of any one swappable level:

- Skip the level JSON for it entirely - construct the camera directly with
  `world.visualScene.factory.createPerspectiveCamera(...)` wrapped in a `Camera3dEntity`, same as
  `createCamera` does internally, and add it to the world once at startup.
- Put it in its own "system" level - a `loadLevel`/`loadLevelFromUrl` call the app makes once at
  startup and never passes to `world.removeEntity` - alongside other session-wide content
  (lighting, persistent UI, global triggers). Since multiple levels can be loaded side by side,
  gameplay levels can then be freely loaded/unloaded against `world.loader.loadLevel(...)` /
  `world.removeEntity(gameplayLevel, true)` without ever touching the system level or its camera.

### `"Light"` (3D only) - a `Light3dEntity`

`config` is a `Light3dDescriptor` (`packages/core/src/3d/models/lights.ts`) plus an optional
`target`: `{ type: "AMBIENT" | "HEMISPHERE" | "DIRECTIONAL" | "POINT" | "SPOT", color?, intensity?,
castShadow?, shadow?: { mapSize?, area?, near?, far?, bias?, normalBias? }, ... }` (point/spot add
`distance`/`decay`, spot adds `angle`/`penumbra`, hemisphere adds `groundColor`). Directional and spot
lights shine along their local `-Z`; give either a `rotation` or a `target` point (aimed from the
entity's `position`):

```json
{ "class": "Light", "name": "Sun", "position": { "x": 50, "y": 50, "z": 70 },
  "config": { "type": "DIRECTIONAL", "intensity": 1, "castShadow": true,
              "shadow": { "mapSize": 2048, "area": 20 }, "target": { "x": 0, "y": 0, "z": 0 } } }
```

A no-op (`undefined`) without a visual scene. A live serializer reads a `Light3dEntity`'s current
settings back (`ILight3dComponent.lightOptions`), so a light built by hand with `world.addLight`
serializes too; the serialized form has `rotation` rather than `target`.

### `"Environment"` (3D) - background, environment map and fog for as long as the level is loaded

`config: { background?, environmentMap?, fog? }`. `background` is a `0xRRGGBB` number, a texture
reference, or `null`; `environmentMap` a texture reference or `null`; a texture reference is
`{ "cube": { "px", "nx", "py", "ny", "pz", "nz" } }` (six image URLs, each named after the world
direction it is seen in - `pz` is overhead; the side images' top edge is towards `+Z`, `pz`'s
towards `+Y`, `nz`'s towards `-Y`) or `{ "equirectangular": "url" }` (a `.hdr` URL is
decoded as HDR). `fog` is `{ "type": "LINEAR", color, near, far }`, `{ "type": "EXPONENTIAL", color,
density }` or `null`. Textures are loaded while the level loads. The resulting `Environment3dEntity`
applies only the fields present when spawned, and restores those fields to their previous values when
removed, so unloading a level takes its sky and fog with it. Several can be loaded at once and
removed in any order (two levels overlapping during a transition): each field shows the most recently
spawned one that sets it, and the pre-level value returns once none is left. The textures belong to
the load that built the entity: they are freed when the level is removed, or, for an entity built on
its own with `createEntity`, when that entity is disposed. It has no live serializer: one built by
the loader serializes through its spawn record (the original `config`, texture URLs included).

### `"ParallaxLayer"` (2D only) - a `ParallaxLayer2dEntity`

`config` is `ParallaxLayer2dOpts` with the texture given as an image URL: `{ texture: "url",
parallax?, zIndex?, repeat?, offset?, scale? }`. `parallax` and `scale` take a number (both axes) or
`{ x, y }`; `parallax` `0` stays fixed on screen, `1` moves with the world (default `0.5`); `repeat`
is `"x"` (default), `"y"`, `"both"` or `"none"`; `zIndex` defaults to `-1` (behind the world);
`offset` is the texture's world position while the camera is at the origin.

```json
{ "class": "ParallaxLayer", "name": "FarHills",
  "config": { "texture": "/img/hills.png", "parallax": 0.2, "zIndex": -2, "offset": { "x": 0, "y": 100 } } }
```

The texture loads while the level loads (`world.loader.loadTexture`). A no-op (`undefined`) without a
visual scene. No live serializer: it serializes through its spawn record.

### `"Environment"` (2D) - a background for as long as the level is loaded

`config: { background? }`, where `background` is a `0xRRGGBB` number, `{ "image": "url" }` (a
screen-fixed image scaled to cover the view) or `null`. The resulting `Environment2dEntity` behaves
like the 3D `Environment3dEntity` above: applies the field when spawned, restores the previous value
when removed, with the same any-order behavior for several at once. A no-op without a visual scene.

### `"Player"` - a capsule-bodied character controller, ready to use (2D and 3D)

#### 3D

A `CharacterController3dEntity`:

```json
{
  "class": "Player",
  "name": "Player",
  "position": { "x": 0, "y": 0, "z": 2 },
  "config": {
    "radius": 0.4,
    "centersDistance": 1.0,
    "walkSpeed": 4,
    "jumpSpeed": 5,
    "display": { "color": 3381606 }
  }
}
```

`config` (`Player3DSettings`): `radius`/`centersDistance` (capsule dimensions, default `0.4`/`1.0`),
plus every gameplay field `CharacterController3dEntity` itself takes (`walkSpeed`,
`runSpeedMultiplier`, `crouchSpeedMultiplier`, `crouchCentersDistance`, `crouchMode`, `jumpSpeed`,
`gravity`, `airControlFactor`) and the underlying mover's tuning (`offset`, `maxStepHeight`,
`minStepWidth`, `maxSlopeClimbAngleRad`, `snapToGroundDistance`, `up`, `ownCollisionGroups`,
`interactWithCollisionGroups`, `pushMass`) - see that class's own doc for defaults. `pushMass`
(default 80) only sizes how hard the character shoves a dynamic body it walks into - not every
backend implements pushing (currently only `packages/ammo`'s), so on one that doesn't it's accepted
but has no effect. Leave `gravity` out entirely to have the character follow `physicsWorld.gravity`
live (including a runtime change via the `gravity` dev-console command); only set it to give this
character a gravity scale different from the rest of the world. `display` (optional,
`DisplayObject3dOpts`) builds a matching capsule mesh via `visualScene.factory.createCapsule`; omit
it (and `display.model`) for a physics-only, invisible character.

`display.model` (`PlayerModel3DSettings`) swaps the auto-generated capsule for a bone-animated
`.glb` character model, loaded via `loadFromGlb` - the rest of `display` (`color`/`shading`/...) is
then ignored:

```json
{
  "class": "Player",
  "name": "Player",
  "position": { "x": 0, "y": 0, "z": 2 },
  "config": {
    "radius": 0.4,
    "centersDistance": 1.0,
    "walkSpeed": 4,
    "jumpSpeed": 5,
    "display": { "model": { "path": "assets/characters/blockman" } }
  }
}
```

`path` is passed straight to `loadFromGlb` (no paired `.meta` needed - this is a plain visual-only
`.glb`, not the GG GLB+meta pipeline `"Glb"` below uses). `offset` (default: the capsule's own
bottom, i.e. `-(radius + centersDistance / 2)` along `up`) shifts the loaded model relative to the
capsule's center - the default matches a model authored with its origin at the feet, the common
convention for a character rig; pass `{"x":0,"y":0,"z":0}` for a model already centered on the
capsule. `animations` (`CharacterAnimationClipMap`) maps a built-in animation state
(`"idle"`/`"walk"`/`"run"`/`"crouch"`/`"jump"`) to that model's own clip name, only needed when the
model's clips aren't already named exactly that. `fadeDuration` (default 0.2s) sets the crossfade
applied on every state switch. `groundedTransitionDelay` (default 0.15s) sets how long the raw
`isGrounded` reading must hold steady before the animation state trusts it - `isGrounded` flickers
tick-to-tick right at the edge of a platform (an adapter's own sweep/overlap check toggling with no
actual movement involved), and without this debounce that flicker would visibly pop the animation
between `"jump"` and whatever grounded state applies every single tick; `0` disables the debounce
entirely (every raw flip trusted immediately) if that's ever actually wanted.

Setting `display.model` also wires a `CharacterAnimationController` in automatically, as a child of
the returned `CharacterController3dEntity` (`entity.addChildren(...)`, not a separate top-level
level entity - `level.getChildEntityByName('Player')` still returns the character itself, unchanged)
- it reads the character's own `isGrounded`/`isCrouching`/`isRunning`/`moveDirection` every tick and
switches clips accordingly, with no app code needed. For a character built outside a level JSON (or
one needing custom state logic), construct `CharacterAnimationController` directly instead - see its
own doc in `packages/core/src/3d/entities/controllers/character-animation.controller.ts`.

Unlike `"GgCar"`, this only builds the physics+visual capsule - **not** the keyboard/mouse/camera
wiring (`PlayerCharacterController`), since that inherently needs a live canvas/`KeyboardInput`/
renderer the level JSON has no notion of, the same reason `"Camera"` above only builds a positioned
`Camera3dEntity` while `FreeCameraController`/`OrbitCameraController` wiring happens in app code.
Look the character up once the level is loaded and wrap it yourself:

```typescript
const player = level.getChildEntityByName<CharacterController3dEntity>('Player');
const renderer = world.addRenderer(cameraEntity.camera, canvas);
const controller = new PlayerCharacterController(world.keyboardInput, player, renderer, { mouseOptions: { canvas } });
world.addEntity(controller);
```

#### 2D

A `CharacterController2dEntity`:

```json
{
  "class": "Player",
  "name": "Player",
  "position": { "x": 0, "y": 0 },
  "config": {
    "radius": 0.4,
    "centersDistance": 1.0,
    "walkSpeed": 4,
    "jumpSpeed": 5,
    "display": { "color": 3381606 }
  }
}
```

`config` (`Player2DSettings`): `radius`/`centersDistance` (capsule dimensions, default `0.4`/`1.0`),
plus every gameplay field `CharacterController2dEntity` itself takes (`walkSpeed`,
`runSpeedMultiplier`, `crouchSpeedMultiplier`, `crouchCentersDistance`, `crouchMode`, `jumpSpeed`,
`gravity`, `airControlFactor`) and the underlying mover's tuning (`offset`, `maxStepHeight`,
`minStepWidth`, `maxSlopeClimbAngleRad`, `snapToGroundDistance`, `up`, `ownCollisionGroups`,
`interactWithCollisionGroups`, `pushMass`) - see that class's own doc for defaults, identical
field-for-field to the 3D `Player3DSettings` above just projected into 2D (`up` a `Point2`, no
`Point3`/`Point4` fields). Leave `gravity` out entirely to have the character follow
`physicsWorld.gravity` live; only set it to give this character a gravity scale different from the
rest of the world. `display` (optional, `DisplayObject2dOpts`) builds a matching capsule mesh via
`visualScene.factory.createCapsule`; there's no `world.visualScene` check bypass the way 3D's is
documented - a level with no visual scene simply builds no mesh at all (physics-only character),
regardless of `display`.

Unlike the 3D `"Player"` class, there is no `display.model` equivalent here yet: an animated
character in 2D would need a frame-atlas sprite (`IAnimatedDisplayObject2dComponent`, driven by
`CharacterAnimation2dController`) loaded from a path, but `IDisplayObject2dComponentFactory` has no
method to load a texture atlas by path at all today (only `createPrimitive`/its box/circle/capsule/
convexHull/polygon shortcuts) - there's nothing this class could call to build one, the way the 3D
class calls `loadFromGlb`. This is a documented gap (see `Player2DSettings`'s own doc comment in
`packages/core/src/2d/level-loader.ts`), not an oversight: until a 2D visual factory gains an
atlas/sprite-sheet loading method, an animated-sprite character has to be assembled by app code
instead - construct the capsule via `world.loader.createEntity({ class: "Player", ... })` (or just
`new CharacterController2dEntity(...)` directly) with no `display`, build the animated sprite
separately via whatever adapter-specific API loads a texture atlas, assign it to
`character.object2D` yourself, and drive it with a `CharacterAnimation2dController` exactly as
`gg-engine-core-development`'s "The TypeDocRepo generic pattern" section describes for
`IAnimatedDisplayObject2dComponent`.

Like the 3D class, this only builds the physics+visual capsule - **not** any keyboard/input wiring
(a `PlayerCharacterController2d`-style driver), since that needs a live canvas/`KeyboardInput` the
level JSON has no notion of. Look the character up once the level is loaded and wrap it yourself:

```typescript
const player = level.getChildEntityByName<CharacterController2dEntity>('Player');
// e.g. wire an input driver to set this every tick, or drive it from AI logic
player.moveDirection = 1;
```

### `"Glb"` (3D only) - a GG GLB+meta model, loaded and added to the world

```json
{ "class": "Glb", "name": "Scene", "position": { "x": 0, "y": 0, "z": 0 }, "config": { "path": "assets/my-scene" } }
```

`config` (`Glb3DSettings`): `path` (required - passed straight to `Gg3dLoader.loadGgGlb`, see
`gg-engine-app-development`/`packages/core/src/3d/loader.ts` for the GLB+`.meta` sidecar format and
the Blender exporter that produces it), plus optional `cachingStrategy` (`"Nothing"`'s enum value
to load this entry outside the loader's cache; cached otherwise, so several entries with one `path`
fetch and parse the file once)/`loadProps`/`propsPath`/
`nameScope`/`castShadow`/`receiveShadow` mirroring `loadGgGlb`'s own `LoadOptions` (the last two set
shadows on every mesh of the model and its props; omitted, they stay as authored in the file). Missing `path` throws `Path is required for
Glb class`.

A GLB (with `loadProps` on, the default) can expand into several `Entity3d`s - the model itself plus
any nested props/scenes. All of them - flattened, regardless of nesting depth - are added as
children of one `GroupEntity` (distinct from the level's own root group), which is what
`level.getChildEntityByName` on the `"Glb"` entity's own `name` hands back. That group *is* parented
under the level's root, so it's still torn down along with the rest of the level.

**Names of the entities a GLB expands into.** Blender object names are identical on every load of a
file, and `GgWorld` enforces world-wide name uniqueness (`addEntity` rejects a collision outright,
touching nothing), so `loadGgGlb` scopes every entity it produces under a `nameScope`: each one is
named `` `${nameScope}__${objectName}` `` (the body's, else the display object's, native name;
its index in the load result when neither has one), and every prop/scene dummy recurses under
`` `${nameScope}__${dummy.name}` ``. The `"Glb"` class passes the entity's own resolved name as that
scope by default - `"Scene"` in the snippet above, so the model's `Suzanne` object becomes
`Scene__Suzanne`, and a prop placed by a dummy named `RadioSpot` yields `Scene__RadioSpot__Radio`;
an unnamed `"Glb"` entry gets the level-derived `` `${levelName}__Glb_${index}` `` fallback as its
scope instead. Either way the scope is unique in the world and deterministic per level document, so
two `"Glb"` entries pointing at the same file never collide and peers agree on every name. Look
such an entity up as `world.getEntityByName('Scene__Suzanne')` (or
`level.getChildEntityByName(...)`). Set `config.nameScope` to a string to pick the scope
explicitly, or to `null` to keep the raw Blender names (only safe when nothing else in the world
loads that file).

### `"GgCar"` (3D only) - a procedural `GgCarEntity`, ready to use

```json
{
  "class": "GgCar",
  "name": "PlayerCar",
  "position": { "x": 0, "y": 0, "z": 1 },
  "config": {
    "chassis": { "dimensions": { "x": 1.8, "y": 4, "z": 0.6 }, "material": { "color": 8947848 }, "body": { "mass": 900 } },
    "wheelBase": {
      "shared": { "frictionSlip": 1000, "rollInfluence": 0.2, "display": { "wheelObjectDirection": "z" } },
      "front": { "halfAxleWidth": 1, "axlePosition": 1.7, "axleHeight": 0.3, "tyreRadius": 0.35, "tyreWidth": 0.2 },
      "rear": { "halfAxleWidth": 1, "axlePosition": -1, "axleHeight": 0.3, "tyreRadius": 0.4, "tyreWidth": 0.3 }
    },
    "suspension": { "stiffness": 20, "damping": 2.3, "compression": 4.4, "restLength": 0.53 },
    "tractionBias": 0,
    "engine": { "minRpm": 700, "maxRpm": 7000, "torques": [{ "rpm": 1000, "torque": 270 }, { "rpm": 7000, "torque": 430 }], "maxRpmIncreasePerSecond": 8000, "maxRpmDecreasePerSecond": 8000 },
    "brake": { "frontAxleForce": 350, "rearAxleForce": 300, "handbrakeForce": 1500 },
    "transmission": { "isAuto": false, "drivelineEfficiency": 0.85, "finalDriveRatio": 3.21, "reverseGearRatio": -2.33, "gearRatios": [2.92, 1.87, 1.42, 1.09, 0.81], "upShifts": [7140, 7140, 7140, 7140, 7140], "autoHold": false },
    "maxSteerAngle": 0.35
  }
}
```

This is the procedural counterpart of the GLB-driven car construction an app does by hand when a
car's chassis/wheels come from modeled meshes (see `examples/3d/fly-city`'s
`GameFactory.generateCar`/`RaycastVehicle3dEntity` for that path) - `"GgCar"` builds a box chassis
and cylinder wheel meshes procedurally instead, which is enough for a physics playground or a
placeholder vehicle without any asset pipeline.

`config` (`GgCar3DSettings`) always needs `chassis.dimensions` plus every field of `GgCarProperties`
that isn't wheel-shaped - `suspension`, `tractionBias`, `engine`, `brake`, `transmission`,
`maxSteerAngle`, and optionally `mpsToRpmFactor` - passed through as plain data exactly as
`GgCarEntity`'s constructor expects them. For wheels, supply exactly one of:

- `wheelBase: { shared?, front, rear }` - a symmetric 4-wheel car, `front`/`rear` each
  `{ halfAxleWidth, axlePosition, axleHeight, ...sharedWheelFields }`, inheriting anything they
  don't set from `shared`.
- `wheelOptions: [{ isFront, isLeft, position, ...sharedWheelFields }, ...]` plus optional
  top-level `sharedWheelOptions` - an arbitrary wheel layout (e.g. more than 4 wheels), one entry
  per wheel.

Missing `chassis.dimensions`, or specifying neither `wheelBase` nor `wheelOptions`, throws.

A wheel's visual mesh can't be declared by referencing an existing display object component (a
level JSON has no way to name one) - instead, giving a wheel (or whatever it inherits from) a
`display: { material?, wheelObjectDirection? }` block makes the generator build a cylinder mesh
itself via `visualScene.factory.createCylinder`, sized to that wheel's own (or inherited)
`tyreRadius`/`tyreWidth` (falling back to `0.4`/`0.3` if neither is set anywhere). Omit `display`
entirely (on both the wheel and whatever it inherits from) to leave that wheel invisible
(physics-only) - same as leaving `WheelDisplayOptions.displayObject` unset programmatically.
`display` inheritance from `shared`/`sharedWheelOptions` is a plain shallow merge (a wheel's own
`display` fully replaces, rather than merges into, an inherited one) - repeat fields on the wheel
itself to keep some and override others.

Steering/throttle/braking still have to be driven by app code once the level is loaded, same as any
other entity a level JSON can't wire up on its own - look the car up with
`level.getChildEntityByName<GgCarEntity>('PlayerCar')` and drive it directly (`car.acceleration`,
`car.steeringFactor`, `car.brake`, `car.handBrake`) or via a `GgCarHandlingController`
attached with `car.addController(...)`.

An optional `state` block - `{ gear?, acceleration?, brake?, handBrake?, steeringFactor? }` - sets
the car's initial driving state right after construction, e.g. to spawn a car already mid-gear and
moving rather than parked in neutral:

```json
{ "class": "GgCar", "config": { "...": "...", "state": { "gear": 2, "acceleration": 0.6 } } }
```

`GgCarEntity` implements `ISerializableEntity` (see "Serializing an entity or a level back to JSON"
above), so `world.loader.serializeEntity(car)` reconstructs a `"GgCar"` `EntityJson` directly from
the live car - every `GgCar3DSettings` field above (chassis `dimensions` recovered from the live
chassis body, `material` recovered when the chassis/wheel meshes implement
`IMaterialReadable3dComponent`, `engine`/`brake`/`transmission`/`suspension`/`tractionBias`/
`maxSteerAngle`/`mpsToRpmFactor`/`wheelBase`/`wheelOptions` read straight off `carProperties`) plus
a `state` block reflecting the car's *current* `gear`/`acceleration`/`brake`/`handBrake`/
`steeringFactor` - not just whatever it was originally spawned with. This works for a `"GgCar"`
built through a level JSON and for one built directly (`new GgCarEntity(...)`) alike.

### `"MapGraph"` (3D only) - a ready-to-use `MapGraph3dEntity`

```json
{
  "class": "MapGraph",
  "name": "CityMap",
  "config": {
    "graph": {
      "nodes": [
        { "path": "assets/tiles/a", "position": { "x": 0, "y": 0, "z": 0 } },
        { "path": "assets/tiles/b", "position": { "x": 75, "y": 0, "z": 0 } }
      ],
      "closed": false
    },
    "loadDepth": 3,
    "inertia": 1,
    "maxNodesLoadingPerTick": 1,
    "loadRateLimit": 1
  }
}
```

`config` (`MapGraph3DSettings`) builds a `MapGraph` from plain node data via the same two shapes
`MapGraph`'s own factory methods take, since both are already plain-data-in: a flat (optionally
`closed`-into-a-loop) path via `graph: { nodes: [...], closed? }` (`nodes`/`grid` entries are
`MapGraphNodeType` - `path`, `position`, optional `rotation`, optional `loadOptions` defaulting to
`{}`), or a rectangular grid via `graph: { type: "grid", grid: [[...], [...]] }`. `loadDepth`/
`inertia`/`maxNodesLoadingPerTick` map straight onto `Gg3dMapGraphEntityOptions` (see
`MapGraph3dEntity`'s own doc comments for what each controls); `loadRateLimit` sets
`MapGraph3dEntity.loadRateLimit` after construction. Missing `graph`, an empty `graph.nodes`, or an
empty `graph.grid` throws.

The returned `MapGraph3dEntity` doesn't implement `IPositionable3d` (every node already carries its
own absolute `position`/`rotation`), so there's no `position`/`rotation` field on the `"MapGraph"`
entity itself, and it starts out never loading anything - `loaderCursor$` still has to be driven at
runtime from whatever entity's position should determine which nodes are in range, same as
`examples/3d/fly-city`'s `GameFactory.setupMapGraph` does against a render cursor:

```typescript
const mapGraph = level.getChildEntityByName<MapGraph3dEntity>('CityMap');
createInlineTickController(world).subscribe(() => {
  mapGraph.loaderCursor$.next(playerEntity.position);
});
```

### `"Sound"` - a ready-to-use, statically-positioned audio source (2D and 3D)

Requires the world to have an `audioScene` (see `gg-engine-audio-adapter`) - with none, this class
is a no-op (`undefined`, same posture as `"Trigger"`/`"Camera"` with no physics/visual scene), not
a thrown error.

```json
{
  "class": "Sound",
  "name": "CampfireCrackle",
  "position": { "x": 4, "y": 0, "z": 0.5 },
  "config": { "path": "assets/audio/campfire.mp3", "refDistance": 2, "maxDistance": 20 }
}
```

`config` (`Sound3DSettings`/`Sound2DSettings`): `path` (required - fetched+decoded via
`world.loader.loadClip`), `loop` (default `true` - a static/ambient sound is normally
continuous), `volume`, `playbackRate`, `spatial` (default `true`), `bus` (default `"sfx"`),
`autoplay` (default `true`), and the 3D-only/2D-only distance-rolloff fields
(`refDistance`/`maxDistance`/`rolloffFactor`/`distanceModel`) matching `IAudioSource(3d|2d)Component`
directly. Missing `path` throws `"path" is required for Sound class`.

This one class covers both `AudioSource3dEntity`'s "static" and "ambient/level music" placement
modes - level music is just a `"Sound"` entity with `spatial: false, loop: true, bus: "music"`, not
a separate class. It does **not** cover "attached to another entity" (a level JSON has no way
to reference a not-yet-loaded entity - the same reason a `"GgCar"` wheel's mesh can't reference an
existing display object either) or one-shot/transient playback (nothing static to declare - see
`AudioSource(3d|2d)Entity.playOneShot` for app code, or the `"PlaySound"` blueprint node below for a
declarative trigger). An attached, continuous sound (e.g. a car engine) is app code, looked up the
same way a `"Player"`'s controller or a `"GgCar"`'s steering is:

```typescript
const car = level.getChildEntityByName<GgCarEntity>('PlayerCar');
const clip = await world.audioScene!.factory.loadClip('assets/audio/engine-loop.mp3');
const engineSound = new AudioSource3dEntity(world.audioScene!.factory.createSource({ clip, loop: true }), car);
world.addEntity(engineSound);
```

## Blueprints - wiring entity events to behavior declaratively

A blueprint is a small node graph, serializable as a `BlueprintJson`, that runs behavior in
response to an entity's observable firing - the engine's analogue of an Unreal Blueprint event
graph (no visual editor yet, just the JSON graph and its runtime). Any observable property on the
just-created entity works, not just `onEntityEntered`/`onEntityLeft` - e.g. `onCollisionStart`/
`onCollisionEnd` (see "Collision events" above) for reacting to an actual physical hit rather than a
trigger overlap. It replaces code like:

```typescript
const killZone = level.getChildEntityByName<Trigger3dEntity>('KillZone');
killZone.onEntityEntered.subscribe(entity => world.removeEntity(entity, true));
```

with a declarative binding entirely inside the level JSON. For a single built-in/registered node
used with its default settings, a bare node type alias as the event's value is all that's needed -
no `blueprints` entry at all:

```json
{
  "class": "Trigger",
  "name": "KillZone",
  "config": { "dimensions": { "x": 10, "y": 1, "z": 10 } },
  "events": { "onEntityEntered": "RemoveEntity" }
}
```

Need non-default settings on that one node (e.g. `RemoveEntity`'s `dispose` flag)? Use the
`{ type, settings }` object form instead of the bare string - still no `blueprints` entry:

```json
"events": { "onEntityEntered": { "type": "RemoveEntity", "settings": { "dispose": true } } }
```

`EntityJson.events` is `Record<eventPropertyName, EntityEventBinding>`, where an
`EntityEventBinding` is either form above. For each entry, `createEntity` (and therefore `loadLevel`,
which builds every entity through it - see "Building a single entity outside a level" above) reads
that observable property off the just-created entity (e.g. `Trigger3dEntity.onEntityEntered`),
resolves the binding to a `BlueprintJson` (see below), builds a fresh `Blueprint` instance from it,
and subscribes so every value the observable emits triggers that blueprint's `"in"` entry point with
that value as the payload. The binding itself is a plain `IEntity`, parented directly under the
entity it's bound to (not under the level's group, and not requiring one) - so disposing/removing
(with `dispose: true`) that entity tears the binding down right along with it, whether that happens
on its own (a `createEntity`-built entity outside any level) or as part of `world.removeEntity(level,
true)` tearing down a whole level - nothing else to clean up by hand either way.

A **string** binding is tried, in order: (1) as a key into the level's own top-level `blueprints`
map (a named, possibly multi-node graph - see below); (2) if not found there, as a bare node type
alias registered via `registerBlueprintNode`, with no settings - shorthand for the object form with
`settings` omitted. A **`{ type, settings? }`** binding always goes straight to the object form,
skipping the `blueprints` map entirely. Either shorthand form only works for a node type registered
with a *default input pin* (see `registerBlueprintNode` below - every built-in node type has one);
for anything else (multiple nodes, links between them, a node with several input pins, or a node
type with no default pin registered) declare a full graph in `blueprints` and reference it by name
instead. A binding that can't be resolved (unknown blueprint name *and* unknown node type alias, a
`{ type }` naming a node with no default input pin, or a non-observable event property name) is a
`console.warn` and that one binding is skipped, not a thrown error.

Before every run, a binding asks `world.eventAuthority(entity, eventName, payload)` - `false`
skips that run. It defaults to always `true`; a network layer (`@gg-web-engine/multiplayer`)
installs a rule there while a session is joined, so a gameplay-consequential binding (a kill zone
removing what entered it) runs on exactly one peer instead of on every peer that saw the overlap.

Each binding gets its own `Blueprint` instance (and therefore its own node instances), even when
several entities' `events` reference the same blueprint name or node type - so per-node state a
future node might hold (e.g. a delay timer) is never accidentally shared between unrelated
bindings.

### Full graphs: `LevelJson.blueprints`

For anything beyond a single default-settings-shaped node - multiple nodes, `links` between them,
or targeting a specific pin on a multi-pin node - declare a named graph in the level's top-level
`blueprints` map (`Record<blueprintName, BlueprintJson>`) and reference it by name from `events`:

```json
{
  "entities": [
    { "class": "Trigger", "name": "KillZone", "config": {...}, "events": { "onEntityEntered": "RemoveOnEnter" } }
  ],
  "blueprints": {
    "RemoveOnEnter": {
      "nodes": [{ "id": "n1", "type": "RemoveEntity", "settings": { "dispose": true } }],
      "inputs": { "in": { "node": "n1", "pin": "entity" } }
    }
  }
}
```

`BlueprintJson` has `nodes` (`{ id, type, settings? }[]` - `type` is a node type alias registered
via `world.loader.registerBlueprintNode`, the same registry pattern as `registerClass` one level
down), optional `links` (`{ from: { node, pin }, to: { node, pin } }[]` wiring one node's output pin
to another's input pin), and `inputs`/`outputs` (`Record<name, { node, pin }>`) exposing named
entry/exit points at the graph's own boundary. **Every entity-event binding always triggers the
entry declared under the fixed name `"in"`** - a `BlueprintJson` meant to be used from
`EntityJson.events` must declare `inputs: { in: { node: ..., pin: ... } }`. `outputs` has no
consumer yet (reserved for a future blueprint nested inside a larger graph) but is parsed and usable
via `Blueprint.output(name)` today. A named `blueprints` entry shadows a same-named node type alias
for the string-binding lookup order described above - e.g. a level can declare its own
`"blueprints": { "RemoveEntity": {...} }` graph and every event bound to the bare string
`"RemoveEntity"` runs that graph instead of the built-in node type directly.

### Built-in blueprint node: `"RemoveEntity"`

Registered by every `LevelLoader` out of the box (`RemoveEntityBlueprintNode` in
`packages/core/src/base/blueprint/nodes/remove-entity.node.ts`), with `"entity"` registered as its
default input pin (see below) - which is what makes both shorthand `events` forms above work for it
with no `blueprints` entry. One input pin, `"entity"` - a data pin that also acts as this node's
trigger, since it's meant to sit directly behind an `EntityJson.events` binding whose observable
emits the entity to act on (e.g. `onEntityEntered`/`onEntityLeft`). No output pins.
`settings.dispose` (boolean, default `false`) controls whether the removal also disposes the
entity, exactly like the `dispose` argument of `GgWorld.removeEntity` - it's a static setting baked
into the node's JSON, not a wired pin.

### Built-in blueprint node: `"PlaySound"`

Also registered by every `LevelLoader` out of the box (`PlaySoundBlueprintNode` in
`packages/core/src/base/blueprint/nodes/play-sound.node.ts`, dimension-agnostic - it only touches
`audioScene.factory`/`IAudioSourceComponent`, never a 2D/3D-specific entity type), with `"trigger"`
as its default input pin. This is the "pop a one-shot sfx when something happens" node - e.g. wired
to a `"Trigger"` entity's `onEntityEntered` for an impact sound:

```json
{
  "class": "Trigger",
  "name": "SignHitbox",
  "config": { "dimensions": { "x": 1, "y": 1, "z": 2 } },
  "events": {
    "onEntityEntered": { "type": "PlaySound", "settings": { "clip": "assets/audio/sign-clang.mp3", "volume": 0.8 } }
  }
}
```

`settings` (`PlaySoundNodeSettings`): `clip` (required - a URL, loaded via `world.loader.loadClip`,
so it is fetched and decoded once however often the node fires, is preloaded with the level that
declares the node, and is freed when the node is disposed), `volume`, `playbackRate`, `spatial` (default
`true`), `bus` (default `"sfx"`), and an optional fixed `position` overriding where it plays. With
no `position` set, it uses the triggering value's own `.position` if it has one - true for whatever
`onEntityEntered`/`onEntityLeft` emit (an `IEntity & IPositionable(2d|3d)`) and for `onCollisionStart`'s
payload (see "Collision events" above), which is exactly what makes the "impact where something hit
a trigger/body" pattern above work with zero extra wiring: the sound plays at the point of contact,
not the trigger/body's own center. A world with no `audioScene`, or a binding with no `clip` setting
(and no matching `impactClips` tier - see below), logs a warning and does nothing (same posture as
`"RemoveEntity"` triggered without a valid entity). The spawned source disposes itself once playback
ends - nothing to clean up by hand, same lifecycle as `AudioSource(3d|2d)Entity.playOneShot`, which
this node is the blueprint-graph equivalent of.

For "different sounds on light and hard hits", add `impactClips` - a `{ minImpulse, clip, volume?,
playbackRate? }[]` matched against the triggering payload's own `impulse` (duck-typed the same way
`position` is above; present on `onCollisionStart`'s payload, absent on a plain trigger's
`onEntityEntered`/`onEntityLeft`). The node picks the highest-`minImpulse` tier that's still `<=` the
payload's `impulse`, falling back to the top-level `clip`/`volume`/`playbackRate` when no tier
matches or the payload carries no numeric `impulse` at all:

```json
{
  "class": "Primitive",
  "name": "Bumper",
  "shape": "BOX",
  "config": { "dimensions": { "x": 1, "y": 2, "z": 1 } },
  "events": {
    "onCollisionStart": {
      "type": "PlaySound",
      "settings": {
        "clip": "assets/audio/tap.mp3",
        "impactClips": [
          { "minImpulse": 30, "clip": "assets/audio/crash-light.mp3" },
          { "minImpulse": 150, "clip": "assets/audio/crash-hard.mp3", "volume": 1 }
        ]
      }
    }
  }
}
```

### Registering an app-defined blueprint node

Same shape as `registerClass` for entity classes, one level down - extend `BlueprintNode`, declare
`inputs`/`outputs` (each `{ name, kind: 'exec' | 'data' }` - `kind` is descriptive only right now,
every input pin runs `trigger()` uniformly regardless of kind), implement `trigger(inputName,
value)`, and call `this.emit(outputName, value?)` from inside `trigger` to fire an output pin
(observable via `node.output(outputName)`, which is what a `BlueprintLinkJson` subscribes to):

```typescript
class LogNode extends BlueprintNode {
  public readonly inputs = [{ name: 'in', kind: 'data' as const }];
  public readonly outputs = [{ name: 'out', kind: 'exec' as const }];

  public trigger(inputName: string, value?: unknown): void {
    if (inputName !== 'in') return;
    console.log(this.settings.label ?? 'blueprint:', value);
    this.emit('out');
  }
}

world.loader.registerBlueprintNode('Log', (w, settings) => new LogNode(w, settings), 'in');
```

Register before loading any level JSON whose `blueprints`/`events` reference the new `type` - a
`nodes` entry with an unregistered `type` is a `console.warn` and that node (and anything wired
to/from it) is skipped, same failure-is-a-warning posture as an unregistered entity `class`. The
third `registerBlueprintNode` argument (`'in'` above) names the node type's *default input pin* -
pass it whenever the node has one obviously-correct single input pin, to make the type usable
directly from `EntityJson.events` (bare string or `{ type, settings? }`) without a `blueprints`
entry; omit it for a node with zero, multiple, or no obviously-default input pins - it remains
usable from a full graph either way, just not the `events` shorthand.

## App-defined entity classes

Register a generator - a `(world, settings) => IEntity` function or arrow wrapping a class
constructor - against a new class alias via `registerClass`, **before** loading the level JSON that
references it. The generator **must** return an `IEntity`; anything else (including a `Promise`
that resolves to something else, `null`, or `undefined`) makes `loadLevel` log a `console.warn` and
skip that entity - see "Loading a level, and tearing it back down" above.

A generator that loads files gets two more things to use. It receives the load's options as a third
argument and passes them on to whatever `world.loader` method it calls, which makes the load part of
the level's progress, cancellable with it, and freed with the level. And the class can declare its
files up front with an `assets` hook, so the level loads them in parallel with everything else before
building (and knows its total from the start) - the generator's own call then just finds them cached:

```typescript
world.loader.registerClass(
  'Statue',
  async (w: Gg3dWorld, settings: { model: string }, load: LoadTaskOptions) => {
    const object3D = await w.loader.loadModel(settings.model, load);
    return new Entity3d({ object3D });
  },
  { assets: (settings: { model: string }) => [{ kind: 'glb', url: settings.model }] },
);
```

An `AssetRef` names one loader call: `{ kind: 'ggGlb', url, loadProps?, propsPath? }` (`loadGgGlb`),
`{ kind: 'glb', url, options? }` (`loadModel`), `{ kind: 'texture', url, options? }` (`loadTexture`),
`{ kind: 'cubeTexture', faces }`, `{ kind: 'clip', url }`. For the cache to be hit, `url` and
`options` must be exactly what the generator passes (a `loadModel` with an `offset` is a different
entry from one without). The hook is optional: without it the generator's loads are counted from
the moment it makes them. The third `registerClass` argument is either this options object (with
`entityClass` next to `assets`) or, as a shorthand, the entity constructor alone.
`registerBlueprintNode` takes the same kind of hook as its fourth argument.

For a class whose own behavior isn't naturally entity-shaped - e.g. a spawner that just hooks a
clock subscription, with nothing to render or physically simulate itself - extend `IEntity` anyway
purely to satisfy the contract, and use `dispose()` to tear down whatever the constructor set up:

```typescript
interface ShapeSpawnerSettings {
  interval?: number;
  area: { min: Point3; max: Point3 };
}

class ShapeSpawner extends IEntity {
  static readonly entityTypeName: string = 'ShapeSpawner';
  public readonly tickOrder = TickOrder.CONTROLLERS;
  private readonly clock: PausableClock;
  private readonly spawnSub: Subscription;

  constructor(world: Gg3dWorld, settings: ShapeSpawnerSettings) {
    super();
    this.clock = world.createClock(true);
    this.clock.tickRateLimit = 1 / (settings.interval ?? 0.5);
    this.spawnSub = this.clock.tick$.subscribe(() => {
      /* spawn something inside settings.area, e.g. via world.addPrimitiveRigidBody(...) */
    });
  }

  public override dispose(): void {
    this.spawnSub.unsubscribe();
    this.clock.stop();
    super.dispose();
  }
}

world.loader.registerClass('ShapeSpawner', (w: Gg3dWorld, settings: ShapeSpawnerSettings) =>
  new ShapeSpawner(w, settings),
);
await world.loader.loadLevel(level, 'MainLevel'); // level has an entity with "class": "ShapeSpawner"
```

There's nothing engine-specific about `ShapeSpawner` here - it's ordinary app code, registered the
same way the built-in `"Primitive"`/`"Trigger"`/`"Camera"`/`"Light"`/`"Environment"`/`"ParallaxLayer"`/`"Player"`/`"Glb"`/`"GgCar"`/`"MapGraph"`
classes are internally.
Extending `IEntity` is what makes it eligible to be parented under the level's group (so
`world.removeEntity(level, true)` disposes it - and, via the `dispose` override, stops its clock -
along with the rest of the level) and findable via `level.getChildEntityByName`/
`world.getEntityByName` (see "Finding entities by name" above) if given a `name` in the JSON.
`tickOrder` just needs any valid value since this class doesn't use its own `tick$` (it drives
itself off a separate `PausableClock` running at its own `interval`, not the per-frame tick every
`IEntity` gets for free) - `TickOrder.CONTROLLERS` is as good a choice as any here. Both
`primitives` demos (`examples/2d/primitives`, `examples/3d/primitives`) register and use a
`ShapeSpawner` this way, kept in a sibling `shape-spawner.ts` file (exporting
`ShapeSpawner`/`ShapeSpawnerSettings`) and imported into `index.ts`, replacing what would otherwise
be a hand-rolled spawn timer. `examples/2d/primitives` is the simplest complete reference - just a
static floor plus the spawner, no `"Trigger"`/`"Camera"` entities; `examples/3d/primitives` is the
same idea plus a `"Trigger"` kill-floor and a `"Camera"` (each runs on either physics adapter of
its dimension, see `gg-engine-examples`).

A `class` with no registered generator logs `console.warn('No generator registered for class alias
"..."')` and is skipped rather than throwing - so a level JSON referencing an app class must have
that class registered first, or that entity silently disappears.

`static readonly entityTypeName` (`ShapeSpawner` above declares one) is required on every
app-defined entity class, not optional - see `gg-engine-app-development`'s own section on this. It's
a stable, class-identifying string every entity's auto-generated default name is built from - it's
what makes an instance loaded with no explicit `name` in its `EntityJson` read as `ShapeSpawner_0` in
the dev console instead of an opaque `e0x7`; without it, only entities explicitly named in level JSON
(or given the `` `${levelName}__${classAlias}_${index}` `` fallback name loaded-but-unnamed level
entities get - see the `name` field under "Shape of a level JSON" above) stay readable, and anything
the class spawns at runtime beyond what the level JSON itself describes (e.g. `ShapeSpawner`'s own
spawned shapes) falls back to the opaque default without it. It's unrelated to
`LevelLoader.serializeEntity`/`serializeLevel` (see "Serializing an entity or a level back to JSON"
above) - that round-trip keys its reconstruction off the `class` alias an entity was actually built
under via `createEntity`/`loadLevel`, not off `entityTypeName`.

### Making an app-defined entity class serializable

Implement `ISerializableEntity` (`packages/core`'s `base/interfaces/i-serializable-entity.ts`) - one
method, `serializeSettings(): { shape?: string; config?: Record<string, any> }` - directly on the
entity class to make it round-trip through `world.loader.serializeEntity`/`serializeLevel`, the same
way the built-in `"GgCar"` class does (see its own section above). Called fresh every time
`serializeEntity` runs, never cached, so it should read the entity's own current fields/properties -
not just echo whatever it happened to be constructed with - the same way `GgCarEntity` returns its
*current* `gear`/`acceleration`/etc., not the values it started with. This is the mechanism to reach
for on any entity class an app defines that needs to be a P2P-multiplayer spawn target, a savegame
entry, or otherwise reconstructable later - not `registerSerializer`/`registerLiveSerializer` (see
"Serializing an entity or a level back to JSON" above), which exist for overriding serialization
*from outside* a class you don't own:

```typescript
class ShapeSpawner extends IEntity implements ISerializableEntity {
  // ...constructor, dispose, etc. as above...

  public serializeSettings(): { config: Record<string, any> } {
    return { config: { interval: 1 / this.clock.tickRateLimit, area: this.area } };
  }
}
```

For `serializeEntity` to resolve this entity's `class` alias, either build every instance through
`createEntity`/`loadLevel` (which remembers the alias it was built under automatically), or pass the
class itself as `registerClass`'s optional third argument so an instance built directly (`new
ShapeSpawner(...)`) resolves too: `world.loader.registerClass('ShapeSpawner', generator,
ShapeSpawner)`. Omit the third argument for a class whose generator can produce more than one
concrete class (rare for an app-defined class - `"Primitive"` is the built-in example) or that
doesn't implement `ISerializableEntity` at all; neither case loses anything by omitting it, since a
spawn record already resolves `class` for any instance actually built through the loader.

## Where level JSON content lives

The `examples/primitives-*` demos all declare their level as a hardcoded `const level: LevelJson =
{...}` object directly in `index.ts` and pass it straight to `world.loader.loadLevel(level, 'MainLevel')`
- no separate `.json` file, no `fetch`. This is the right default for a level that's small and
doesn't need to change without a rebuild: it type-checks against `LevelJson` like any other TS
object, and there's no `resolveJsonModule`/loader wiring to think about.

There's no required location or format for an app's own level content in general - reach for a
separate hosted/static `.json` file plus `loadLevelFromUrl(url, levelName)` instead when a level should be
swappable at runtime without a rebuild (CDN-hosted content, user-authored levels, a StackBlitz demo
where a visitor edits the JSON in the IDE pane and reruns). A file-based level still type-checks as
`LevelJson` if imported directly (`import level from './level.json'`, `"resolveJsonModule": true` +
`"esModuleInterop": true` in `tsconfig.json`) rather than fetched; webpack bundles a JSON import out
of the box, no loader config needed. See `gg-engine-examples` for how to add/wire a new example.

## Tests

Core `LevelLoader` behavior (dispatch, `shape`/`position`/`rotation`/`name` merging, group-entity
parenting/teardown) is covered by `packages/core/test/base/level-loader.spec.ts` against a real
`MockWorld` (so `world.addEntity`/`removeEntity` behave for real, not as jest mocks - needed to
exercise spawn/parent/dispose cascades meaningfully) - including its `blueprint event bindings`
describe block, covering `events`/`blueprints` wiring, the missing-blueprint-name and
non-observable-property warning paths, and that a binding is torn down when its level is removed.
The same file's `createEntity` describe block covers the standalone single-entity build API (no
group parenting, no auto-add-to-world, the auto-generated-name-when-omitted case, both warning
paths, and its own `events`/`blueprints` handling - binding a built-in node directly, the binding
being parented under the created entity itself and disposed along with it, and a binding resolved
against a blueprint name passed through the optional third `blueprints` argument); its
`serializeEntity`/`registerSerializer`/`serializeLevel` describe blocks cover the
spawn-record-echo fallback direction - live position/rotation/name readback, the no-spawn-record
warning, a custom serializer overriding the default, and `serializeLevel` silently skipping a level
child with no spawn record (a blueprint event binding). Its own `self-serialization (ISerializableEntity)`
describe block covers tier (2) against a hand-rolled `SelfSerializingEntity`: that `serializeEntity`
prefers a self-serializing entity's own `serializeSettings()` over the spawn-record echo and reflects
state mutated after spawn, that `registerClass`'s optional third `entityClass` argument resolves the
`class` alias for a self-serializing entity built directly (no spawn record at all), that an entity
with neither a spawn record nor a resolvable alias falls through to the same warn-and-`undefined`
path, and that `registerSerializer` still layers onto a self-serialized result the same way it does
onto the spawn-record echo. `packages/core/test/{2d,3d}/level-loader.spec.ts`
each add their own `live serializers` describe block covering the *live*, state-reading direction:
serializing a `"Primitive"`/`"Trigger"` built directly (`new Entity3d(...)`/`new Trigger3dEntity(...)`,
not through `createEntity`/`loadLevel` at all), that the result reflects the body's state as of the
`serializeEntity` call rather than its spawn-time config (moved position, changed velocity), material
recovery via `IMaterialReadable(2d|3d)Component` (present vs. absent on the live display object),
that a richer `Entity3d` subclass isn't mistaken for a plain primitive, and that an entity neither
live serializer recognizes still falls through to the spawn-record echo. These reuse
`test/mocks/body.mock.ts`'s `mock2DBody`/`mock3DBody`, which take optional `shape`/`bodyOptions`
arguments (default: a `1x1(x1)` `BOX` and a plain dynamic-body `BodyOptions`) and construct a real
`DebugBody2DSettings`/`DebugBody3DSettings` plus a `bodyOptions` field, matching what a real
adapter's rigid body component now exposes (see `gg-engine-core-development`'s section on
`IRigidBodyComponent.bodyOptions`), and `test/mocks/object.mock.ts`'s `mock2DObject`/`mock3DObject`
spread together with an extra `materialOptions` field for the material-recovery cases (the plain
object-spread pattern `test/mocks/object.mock.ts`'s own `mockAnimatedObject2d` already uses for a
different optional capability).
`GgCarEntity.serializeSettings` (tier (2)'s reference implementation) has its own `serializeSettings`
describe block in `packages/core/test/3d/entities/gg-car.entity.spec.ts`, covering chassis
`dimensions`/`material`/`body` recovery, `engine`/`brake`/`transmission`/`suspension`/`tractionBias`/
`maxSteerAngle`/`mpsToRpmFactor`/`wheelBase` (`shared`/`front`/`rear`, each stripped of its live
`display.displayObject`) echoed from `carProperties`, and the `state` block reflecting the car's
current `gear`/`acceleration`/`brake`/`handBrake`/`steeringFactor`; `packages/core/test/3d/level-loader.spec.ts`'s
`loadLevel` describe block adds cases for applying an optional `state` config block to a freshly-built
car and for `serializeEntity` on a loader-built car reflecting state mutated after spawn (not a frozen
spawn-time echo). `test/mocks/raycast-vehicle.mock.ts`'s `mockRaycastVehicle` takes the same optional
`shape`/`bodyOptions` arguments as `mock3DBody` (building on it directly, since `IRaycastVehicleComponent
extends IRigidBody3dComponent`, plus the handful of vehicle-only methods) - reach for those whenever
a test needs a vehicle mock with a real, queryable `debugBodySettings`/`bodyOptions`.
`Blueprint` graph wiring itself (node construction, links, `inputs`/`outputs`, `dispose`) has its
own coverage against a hand-rolled node type in
`packages/core/test/base/blueprint/blueprint.spec.ts`; `RemoveEntityBlueprintNode` has its own in
`packages/core/test/base/blueprint/remove-entity.node.spec.ts`. `GgWorld.getEntityByName` and
`IEntity.getChildEntityByName` themselves have their own direct coverage in
`packages/core/test/base/gg-world.spec.ts` and `packages/core/test/base/entities/i-entity.spec.ts`.
`packages/core/test/{2d,3d}/level-loader.spec.ts` cover the built-in `"Primitive"`/`"Trigger"`/
`"Player"`/`"Sound"` classes (both dimensions) plus the 3D-only `"Camera"`/`"GgCar"`/`"MapGraph"`
(`"Light"`/`"Environment"` are in `packages/core/test/3d/lights-environment.spec.ts`, the 2D
`"ParallaxLayer"`/`"Environment"` in `packages/core/test/2d/parallax-environment.spec.ts`)
against hand-rolled mock worlds (there, `addEntity`/`removeEntity` are plain `jest.fn()` stubs - fine
since those tests only care about generator dispatch, not full spawn semantics); the `"GgCar"` cases
stub `physicsWorld.factory.createRigidBody`/`createRaycastVehicle` and
`visualScene.factory.createBox`/`createCylinder`, reusing `mockRaycastVehicle` from
`packages/core/test/mocks/raycast-vehicle.mock.ts` for the vehicle component the generator wraps;
the `"Player"` cases similarly stub `physicsWorld.factory.createCharacterController` and
`visualScene.factory.createCapsule`, reusing `mockCharacterController`/`mockCharacterController2d`
from `packages/core/test/mocks/character-controller.mock.ts`/`character-controller-2d.mock.ts` for
the 3D/2D component the generator wraps respectively - both specs' `live serializers` describe block
additionally covers `serializeEntity` on a `"Player"` built via `createEntity` (self-serialized,
with its `state` block) and a full `serializeEntity`/`createEntity` round trip of non-default options
and runtime state; the `"Sound"` cases stub `audioScene.factory
.loadClip`/`createSource`, reusing `mock3DAudioSource`/`mock2DAudioSource` from
`packages/core/test/mocks/audio-source.mock.ts` for the source component the generator wraps.
`packages/core/test/3d/loader.spec.ts` covers `Gg3dLoader` - the `"Glb"` class, and that
`registerClass`/`loadLevel`/`loadLevelFromUrl` are available directly on it - stubbing `loadGgGlb`
itself, and `preload` with it (the `"Glb"` class declares its file as a level asset, so an unstubbed
`loadLevel` would fetch it). The fetch/parse/cache pipeline is covered by
`packages/core/test/3d/loader-assets.spec.ts`, against `test/mocks/fetch.mock.ts` (a `fetch` serving
files through a stream, with optional `Content-Length`, holdable for abort tests) - use it for
anything about progress, caching, abort or asset lifetime. A spec asserting a generator's call
arguments expects three: `(world, settings, expect.anything())`. Follow their existing structure for new built-in-class test cases -
one `it` per shape/error case is the established pattern. `PlaySoundBlueprintNode` has its own
coverage in `packages/core/test/base/blueprint/play-sound.node.spec.ts` (missing-audioScene/missing-clip
warnings, clip loading, payload-vs-fixed position resolution, self-dispose on `ended$`), and
`GgWorld`'s listener auto-bind/warn behavior has its own `describe` block in
`packages/core/test/base/gg-world.spec.ts` ("audio listener auto-bind").

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
