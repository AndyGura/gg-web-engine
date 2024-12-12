---
title: core/3d/entities/entity-3d.ts
nav_order: 42
parent: Modules
---

## entity-3d overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Entity3d (class)](#entity3d-class)
    - [updateVisibility (method)](#updatevisibility-method)
    - [runTransformBinding (method)](#runtransformbinding-method)
    - [tickOrder (property)](#tickorder-property)
    - [object3D (property)](#object3d-property)
    - [objectBody (property)](#objectbody-property)

---

# utils

## Entity3d (class)

**Signature**

```ts
export declare class Entity3d<VTypeDoc, PTypeDoc> {
  constructor(options: { object3D?: VTypeDoc['displayObject'] | null; objectBody?: PTypeDoc['rigidBody'] | null })
}
```

### updateVisibility (method)

**Signature**

```ts
public updateVisibility(): void
```

### runTransformBinding (method)

Synchronize physics body transform with entity (and mesh if defined)

**Signature**

```ts
protected runTransformBinding(objectBody: IRigidBody3dComponent, object3D: IDisplayObject3dComponent | null): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```

### object3D (property)

**Signature**

```ts
readonly object3D: VTypeDoc["displayObject"] | null
```

### objectBody (property)

**Signature**

```ts
readonly objectBody: PTypeDoc["rigidBody"] | null
```
