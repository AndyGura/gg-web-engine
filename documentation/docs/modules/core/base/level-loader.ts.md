---
title: core/base/level-loader.ts
nav_order: 134
parent: Modules
---

## level-loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [EntityEventBinding (type alias)](#entityeventbinding-type-alias)
  - [EntityGenerator (type alias)](#entitygenerator-type-alias)
  - [EntityJson (interface)](#entityjson-interface)
  - [EntitySerializer (type alias)](#entityserializer-type-alias)
  - [LevelJson (interface)](#leveljson-interface)
  - [LevelLoader (class)](#levelloader-class)
    - [registerClass (method)](#registerclass-method)
    - [registerBlueprintNode (method)](#registerblueprintnode-method)
    - [registerSerializer (method)](#registerserializer-method)
    - [registerLiveSerializer (method)](#registerliveserializer-method)
    - [createEntity (method)](#createentity-method)
    - [serializeEntity (method)](#serializeentity-method)
    - [buildEntityJson (method)](#buildentityjson-method)
    - [serializeLevel (method)](#serializelevel-method)
    - [loadLevel (method)](#loadlevel-method)
    - [bindEvent (method)](#bindevent-method)
    - [resolveEventBlueprint (method)](#resolveeventblueprint-method)
    - [inlineNodeBlueprint (method)](#inlinenodeblueprint-method)
    - [loadLevelFromUrl (method)](#loadlevelfromurl-method)
    - [generators (property)](#generators-property)
    - [blueprintNodes (property)](#blueprintnodes-property)
    - [blueprintNodeDefaultInputs (property)](#blueprintnodedefaultinputs-property)
    - [serializers (property)](#serializers-property)
    - [liveSerializers (property)](#liveserializers-property)
  - [LiveEntitySerializer (type alias)](#liveentityserializer-type-alias)

---

# utils

## EntityEventBinding (type alias)

What an `EntityJson.events` entry runs. Either:

- a plain `string` - first tried as a key into the level's top-level `blueprints` map (a named,
  possibly multi-node graph); if not found there, tried as a blueprint node type alias
  registered via `registerBlueprintNode` (e.g. the built-in `"RemoveEntity"`) instead, with no
  settings - shorthand for the single-node form below with `settings` omitted.
- `{ type, settings? }` - a single built-in/registered blueprint node used directly as the
  handler, with inline `settings`, no `blueprints` entry needed at all - e.g.
  `{ "type": "RemoveEntity", "settings": { "dispose": true } }`. Only node types registered with
  a default input pin (every built-in one is - see `registerBlueprintNode`) support this form;
  others require a full graph declared in `blueprints` instead, addressing the desired input pin
  explicitly via `inputs`.

**Signature**

```ts
export type EntityEventBinding = string | { type: string; settings?: Record<string, any> }
```

## EntityGenerator (type alias)

A function that turns per-entity JSON settings into a spawned `IEntity` (e.g. a primitive body,
a trigger, a camera). Registered against a class alias via {@link LevelLoader.registerClass}.
May be `async`/return a `Promise` (e.g. the built-in `"Glb"` 3D class, which fetches a model) -
{@link LevelLoader.loadLevel} awaits every generator before moving to the next entity. A
generator that returns anything other than an `IEntity` (including `null`/`undefined`) has its
result discarded - see {@link LevelLoader.loadLevel}.

**Signature**

```ts
export type EntityGenerator<
  D,
  R,
  TypeDoc extends GgWorldTypeDocRepo<D, R>,
  Settings = any,
  W = GgWorld<D, R, TypeDoc>
> = (world: W, settings: Settings) => any
```

## EntityJson (interface)

JSON description of a single entity in a level. `position`/`rotation` are left untyped here
since their shape depends on the dimensionality (`Point2`/`number` for 2D, `Point3`/`Point4`
for 3D) of whichever `LevelLoader` subclass parses this JSON.

**Signature**

```ts
export interface EntityJson {
  /**
   * Class alias for the entity, matching a class registered via `registerClass`. Built-in
   * primitive shapes (box/sphere/square/circle/...) all share the single `"Primitive"` alias and
   * are distinguished by `shape` instead of by a per-shape class - e.g. `{ class: "Primitive",
   * shape: "BOX" }` rather than `{ class: "BOX" }`. Apps register their own aliases (e.g.
   * `"ShapeSpawner"`) the same way the dimensionality-specific `LevelLoader` subclasses register
   * their built-ins, via `registerClass`.
   */
  class: string

  /**
   * Shape identifier for the built-in `"Primitive"` entity class (e.g. `"Box"`, `"Circle"`) - see
   * the dimensionality-specific `LevelLoader` subclass (`Gg2dLevelLoader`/`Gg3dLevelLoader`) for
   * the supported values. Ignored for any other `class`.
   */
  shape?: string

  /**
   * Position of the entity
   */
  position?: any

  /**
   * Rotation of the entity
   */
  rotation?: any

  /**
   * Name of the entity. `loadLevel` sets the generator's returned `IEntity`'s `.name` to this
   * (overriding whatever default the generator gave it), so it can be found afterwards with
   * `GgWorld.getEntityByName`/`IEntity.getChildEntityByName`. Moot if the generator doesn't return
   * an `IEntity` - that result is discarded (with a console warning) before naming is applied.
   * Optional - an entity with no explicit `name` here instead gets one derived from the level's own
   * `levelName` and this entity's position in `entities`, deterministic across every peer loading
   * the same document under the same `levelName` - see `LevelLoader.loadLevel`.
   */
  name?: string

  /**
   * Configuration for the entity, passed to its generator alongside position/rotation/name
   */
  config?: any

  /**
   * Maps an observable property name on this entity's generated `IEntity` (e.g. `Trigger3dEntity`'s
   * `"onEntityEntered"`) to what should run whenever that observable fires - see
   * {@link EntityEventBinding}. `createEntity` (and therefore `loadLevel`, which builds every entity
   * through it) subscribes to the observable and triggers a fresh `Blueprint` instance (via its
   * `"in"` entry point) with whatever value it emits, each time it fires, and parents the binding
   * directly under this entity - see `LevelLoader.createEntity` and the `gg-engine-level-json`
   * skill's "Blueprints" section. Silently ignored (with a console warning) if the binding can't be
   * resolved to a blueprint, or the named property isn't an `Observable`.
   */
  events?: Record<string, EntityEventBinding>
}
```

## EntitySerializer (type alias)

Customizes how {@link LevelLoader.serializeEntity} turns one entity back into an `EntityJson`,
for a class alias whose default serialization - either the entity's own
{@link ISerializableEntity.serializeSettings} if it implements that, or (if not) an echo of the
`shape`/`config` it was originally built from - isn't enough, in either case with `name`/
`position`/`rotation` read live off the entity. Registered via
{@link LevelLoader.registerSerializer}, paired with `registerClass` on the same `classAlias`.
Typically starts from `defaultJson` and layers extra/overridden fields onto its `config` (e.g. to
add something neither the entity class itself nor the spawn-time `config` capture) rather than
building an `EntityJson` from scratch. This is an escape hatch for the _rare_ case that needs to
override a class's serialization from outside the class - prefer implementing
{@link ISerializableEntity} directly on the entity class itself when you own that class, so the
logic lives next to the state it describes instead of split across two files.

**Signature**

```ts
export type EntitySerializer<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> = (
  entity: IEntity<D, R, TypeDoc>,
  defaultJson: EntityJson
) => EntityJson | undefined
```

## LevelJson (interface)

A level/scene, serializable as a single JSON document (e.g. to be hosted as a static file and
loaded via {@link LevelLoader.loadLevelFromUrl}).

**Signature**

```ts
export interface LevelJson {
  /**
   * Entities in the level
   */
  entities: EntityJson[]

  /**
   * Blueprint graphs available to this level's entities, keyed by name - referenced from an
   * `EntityJson.events` entry to run a blueprint whenever the named observable on that entity
   * fires. See {@link BlueprintJson} and the `gg-engine-level-json` skill's "Blueprints" section.
   */
  blueprints?: Record<string, BlueprintJson>
}
```

## LevelLoader (class)

Base class for level loaders: parses a {@link LevelJson} document into world entities by
dispatching each `EntityJson.class` to a generator function registered with {@link registerClass}.

A generator is required to return an `IEntity`. Every `IEntity` a generator produces is parented
under one {@link GroupEntity} per `loadLevel`/`loadLevelFromUrl` call (added to the world
immediately, and handed back once loading completes) - so a whole level can be torn down in one
shot with `world.removeEntity(level, true)`, which cascades removal/disposal to every child, and
any named entity can be found afterwards with `level.getChildEntityByName(name)`. If a generator
returns anything other than an `IEntity` (including `null`/`undefined`), `loadLevel` logs a
`console.warn` and skips that entity - it's never parented, named, or tracked.

**Signature**

```ts
export declare class LevelLoader<D, R, TypeDoc> {
  constructor(protected readonly world: GgWorld<D, R, TypeDoc>)
}
```

### registerClass (method)

Register a generator function for a class alias

**Signature**

```ts
public registerClass<Settings, W = any>(
    classAlias: string,
    generator: EntityGenerator<D, R, TypeDoc, Settings, W>,
    entityClass?: Function,
  ): void
```

### registerBlueprintNode (method)

Register a {@link BlueprintNode} factory for a node type alias, so a `BlueprintJson`'s
`nodes` can reference it by `type` (e.g. the built-in `"RemoveEntity"`, registered by every
`LevelLoader` out of the box). Same pattern as {@link registerClass}, one level down (node
types within a blueprint graph, rather than entity classes within a level).

**Signature**

```ts
public registerBlueprintNode(
    typeAlias: string,
    factory: BlueprintNodeFactory<D, R, TypeDoc>,
    defaultInputPin?: string,
  ): void
```

### registerSerializer (method)

Register a custom {@link EntitySerializer} for a class alias, overriding
{@link serializeEntity}'s default (spawn-config echo) serialization for entities built under
that alias. Not required for a class to be serializable at all - any class built via
`createEntity`/`loadLevel` already gets the default behavior for free; this is only for a class
whose default isn't enough (e.g. it needs to capture runtime-mutated state into `config`).

**Signature**

```ts
public registerSerializer(classAlias: string, serializer: EntitySerializer<D, R, TypeDoc>): void
```

### registerLiveSerializer (method)

Register a {@link LiveEntitySerializer}, tried (in registration order, before every other
registered one) by {@link serializeEntity} ahead of the spawn-record echo. Use this instead of
(or, for a class registered via `registerLiveSerializer` for its primary shape but wanting the
echo as a secondary fallback, alongside) {@link registerSerializer} whenever an entity's state
can be read back off its live physics/visual components well enough to reconstruct an
equivalent `EntityJson` without needing to have gone through `createEntity`/`loadLevel` at all -
see that type's own doc for the `"Primitive"`/`"Trigger"` reference implementation.

**Signature**

```ts
public registerLiveSerializer(serializer: LiveEntitySerializer<D, R, TypeDoc>): void
```

### createEntity (method)

Build a single entity from an `EntityJson`-shaped descriptor, dispatching `entityJson.class` to
whichever generator is registered for it (see {@link registerClass}) - the single-entity
counterpart of {@link loadLevel}, for a runtime spawn that doesn't come from (and shouldn't be
forced into) a whole level document, e.g. a networked "spawn this entity" message carrying one
`EntityJson`. Unlike `loadLevel`, the returned entity is **not** parented under any group, and
`entity.name` is left untouched unless `entityJson.name` is explicitly given or `defaultName`
is passed (no level-scoped/index-derived fallback name of its own, since there's no level or
index here) - the caller is responsible for both adding it to the world
(`world.addEntity(entity)`, safe even if the generator already self-added it - see
`loadLevel`'s own note on this) and, if desired, parenting it under something
(`parent.addChildren(entity)`).

Whichever name is resolved (`entityJson.name`, else `defaultName`) is also handed to the
generator as `settings.name` _before_ the entity is built, so a generator that needs to derive
something from the entity's final name (e.g. the built-in `"Glb"` class scoping the names of
every sub-entity a model expands into under it) can - not just read it back afterwards.

The entity's `class`/`shape`/`config` are remembered (in a `WeakMap`, keyed by the entity
itself) so {@link serializeEntity} can later reconstruct an equivalent `EntityJson` for it -
this is what makes an entity built this way (or via `loadLevel`) serializable at all.

If `entityJson.events` is present, each binding is resolved via the same mechanism `loadLevel`
uses (see {@link bindEvent} and the `gg-engine-level-json` skill's "Blueprints" section) and the
resulting binding entity is parented directly under the just-built entity
(`entity.addChildren(bindingEntity)`) - not under any group, since `createEntity` doesn't have
one. This means the binding's subscription/blueprint is torn down whenever the entity itself is
(`entity.dispose()`, or removal with `dispose: true` once added to a world), with nothing extra
for the caller to clean up. `loadLevel` relies on this same behavior (see below) rather than
parenting bindings under the level's group itself.

**Signature**

```ts
public async createEntity(
    entityJson: EntityJson,
    defaultName?: string,
    blueprints?: Record<string, BlueprintJson>,
  ): Promise<IEntity<D, R, TypeDoc> | undefined>
```

### serializeEntity (method)

Turn a live entity back into the `EntityJson`-shaped descriptor that could reproduce it via
{@link createEntity}/{@link loadLevel} - the inverse of entity construction. Tries three
mechanisms, in order:

1. Every registered {@link LiveEntitySerializer}, in registration order (see
   {@link registerLiveSerializer}) - these read the entity's own current physics/visual state
   directly, so they work regardless of how the entity was actually built. This is the
   mechanism the built-in `"Primitive"`/`"Trigger"` classes use, since there's no single entity
   class those two alone would own (`"Primitive"` alone covers every shape).
2. The entity's own {@link ISerializableEntity.serializeSettings}, if it implements that
   interface - the class-owned counterpart of (1), for a class (built-in, like `"GgCar"`, or
   app-defined) that _does_ have one entity class to own the logic. Its `class` alias is
   resolved from the entity's spawn record if it has one (see (3)), or otherwise from the
   constructor->alias mapping an optional third {@link registerClass} argument sets up - so this
   still works for an entity built directly (`new SomeEntity(...)`), not only through this
   loader, as long as its class was registered with that third argument.
3. Spawn-record echo - works only for an entity that was itself built by this loader
   (`createEntity`, and therefore `loadLevel` too, but not tier (2), which already claims any
   entity that both has a spawn record _and_ self-serializes): remembers the `class`/`shape`/
   `config` it was built from and echoes them straight back, with `name`/`position`/`rotation`
   still read live off the entity (not its spawn-time values). This is the only option left for
   a class with no live-state equivalent and no self-serialization of its own (a `"Sound"`'s
   clip URL, a `"MapGraph"`'s graph structure).

Tiers (2) and (3) also echo the `events` bindings an entity was built with (by `createEntity`), so
re-creating an entity from its own serialization - e.g. on another peer - rebinds them (against
whatever `blueprints` map that `createEntity` call is given).

An entity matched by none of the three - built some other way with no live/self-serializer
applicable, or a child an entity class adds to itself (a `"Player"`'s
`CharacterAnimationController`) - has nothing to reconstruct it from; this logs a warning and
returns `undefined` rather than guessing. {@link registerSerializer} (layered onto whichever of
tiers (2)/(3) produced the entity's `class`/`shape`/`config`, if any did) is still available for
a class that needs to add/override fields from outside the entity class itself.

**Signature**

```ts
public serializeEntity(entity: IEntity<D, R, TypeDoc>): EntityJson | undefined
```

### buildEntityJson (method)

Assembles an `EntityJson` from a resolved `class` alias, optional `shape`/`config`, and this
entity's own live `name`/`position`/`rotation` (the latter two included only if `entity`
actually implements `IPositionable`) - the common tail shared by {@link serializeEntity}'s
self-serialization and spawn-record-echo tiers.

**Signature**

```ts
private buildEntityJson(
    classAlias: string,
    entity: IEntity<D, R, TypeDoc>,
    shape: string | undefined,
    config: any,
    events?: Record<string, EntityEventBinding>,
  ): EntityJson
```

### serializeLevel (method)

Serialize every top-level child of a loaded level's group entity (as `loadLevel`/`createEntity`
returned it) back into a `LevelJson`'s `entities` array - the level-wide counterpart of
{@link serializeEntity}. A child with no spawn record is skipped silently rather than warned
about - unlike a direct `serializeEntity` call, having this kind of internal/non-`entities`-array
child under a level is expected, not a sign of misuse (a `BlueprintBindingEntity` an `events`
binding creates is itself parented under the entity it's bound to, not directly under the level -
see `createEntity` - but this skip still guards against any other non-spawn-recorded child a
level's group might end up with). Only `entities` is reconstructed: each entity echoes the
`events` bindings it was built with, but the level's top-level `blueprints` map isn't rebuilt -
keep the original `blueprints` alongside if those bindings reference named graphs.

**Signature**

```ts
public serializeLevel(level: GroupEntity<D, R, TypeDoc>): LevelJson
```

### loadLevel (method)

Load a level from an already-parsed JSON document. Every `IEntity` the level's entities
produce is parented under - and, on failure, torn down along with - the returned
{@link GroupEntity}, already added to the world under `levelName`.

Every entity that doesn't specify its own `name` in `levelJson` gets one derived as
`` `${levelName}__${classAlias}_${indexInEntitiesArray}` `` instead of the usual
process-global `IEntity` auto-generated default - deterministic purely from `levelName` and
this document's own content, so two peers loading the same `levelJson` under the same
`levelName` always agree on every entity's name, regardless of load order, timing, or what
else either peer has spawned. `levelName` must therefore be both required and unique per
loaded _instance_ (loading the same level twice - e.g. two copies of one room - needs two
distinct `levelName`s, the same way two `GroupEntity`s can't otherwise be told apart by name).

**Signature**

```ts
public async loadLevel(levelJson: LevelJson, levelName: string): Promise<GroupEntity<D, R, TypeDoc>>
```

### bindEvent (method)

Resolve `eventBinding` (see {@link EntityEventBinding}) to a `BlueprintJson`, instantiate a
fresh `Blueprint` from it, and subscribe it to `entity[eventName]` so every value that
observable emits triggers the blueprint's `"in"` entry point. Wrapped in a
`BlueprintBindingEntity` so the subscription (and the blueprint's own node state) is torn down
automatically once that entity is disposed - `createEntity` parents the returned entity under
`entity` itself (`entity.addChildren(bindingEntity)`) for that reason, so the binding's lifetime
is tied to the entity it's bound to, not to whatever group (if any) that entity ends up under.

**Signature**

```ts
private bindEvent(
    entity: IEntity<D, R, TypeDoc>,
    eventName: string,
    eventBinding: EntityEventBinding,
    blueprints: Record<string, BlueprintJson> | undefined,
  ): BlueprintBindingEntity<D, R, TypeDoc> | undefined
```

### resolveEventBlueprint (method)

Turn an `EntityEventBinding` into a `BlueprintJson` to run. An object form (`{ type,
settings? }`) always builds a single-node inline graph via {@link inlineNodeBlueprint}. A
string form is tried first as a key into `blueprints` (a named, possibly multi-node graph),
then - if not found there - as a bare node type alias, same as the object form with no
settings.

**Signature**

```ts
private resolveEventBlueprint(
    eventName: string,
    eventBinding: EntityEventBinding,
    blueprints: Record<string, BlueprintJson> | undefined,
  ): BlueprintJson | undefined
```

### inlineNodeBlueprint (method)

Build a single-node `BlueprintJson` wrapping one blueprint node type, wired so the node's
registered default input pin (see {@link registerBlueprintNode}) is reachable as `"in"` - what
powers the `EntityEventBinding` shorthand that skips declaring a `blueprints` entry entirely.

**Signature**

```ts
private inlineNodeBlueprint(
    eventName: string,
    nodeType: string,
    settings: Record<string, any> | undefined,
  ): BlueprintJson | undefined
```

### loadLevelFromUrl (method)

Fetch a level JSON document hosted at `url` and load it, so a whole level/scene can be
shipped and consumed as a single static JSON file.

**Signature**

```ts
public async loadLevelFromUrl(url: string, levelName: string): Promise<GroupEntity<D, R, TypeDoc>>
```

### generators (property)

Map of class aliases to generator functions

**Signature**

```ts
generators: Map<string, EntityGenerator<D, R, TypeDoc, any, any>>
```

### blueprintNodes (property)

Map of blueprint node type aliases to node factory functions - see {@link registerBlueprintNode}.

**Signature**

```ts
blueprintNodes: Map<string, BlueprintNodeFactory<D, R, TypeDoc>>
```

### blueprintNodeDefaultInputs (property)

Map of blueprint node type aliases to their default input pin name, for node types registered
with one - see {@link registerBlueprintNode}.

**Signature**

```ts
blueprintNodeDefaultInputs: Map<string, string>
```

### serializers (property)

Map of class aliases to custom serializers - see {@link registerSerializer}.

**Signature**

```ts
serializers: Map<string, EntitySerializer<D, R, TypeDoc>>
```

### liveSerializers (property)

Live, state-reading serializers, tried in registration order before the spawn-record echo -
see {@link registerLiveSerializer}.

**Signature**

```ts
liveSerializers: LiveEntitySerializer < D, R, TypeDoc > []
```

## LiveEntitySerializer (type alias)

Reconstructs an `EntityJson` by reading an entity's own _current_ live state - not an echo of
whatever it happened to be constructed with - so it works for an entity regardless of how (or by
what code) it was actually built, and stays accurate no matter how much its state has drifted
since. Tried, in registration order, by {@link LevelLoader.serializeEntity} first, ahead of an
entity's own {@link ISerializableEntity.serializeSettings} and the spawn-record echo - see
{@link LevelLoader.registerLiveSerializer}. Reach for this (registered externally against the
loader) only for a class like `"Primitive"` that has no single entity class of its own to
implement `ISerializableEntity` on (it can produce a box, a sphere, ... all the same `Entity3d`);
prefer `ISerializableEntity` directly on the entity class for anything that does.

Must return `undefined` (not throw) for any entity it doesn't recognize/can't fully reconstruct -
`serializeEntity` moves on to the next registered live serializer, then to the spawn-record echo,
treating `undefined` as "not my entity" rather than "this entity failed to serialize". The
built-in `"Primitive"`/`"Trigger"` live serializers (registered by `Gg2dLevelLoader`/
`Gg3dLevelLoader`) are the reference implementation: they match on the entity's own concrete
class (`entity.constructor === Entity3d`, not `instanceof`, so a richer subclass like
`Grabbable3dEntity` - which needs its own dedicated serializer to round-trip correctly, not yet
provided - doesn't get silently mistaken for a plain primitive), then read shape (`objectBody
.debugBodySettings.shape`), body options (`objectBody.bodyOptions`), and velocity
(`objectBody.linearVelocity`/`angularVelocity`) straight off the live physics body.

**Signature**

```ts
export type LiveEntitySerializer<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> = (
  entity: IEntity<D, R, TypeDoc>
) => EntityJson | undefined
```
