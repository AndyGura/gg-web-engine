---
title: core/base/blueprint/blueprint-node.ts
nav_order: 64
parent: Modules
---

## blueprint-node overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BlueprintNode (class)](#blueprintnode-class)
    - [subjectFor (method)](#subjectfor-method)
    - [output (method)](#output-method)
    - [emit (method)](#emit-method)
    - [trigger (method)](#trigger-method)
    - [dispose (method)](#dispose-method)
    - [inputs (property)](#inputs-property)
    - [outputs (property)](#outputs-property)
  - [BlueprintPinDefinition (interface)](#blueprintpindefinition-interface)
  - [BlueprintPinKind (type alias)](#blueprintpinkind-type-alias)

---

# utils

## BlueprintNode (class)

One node in a {@link Blueprint} graph - the engine's analogue of a single Unreal Blueprint graph
node: a small unit of behavior with named input pins that trigger it, named output pins it can
fire in response, and a `settings` bag of static (non-pin) configuration baked in from its
{@link BlueprintNodeJson} (e.g. `RemoveEntity`'s `dispose` flag). Register a concrete subclass's
factory against a type alias via `LevelLoader.registerBlueprintNode` so `Blueprint` can
instantiate it from JSON, the same way `LevelLoader.registerClass` works for entity classes.

**Signature**

```ts
export declare class BlueprintNode<D, R, TypeDoc> {
  constructor(protected readonly world: GgWorld<D, R, TypeDoc>, protected readonly settings: Record<string, any>)
}
```

### subjectFor (method)

**Signature**

```ts
private subjectFor(name: string): Subject<unknown>
```

### output (method)

Observe one of this node's output pins firing - what a {@link BlueprintLinkJson} subscribes
to in order to feed a downstream node's input, or what an embedding `Blueprint`'s own
`outputs` entry bubbles up to whatever triggered the blueprint.

**Signature**

```ts
public output(name: string): Observable<unknown>
```

### emit (method)

Fire one of this node's output pins - call from within {@link trigger} once the node has done
whatever that output represents. A no-op if nothing is subscribed.

**Signature**

```ts
protected emit(name: string, value?: unknown): void
```

### trigger (method)

Feed a value/pulse into one of this node's input pins (per {@link inputs}), running whatever
behavior that pin represents. Called by `Blueprint` both for external triggers (via its own
`inputs` aliasing) and for links from another node's output pin.

**Signature**

```ts
public abstract trigger(inputName: string, value?: unknown): void;
```

### dispose (method)

Release anything this node set up outside of its output subjects (timers, subscriptions,
etc). Default no-op - override when a node needs it. `Blueprint.dispose` calls this on every
node in its graph.

**Signature**

```ts
public dispose(): void
```

### inputs (property)

This node's input pins - see {@link trigger} for how they're fed.

**Signature**

```ts
readonly inputs: readonly BlueprintPinDefinition[]
```

### outputs (property)

This node's output pins - see {@link output} for how to observe them.

**Signature**

```ts
readonly outputs: readonly BlueprintPinDefinition[]
```

## BlueprintPinDefinition (interface)

Declares one named pin a {@link BlueprintNode} exposes - either an input (fed a value via
{@link BlueprintNode.trigger}) or an output (fired via {@link BlueprintNode.output}).

**Signature**

```ts
export interface BlueprintPinDefinition {
  name: string
  kind: BlueprintPinKind
}
```

## BlueprintPinKind (type alias)

Whether a {@link BlueprintNode} pin carries an execution pulse ("do this now", no meaningful
payload - e.g. Unreal's white exec pins) or a data value ("here's a value", not itself a
trigger - e.g. Unreal's colored data pins). Purely descriptive for now (introspection/future
editor tooling) - {@link BlueprintNode.trigger} treats every input pin the same way at runtime,
since a node is free to both react to and read a value from the same pin (see
{@link RemoveEntityBlueprintNode}, whose single `"entity"` pin is a data pin that also triggers
the node when fed a value - the same way an Unreal event node's payload pins double as the
thing that fires the node).

**Signature**

```ts
export type BlueprintPinKind = 'exec' | 'data'
```
