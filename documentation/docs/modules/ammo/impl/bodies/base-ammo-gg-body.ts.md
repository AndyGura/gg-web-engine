---
title: ammo/impl/bodies/base-ammo-gg-body.ts
nav_order: 3
parent: Modules
---

## base-ammo-gg-body overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BaseAmmoGGBody (class)](#baseammoggbody-class)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [resetMotion (method)](#resetmotion-method)
    - [name (property)](#name-property)
    - [entity (property)](#entity-property)

---

# utils

## BaseAmmoGGBody (class)

**Signature**

```ts
export declare class BaseAmmoGGBody<T> {
  protected constructor(protected readonly world: Gg3dPhysicsWorld, protected _nativeBody: T)
}
```

### clone (method)

**Signature**

```ts
abstract clone(): BaseAmmoGGBody<T>;
```

### addToWorld (method)

**Signature**

```ts
abstract addToWorld(world: Gg3dPhysicsWorld): void;
```

### removeFromWorld (method)

**Signature**

```ts
abstract removeFromWorld(world: Gg3dPhysicsWorld): void;
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### resetMotion (method)

**Signature**

```ts
abstract resetMotion(): void;
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
