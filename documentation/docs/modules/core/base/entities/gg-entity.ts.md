---
title: core/base/entities/gg-entity.ts
nav_order: 43
parent: Modules
---

## gg-entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgEntity (class)](#ggentity-class)
    - [addChildren (method)](#addchildren-method)
    - [removeChildren (method)](#removechildren-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tick$ (property)](#tick-property)
    - [tickOrder (property)](#tickorder-property)
    - [\_world (property)](#_world-property)
    - [\_name (property)](#_name-property)
    - [\_active (property)](#_active-property)
    - [parent (property)](#parent-property)
    - [\_children (property)](#_children-property)
    - [\_onSpawned$ (property)](#_onspawned-property)
    - [\_onRemoved$ (property)](#_onremoved-property)

---

# utils

## GgEntity (class)

**Signature**

```ts
export declare class GgEntity
```

### addChildren (method)

**Signature**

```ts
public addChildren(...entities: GgEntity[])
```

### removeChildren (method)

**Signature**

```ts
public removeChildren(entities: GgEntity[], dispose: boolean = false)
```

### onSpawned (method)

**Signature**

```ts
public onSpawned(world: GgWorld<any, any>)
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
_world: GgWorld<any, any, GgVisualScene<any, any>, GgPhysicsWorld<any, any>> | null
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
parent: GgEntity | null
```

### \_children (property)

**Signature**

```ts
_children: GgEntity[]
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
