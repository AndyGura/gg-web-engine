---
title: core/base/entities/gg-entity.ts
nav_order: 41
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
    - [\_world (property)](#_world-property)
    - [\_name (property)](#_name-property)
    - [\_children (property)](#_children-property)

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

### \_world (property)

**Signature**

```ts
_world: GgWorld<any, any, GgVisualScene<any, any>, GgPhysicsWorld<any, any>> | null
```

### \_name (property)

**Signature**

```ts
_name: string
```

### \_children (property)

**Signature**

```ts
_children: GgEntity[]
```
