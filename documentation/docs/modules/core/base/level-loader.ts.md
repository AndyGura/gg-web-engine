---
title: core/base/level-loader.ts
nav_order: 94
parent: Modules
---

## level-loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [EntityEventBinding (type alias)](#entityeventbinding-type-alias)
  - [EntityGenerator (type alias)](#entitygenerator-type-alias)
  - [EntityJson (interface)](#entityjson-interface)
  - [LevelJson (interface)](#leveljson-interface)
  - [LevelLoader (class)](#levelloader-class)
    - [registerClass (method)](#registerclass-method)
    - [registerBlueprintNode (method)](#registerblueprintnode-method)
    - [loadLevel (method)](#loadlevel-method)
    - [bindEvent (method)](#bindevent-method)
    - [resolveEventBlueprint (method)](#resolveeventblueprint-method)
    - [inlineNodeBlueprint (method)](#inlinenodeblueprint-method)
    - [loadLevelFromUrl (method)](#loadlevelfromurl-method)
    - [generators (property)](#generators-property)
    - [blueprintNodes (property)](#blueprintnodes-property)
    - [blueprintNodeDefaultInputs (property)](#blueprintnodedefaultinputs-property)

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
   */
  name?: string

  /**
   * Configuration for the entity, passed to its generator alongside position/rotation/name
   */
  config?: any

  /**
   * Maps an observable property name on this entity's generated `IEntity` (e.g. `Trigger3dEntity`'s
   * `"onEntityEntered"`) to what should run whenever that observable fires - see
   * {@link EntityEventBinding}. `loadLevel` subscribes to the observable and triggers a fresh
   * `Blueprint` instance (via its `"in"` entry point) with whatever value it emits, each time it
   * fires - see `LevelLoader.loadLevel` and the `gg-engine-level-json` skill's "Blueprints"
   * section. Silently ignored (with a console warning) if the binding can't be resolved to a
   * blueprint, or the named property isn't an `Observable`.
   */
  events?: Record<string, EntityEventBinding>
}
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

### loadLevel (method)

Load a level from an already-parsed JSON document. Every `IEntity` the level's entities
produce is parented under - and, on failure, torn down along with - the returned
{@link GroupEntity}, already added to the world.

**Signature**

```ts
public async loadLevel(levelJson: LevelJson, levelName?: string): Promise<GroupEntity<D, R, TypeDoc>>
```

### bindEvent (method)

Resolve `eventBinding` (see {@link EntityEventBinding}) to a `BlueprintJson`, instantiate a
fresh `Blueprint` from it, and subscribe it to `entity[eventName]` so every value that
observable emits triggers the blueprint's `"in"` entry point. Wrapped in a
`BlueprintBindingEntity` so the subscription (and the blueprint's own node state) is torn down
automatically once that entity is disposed - the caller parents the returned entity under the
level's group for that reason.

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
public async loadLevelFromUrl(url: string, levelName?: string): Promise<GroupEntity<D, R, TypeDoc>>
```

### generators (property)

Map of class aliases to generator functions

**Signature**

```ts
generators: any
```

### blueprintNodes (property)

Map of blueprint node type aliases to node factory functions - see {@link registerBlueprintNode}.

**Signature**

```ts
blueprintNodes: any
```

### blueprintNodeDefaultInputs (property)

Map of blueprint node type aliases to their default input pin name, for node types registered
with one - see {@link registerBlueprintNode}.

**Signature**

```ts
blueprintNodeDefaultInputs: any
```
