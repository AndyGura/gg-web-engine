---
title: core/base/blueprint/blueprint.ts
nav_order: 65
parent: Modules
---

## blueprint overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Blueprint (class)](#blueprint-class)
    - [trigger (method)](#trigger-method)
    - [output (method)](#output-method)
    - [dispose (method)](#dispose-method)
  - [BlueprintJson (interface)](#blueprintjson-interface)
  - [BlueprintLinkJson (interface)](#blueprintlinkjson-interface)
  - [BlueprintNodeFactory (type alias)](#blueprintnodefactory-type-alias)
  - [BlueprintNodeJson (interface)](#blueprintnodejson-interface)
  - [BlueprintPinRef (interface)](#blueprintpinref-interface)

---

# utils

## Blueprint (class)

Runtime instance of a {@link BlueprintJson} graph: builds one {@link BlueprintNode} per
`nodes` entry (via the node type registry passed in), wires every `links` entry as a live
subscription from the source node's output pin to the target node's input pin, and exposes the
graph's own `inputs`/`outputs` boundary. Each binding of a blueprint (e.g. one level JSON entity
event) gets its own `Blueprint` instance - and therefore its own node instances - even when
multiple bindings reference the same `BlueprintJson` by name, so per-node state (a future timer
node's countdown, etc) is never accidentally shared between unrelated bindings.

**Signature**

```ts
export declare class Blueprint<D, R, TypeDoc> {
  constructor(
    world: GgWorld<D, R, TypeDoc>,
    private readonly json: BlueprintJson,
    registry: ReadonlyMap<string, BlueprintNodeFactory<D, R, TypeDoc>>
  )
}
```

### trigger (method)

Feed a value/pulse into one of this graph's named entry points (per `BlueprintJson.inputs`).
A no-op (with a console warning) if no such input, or the node it aliases failed to build.

**Signature**

```ts
public trigger(inputName: string, value?: unknown): void
```

### output (method)

Observe one of this graph's named exit points (per `BlueprintJson.outputs`) firing.

**Signature**

```ts
public output(outputName: string): Observable<unknown>
```

### dispose (method)

Unwire every link and dispose every node in this graph. Idempotent-ish - safe to call once
per `Blueprint` instance, same lifetime contract as `IEntity.dispose`.

**Signature**

```ts
public dispose(): void
```

## BlueprintJson (interface)

A blueprint graph, serializable as a single JSON document - the engine's analogue of an Unreal
Blueprint event graph. `nodes` are node instances (see {@link BlueprintNodeJson}), `links` wire
one node's output pin to another's input pin, and `inputs`/`outputs` expose named entry/exit
points at the graph's own boundary - each aliasing one node's pin - so embedding code (or, in
the future, another blueprint nesting this one) doesn't need to know internal node ids. A level
JSON references a `BlueprintJson` by name via its top-level `blueprints` map and an entity's
`events` mapping - see `gg-engine-level-json`.

**Signature**

```ts
export interface BlueprintJson {
  /**
   * Node instances in this graph
   */
  nodes: BlueprintNodeJson[]

  /**
   * Wires wiring one node's output pin to another node's input pin
   */
  links?: BlueprintLinkJson[]

  /**
   * Named entry points into this graph, each aliasing one node's input pin - e.g.
   * `{ "in": { "node": "n1", "pin": "entity" } }` lets external code trigger `"n1"`'s `"entity"`
   * pin by calling `blueprint.trigger("in", value)` without knowing the internal node id. A
   * blueprint bound to a level JSON entity event is always triggered through the entry named
   * `"in"` - see `gg-engine-level-json`.
   */
  inputs?: Record<string, BlueprintPinRef>

  /**
   * Named exit points out of this graph, each aliasing one node's output pin - for a future
   * blueprint nested inside a larger graph to bubble one of its own nodes' outputs back out.
   */
  outputs?: Record<string, BlueprintPinRef>
}
```

## BlueprintLinkJson (interface)

JSON description of one wire connecting one node's output pin to another node's input pin
within the same {@link BlueprintJson} graph. Whenever `from` fires, `to` is triggered with
whatever value (if any) `from` fired with.

**Signature**

```ts
export interface BlueprintLinkJson {
  from: BlueprintPinRef
  to: BlueprintPinRef
}
```

## BlueprintNodeFactory (type alias)

A function that builds a {@link BlueprintNode} instance from its baked-in settings. Registered
against a node type alias via `LevelLoader.registerBlueprintNode`, the same way
{@link EntityGenerator} is registered against an entity class alias via `registerClass`.

**Signature**

```ts
export type BlueprintNodeFactory<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> = (
  world: GgWorld<D, R, TypeDoc>,
  settings: Record<string, any>
) => BlueprintNode<D, R, TypeDoc>
```

## BlueprintNodeJson (interface)

JSON description of a single node instance within a {@link BlueprintJson} graph.

**Signature**

```ts
export interface BlueprintNodeJson {
  /**
   * Identifier for this node instance, unique within the same graph - referenced by
   * `BlueprintLinkJson`/`BlueprintJson.inputs`/`BlueprintJson.outputs`.
   */
  id: string

  /**
   * Node type alias, matching a type registered via `LevelLoader.registerBlueprintNode` (e.g. the
   * built-in `"RemoveEntity"`).
   */
  type: string

  /**
   * Static settings baked into the node (e.g. `RemoveEntity`'s `dispose` flag) - not wired at
   * runtime, unlike a pin.
   */
  settings?: Record<string, any>
}
```

## BlueprintPinRef (interface)

A reference to one named pin on one node within a {@link BlueprintJson} graph - either end of a
{@link BlueprintLinkJson}, or what a graph's own `inputs`/`outputs` entry aliases.

**Signature**

```ts
export interface BlueprintPinRef {
  /**
   * `id` of the node within the same `BlueprintJson.nodes` array
   */
  node: string

  /**
   * Pin name on that node, per its `BlueprintNode.inputs`/`outputs`
   */
  pin: string
}
```
