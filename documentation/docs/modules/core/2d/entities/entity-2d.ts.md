---
title: core/2d/entities/entity-2d.ts
nav_order: 19
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
export declare class Entity2d<VTypeDoc, PTypeDoc> {
  constructor(
    public readonly object2D: VTypeDoc['displayObject'] | null,
    public readonly objectBody: PTypeDoc['rigidBody'] | null
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
protected runTransformBinding(objectBody: PTypeDoc['rigidBody'], object2D: VTypeDoc['displayObject'] | null): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```
