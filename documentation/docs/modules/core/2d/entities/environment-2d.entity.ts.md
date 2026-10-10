---
title: core/2d/entities/environment-2d.entity.ts
nav_order: 33
parent: Modules
---

## environment-2d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Environment2dEntity (class)](#environment2dentity-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## Environment2dEntity (class)

Applies scene environment settings (see `IVisualScene2dComponent.setEnvironment`) while it is in
the world, and restores whatever those fields were before once it is removed. This is what the 2D
`"Environment"` level-JSON class creates, so a level's background goes away when the level is
unloaded.

Several of these can be in one world at once (e.g. two levels loaded during a transition) and be
removed in any order: each field shows the most recently spawned entity that sets it, and falls
back to the value from before any of them once none is left.

**Signature**

```ts
export declare class Environment2dEntity<VTypeDoc> {
  constructor(public readonly environment: Partial<Environment2dOpts<VTypeDoc['texture']>>)
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg2dWorld<Gg2dWorldTypeDocVPatch<VTypeDoc>>)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```
