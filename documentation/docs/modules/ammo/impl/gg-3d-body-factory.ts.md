---
title: ammo/impl/gg-3d-body-factory.ts
nav_order: 6
parent: Modules
---

## gg-3d-body-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dBodyFactory (class)](#gg3dbodyfactory-class)
    - [createRigidBody (method)](#createrigidbody-method)
    - [createTrigger (method)](#createtrigger-method)
    - [createShape (method)](#createshape-method)
    - [createRigidBodyFromShape (method)](#createrigidbodyfromshape-method)
    - [createTriggerFromShape (method)](#createtriggerfromshape-method)

---

# utils

## Gg3dBodyFactory (class)

**Signature**

```ts
export declare class Gg3dBodyFactory {
  constructor(protected readonly world: Gg3dPhysicsWorld)
}
```

### createRigidBody (method)

**Signature**

```ts
createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): Gg3dBody
```

### createTrigger (method)

**Signature**

```ts
createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): Gg3dTrigger
```

### createShape (method)

**Signature**

```ts
protected createShape(descriptor: Shape3DDescriptor): Ammo.btCollisionShape
```

### createRigidBodyFromShape (method)

**Signature**

```ts
public createRigidBodyFromShape(
    shape: Ammo.btCollisionShape,
    options: Partial<Body3DOptions>,
    transform?: { position?: Point3; rotation?: Point4 },
  ): Gg3dBody
```

### createTriggerFromShape (method)

**Signature**

```ts
public createTriggerFromShape(
    shape: Ammo.btCollisionShape,
    transform?: { position?: Point3; rotation?: Point4 },
  ): Gg3dTrigger
```
