---
title: core/base/blueprint/nodes/remove-entity.node.ts
nav_order: 66
parent: Modules
---

## remove-entity.node overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [RemoveEntityBlueprintNode (class)](#removeentityblueprintnode-class)
    - [trigger (method)](#trigger-method)
    - [inputs (property)](#inputs-property)
    - [outputs (property)](#outputs-property)
  - [RemoveEntityNodeSettings (interface)](#removeentitynodesettings-interface)

---

# utils

## RemoveEntityBlueprintNode (class)

Built-in blueprint node: removes an entity from the world - the blueprint analogue of calling
`world.removeEntity(entity, dispose)` directly. Has one input pin, `"entity"` (a data pin that
also acts as this node's trigger - feeding it a value runs the node, same as an Unreal event
node's payload pin doubling as its exec pulse) and no output pins. Whether the removal also
disposes the entity is controlled by the static `dispose` setting, not a pin - see
{@link RemoveEntityNodeSettings}.

**Signature**

```ts
export declare class RemoveEntityBlueprintNode<D, R, TypeDoc>
```

### trigger (method)

**Signature**

```ts
public trigger(inputName: string, value?: unknown): void
```

### inputs (property)

**Signature**

```ts
readonly inputs: readonly BlueprintPinDefinition[]
```

### outputs (property)

**Signature**

```ts
readonly outputs: readonly BlueprintPinDefinition[]
```

## RemoveEntityNodeSettings (interface)

Settings for the built-in `"RemoveEntity"` blueprint node - baked in from its
{@link BlueprintNodeJson.settings}, not wired at runtime.

**Signature**

```ts
export interface RemoveEntityNodeSettings {
  /**
   * Whether to dispose the entity (release its components/children) as well as remove it from
   * the world, same as the `dispose` argument of `GgWorld.removeEntity`. Defaults to `false`.
   */
  dispose?: boolean
}
```
