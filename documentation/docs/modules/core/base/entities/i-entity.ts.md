---
title: core/base/entities/i-entity.ts
nav_order: 84
parent: Modules
---

## i-entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IEntity (class)](#ientity-class)
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
