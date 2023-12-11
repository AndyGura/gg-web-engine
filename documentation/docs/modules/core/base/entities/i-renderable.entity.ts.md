---
title: core/base/entities/i-renderable.entity.ts
nav_order: 73
parent: Modules
---

## i-renderable.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRenderableEntity (class)](#irenderableentity-class)
    - [updateVisibility (method)](#updatevisibility-method)
    - [addChildren (method)](#addchildren-method)
    - [removeChildren (method)](#removechildren-method)

---

# utils

## IRenderableEntity (class)

**Signature**

```ts
export declare class IRenderableEntity<D, R, V, P>
```

### updateVisibility (method)

**Signature**

```ts
public updateVisibility(): void
```

### addChildren (method)

**Signature**

```ts
addChildren(...entities: IEntity[])
```

### removeChildren (method)

**Signature**

```ts
removeChildren(entities: IEntity[], dispose: boolean = false)
```
