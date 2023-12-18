---
title: ammo/ammo-factory.ts
nav_order: 2
parent: Modules
---

## ammo-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoFactory (class)](#ammofactory-class)
    - [createRigidBody (method)](#createrigidbody-method)
    - [createTrigger (method)](#createtrigger-method)
    - [createRaycastVehicle (method)](#createraycastvehicle-method)
    - [createShape (method)](#createshape-method)
    - [createRigidBodyFromShape (method)](#createrigidbodyfromshape-method)
    - [createTriggerFromShape (method)](#createtriggerfromshape-method)

---

# utils

## AmmoFactory (class)

**Signature**

```ts
export declare class AmmoFactory {
  constructor(protected readonly world: AmmoWorldComponent)
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
  ): AmmoRigidBodyComponent
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
  ): AmmoTriggerComponent
```

### createRaycastVehicle (method)

**Signature**

```ts
createRaycastVehicle(chassis: AmmoRigidBodyComponent): AmmoRaycastVehicleComponent
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
  ): AmmoRigidBodyComponent
```

### createTriggerFromShape (method)

**Signature**

```ts
public createTriggerFromShape(
    shape: Ammo.btCollisionShape,
    transform?: { position?: Point3; rotation?: Point4 },
  ): AmmoTriggerComponent
```
