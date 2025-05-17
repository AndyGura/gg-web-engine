---
title: core/2d/entities/entity-2d.ts
nav_order: 18
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
    - [object2D (property)](#object2d-property)
    - [objectBody (property)](#objectbody-property)

---

# utils

## Entity2d (class)

**Signature**

```ts
export declare class Entity2d<TypeDoc> {
  constructor(options: {
    object2D?: TypeDoc['vTypeDoc']['displayObject']
    objectBody?: TypeDoc['pTypeDoc']['rigidBody']
  })
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
protected runTransformBinding(
    objectBody: TypeDoc['pTypeDoc']['rigidBody'],
    object2D: TypeDoc['vTypeDoc']['displayObject'] | null,
  ): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```

### object2D (property)

**Signature**

```ts
readonly object2D: TypeDoc["vTypeDoc"]["displayObject"] | null
```

### objectBody (property)

**Signature**

```ts
readonly objectBody: TypeDoc["pTypeDoc"]["rigidBody"] | null
```
