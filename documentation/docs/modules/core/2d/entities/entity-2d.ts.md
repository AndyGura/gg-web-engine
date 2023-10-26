---
title: core/2d/entities/entity-2d.ts
nav_order: 17
parent: Modules
---

## entity-2d overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Entity2d (class)](#entity2d-class)
    - [updateVisibility (method)](#updatevisibility-method)
    - [runTransformBinding (method)](#runtransformbinding-method)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## Entity2d (class)

**Signature**

```ts
export declare class Entity2d {
  constructor(
    public readonly object2D: IDisplayObject2dComponent | null,
    public readonly objectBody: IRigidBody2dComponent | null
  )
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
protected runTransformBinding(objectBody: IRigidBody2dComponent, object2D: IDisplayObject2dComponent | null): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```
