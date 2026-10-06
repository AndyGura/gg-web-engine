---
title: core/3d/entities/environment-3d.entity.ts
nav_order: 76
parent: Modules
---

## environment-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Environment3dEntity (class)](#environment3dentity-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## Environment3dEntity (class)

Applies scene environment settings (background, environment map, fog - see
`IVisualScene3dComponent.setEnvironment`) while it is in the world, and restores whatever those
fields were before once it is removed. This is what the `"Environment"` level-JSON class
creates, so a level's sky and fog go away when the level is unloaded. Apps that never swap
levels can call `world.visualScene.setEnvironment(...)` directly instead.

Several of these can be in one world at once (e.g. two levels loaded during a transition) and be
removed in any order: each field shows the most recently spawned entity that sets it, and falls
back to the value from before any of them once none is left.

**Signature**

```ts
export declare class Environment3dEntity<VTypeDoc> {
  constructor(
    public readonly environment: Partial<Environment3dOpts<VTypeDoc['texture']>>,
    private readonly onDispose?: () => void
  )
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld<Gg3dWorldTypeDocVPatch<VTypeDoc>>)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```
