---
title: core/base/entities/i-entity.ts
nav_order: 69
parent: Modules
---

## i-entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IEntity (class)](#ientity-class)
    - [addChildren (method)](#addchildren-method)
    - [removeChildren (method)](#removechildren-method)
    - [addComponents (method)](#addcomponents-method)
    - [removeComponents (method)](#removecomponents-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tick$ (property)](#tick-property)
    - [tickOrder (property)](#tickorder-property)
    - [\_world (property)](#_world-property)
    - [\_name (property)](#_name-property)
    - [\_active (property)](#_active-property)
    - [parent (property)](#parent-property)
    - [\_onSpawned$ (property)](#_onspawned-property)
    - [\_onRemoved$ (property)](#_onremoved-property)

---

# utils

## IEntity (class)

**Signature**

```ts
export declare class IEntity<D, R, V, P>
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

### addComponents (method)

**Signature**

```ts
public addComponents(...components: IWorldComponent<D, R, V, P>[])
```

### removeComponents (method)

**Signature**

```ts
public removeComponents(components: IWorldComponent<D, R, V, P>[], dispose: boolean = false)
```

### onSpawned (method)

**Signature**

```ts
public onSpawned(world: GgWorld<D, R, V, P>)
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
_world: GgWorld<D, R, V, P> | null
```

### \_name (property)

**Signature**

```ts
_name: string
```

### \_active (property)

The flag whether entity should listen to ticks. If set to false, ticks will not be propagated to this entity

**Signature**

```ts
_active: boolean
```

### parent (property)

**Signature**

```ts
parent: IEntity<any, any, IVisualSceneComponent<any, any>, IPhysicsWorldComponent<any, any>> | null
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
