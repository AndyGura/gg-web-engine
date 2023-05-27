---
title: core/2d/entities/gg-2d-entity.ts
nav_order: 11
parent: Modules
---

## gg-2d-entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dEntity (class)](#gg2dentity-class)
    - [updateVisibility (method)](#updatevisibility-method)
    - [runTransformBinding (method)](#runtransformbinding-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## Gg2dEntity (class)

**Signature**

```ts
export declare class Gg2dEntity {
  constructor(public readonly object2D: IGg2dObject | null, public readonly objectBody: IGg2dBody | null)
}
```

### updateVisibility (method)

**Signature**

```ts
public updateVisibility(): void
```

### runTransformBinding (method)

Synchronize physics body transform with entity (and object2d if defined)

**Signature**

```ts
protected runTransformBinding(objectBody: IGg2dBody, object2D: IGg2dObject | null): void
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg2dWorld)
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
readonly tickOrder: GGTickOrder.OBJECTS_BINDING
```
