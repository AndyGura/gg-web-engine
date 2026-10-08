---
title: ammo/components/ammo-body.component.ts
nav_order: 5
parent: Modules
---

## ammo-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoBodyComponent (class)](#ammobodycomponent-class)
    - [scratchVector (static method)](#scratchvector-static-method)
    - [scratchQuaternion (static method)](#scratchquaternion-static-method)
    - [applyWorldTransform (method)](#applyworldtransform-method)
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
  protected constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: T,
    public readonly shape: Shape3DDescriptor
  )
}
```

### scratchVector (static method)

One shared `btVector3` for passing a value into a native call that copies it (`setOrigin`,
`setLinearVelocity`, ...). Setters run every tick for a moving body, and a `new Ammo.btVector3`
per call is never freed by the garbage collector - it piles up in the WASM heap until
`Aborted(OOM)`. Never hold on to it: the next setter call overwrites it.

**Signature**

```ts
protected static scratchVector(x: number, y: number, z: number): Ammo.btVector3
```

### scratchQuaternion (static method)

`btQuaternion` counterpart of {@link scratchVector}.

**Signature**

```ts
protected static scratchQuaternion(q: Point4): Ammo.btQuaternion
```

### applyWorldTransform (method)

Moves the body to `transform` (this body's own, already modified, world transform object) -
what the `position`/`rotation` setters end with. Body types that keep more than one transform
in sync override it (see `AmmoRigidBodyComponent`).

**Signature**

```ts
protected applyWorldTransform(transform: Ammo.btTransform): void
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
addToWorld(world: AmmoGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: AmmoGgWorld, dispose: boolean = false): void
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
entity: IEntity<any, any, GgWorldTypeDocRepo<any, any>> | null
```

### addedToWorld (property)

**Signature**

```ts
addedToWorld: boolean
```

### \_interactWithCGsMask (property)

**Signature**

```ts
_interactWithCGsMask: number
```

### \_ownCGsMask (property)

**Signature**

```ts
_ownCGsMask: number
```
