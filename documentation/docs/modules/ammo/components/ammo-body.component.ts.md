---
title: ammo/components/ammo-body.component.ts
nav_order: 6
parent: Modules
---

## ammo-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoBodyComponent (class)](#ammobodycomponent-class)
    - [refreshCG (method)](#refreshcg-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [name (property)](#name-property)
    - [entity (property)](#entity-property)
    - [addedToWorld (property)](#addedtoworld-property)
    - [\_interactWithCGsMask (property)](#_interactwithcgsmask-property)
    - [\_ownCGsMask (property)](#_owncgsmask-property)

---

# utils

## AmmoBodyComponent (class)

**Signature**

```ts
export declare class AmmoBodyComponent<T> {
  protected constructor(protected readonly world: AmmoWorldComponent, protected _nativeBody: T)
}
```

### refreshCG (method)

**Signature**

```ts
abstract refreshCG(): void;
```

### clone (method)

**Signature**

```ts
abstract clone(): AmmoBodyComponent<T>;
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### name (property)

**Signature**

```ts
name: string
```

### entity (property)

**Signature**

```ts
entity: any
```

### addedToWorld (property)

**Signature**

```ts
addedToWorld: boolean
```

### \_interactWithCGsMask (property)

**Signature**

```ts
_interactWithCGsMask: any
```

### \_ownCGsMask (property)

**Signature**

```ts
_ownCGsMask: any
```
