---
title: ammo/impl/bodies/gg-3d-body.ts
nav_order: 4
parent: Modules
---

## gg-3d-body overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dBody (class)](#gg3dbody-class)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [resetMotion (method)](#resetmotion-method)
    - [entity (property)](#entity-property)

---

# utils

## Gg3dBody (class)

**Signature**

```ts
export declare class Gg3dBody {
  constructor(protected readonly world: Gg3dPhysicsWorld, protected _nativeBody: Ammo.btRigidBody)
}
```

### clone (method)

**Signature**

```ts
clone(): Gg3dBody
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dPhysicsWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg3dPhysicsWorld): void
```

### resetMotion (method)

**Signature**

```ts
resetMotion(): void
```

### entity (property)

**Signature**

```ts
entity: any
```
