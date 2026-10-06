---
title: core/base/entities/i-entity.ts
nav_order: 128
parent: Modules
---

## i-entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IEntity (class)](#ientity-class)
    - [useDefaultNameMiddleware (static method)](#usedefaultnamemiddleware-static-method)
    - [generateDefaultName (method)](#generatedefaultname-method)
    - [addChildren (method)](#addchildren-method)
    - [removeChildren (method)](#removechildren-method)
    - [getChildEntityByName (method)](#getchildentitybyname-method)
    - [findChildEntityByName (method)](#findchildentitybyname-method)
    - [addComponents (method)](#addcomponents-method)
    - [removeComponents (method)](#removecomponents-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tick$ (property)](#tick-property)
    - [tickOrder (property)](#tickorder-property)
    - [\_world (property)](#_world-property)
    - [\_name (property)](#_name-property)
    - [\_selfActive (property)](#_selfactive-property)
    - [parent (property)](#parent-property)
    - [\_onSpawned$ (property)](#_onspawned-property)
    - [\_onRemoved$ (property)](#_onremoved-property)

---

# utils

## IEntity (class)

**Signature**

```ts
export declare class IEntity<D, R, TypeDoc>
```

### useDefaultNameMiddleware (static method)

Register a transform run on every subsequently-constructed entity's auto-generated default
name (see {@link entityTypeName}) at construction time, before anything else can touch it.
Multiple registrations chain in call order. This is the one seam a package with its own notion
of identity (e.g. a future network layer wanting to qualify every otherwise-unnamed entity with
a peer id) needs: app code keeps calling ordinary core factories/constructors with no awareness
such a layer exists, and every entity that isn't explicitly named by that app code or by
`LevelLoader` picks up the transform automatically. Core itself never calls this.

**Signature**

```ts
public static useDefaultNameMiddleware(middleware: (name: string) => string): () => void
```

### generateDefaultName (method)

**Signature**

```ts
private generateDefaultName(): string
```

### addChildren (method)

**Signature**

```ts
public addChildren(...entities: IEntity[])
```

### removeChildren (method)

**Signature**

```ts
public removeChildren(entities: IEntity[], dispose: boolean = false)
```

### getChildEntityByName (method)

Find a descendant entity by name, searching this entity's own children and their children
recursively (depth-first) - not the whole world, just this entity's subtree. Useful e.g. to
pull a specific entity back out of a `GroupEntity` a `LevelLoader` handed back:
`level.getChildEntityByName('KillFloor')`.

**Signature**

```ts
public getChildEntityByName<T extends IEntity = IEntity>(name: string): T
```

### findChildEntityByName (method)

**Signature**

```ts
private findChildEntityByName(name: string): IEntity | undefined
```

### addComponents (method)

**Signature**

```ts
public addComponents(...components: IWorldComponent<D, R, TypeDoc>[])
```

### removeComponents (method)

**Signature**

```ts
public removeComponents(components: IWorldComponent<D, R, TypeDoc>[], dispose: boolean = false)
```

### onSpawned (method)

**Signature**

```ts
public onSpawned(world: GgWorld<D, R, TypeDoc>)
```

### onRemoved (method)

**Signature**

```ts
public onRemoved()
```

### dispose (method)

Idempotent: a second call is a no-op. Without this guard, every component's own `dispose()` -
several of which (e.g. `AmmoRaycastVehicleComponent`) free multiple native handles with no
defensive try/catch of their own, unlike the single-handle case `AmmoBodyComponent.dispose()`
already guards - would run a second time and throw trying to free an already-freed native
handle. This is reachable from ordinary (non-buggy) call patterns, not just a caller mistake:
`Gg3dWorld.removeEntity(entity, true)` calls `entity.dispose()` unconditionally whenever
`dispose` is `true`, regardless of whether `entity.world` was already falsy (i.e. regardless of
whether this is actually the first time this entity is being removed) - so anything that can
end up calling `removeEntity(sameEntity, true)` twice (e.g. a physics trigger's own overlap
bookkeeping reacting a second time to a body that already left) hits exactly this path.

**Signature**

```ts
public dispose(): void
```

### tick$ (property)

will receive [elapsed time, delta] of each world clock tick

**Signature**

```ts
readonly tick$: any
```

### tickOrder (property)

the priority of ticker: the less value, the earlier tick will be run.

**Signature**

```ts
readonly tickOrder: number
```

### \_world (property)

a world reference, where this entity was added to

**Signature**

```ts
_world: GgWorld<D, R, TypeDoc, GgWorldSceneTypeRepo<D, R, TypeDoc>> | null
```

### \_name (property)

Falls back to an auto-generated default (see {@link entityTypeName} and
{@link useDefaultNameMiddleware}) until explicitly assigned. Must be unique within whichever
`GgWorld` this entity is (or becomes) a member of - the `name` setter validates this itself
once the entity is spawned, and `GgWorld.addEntity` validates it at spawn time otherwise; both
throw on a collision.

**Signature**

```ts
_name: string
```

### \_selfActive (property)

The flag whether entity should listen to ticks. If set to false, ticks will not be propagated to this entity

**Signature**

```ts
_selfActive: boolean
```

### parent (property)

**Signature**

```ts
parent: IEntity<any, any, GgWorldTypeDocRepo<any, any>> | null
```

### \_onSpawned$ (property)

**Signature**

```ts
_onSpawned$: any
```

### \_onRemoved$ (property)

**Signature**

```ts
_onRemoved$: any
```
