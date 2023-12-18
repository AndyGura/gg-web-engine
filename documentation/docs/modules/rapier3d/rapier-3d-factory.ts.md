---
title: rapier3d/rapier-3d-factory.ts
nav_order: 120
parent: Modules
---

## rapier-3d-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dFactory (class)](#rapier3dfactory-class)
    - [createRigidBody (method)](#createrigidbody-method)
    - [createTrigger (method)](#createtrigger-method)
    - [createRaycastVehicle (method)](#createraycastvehicle-method)
    - [createColliderDescr (method)](#createcolliderdescr-method)
    - [createRigidBodyDescr (method)](#createrigidbodydescr-method)

---

# utils

## Rapier3dFactory (class)

**Signature**

```ts
export declare class Rapier3dFactory {
  constructor(protected readonly world: Rapier3dWorldComponent)
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
  ): Rapier3dRigidBodyComponent
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
  ): Rapier3dTriggerComponent
```

### createRaycastVehicle (method)

**Signature**

```ts
createRaycastVehicle(chassis: Rapier3dRigidBodyComponent): never
```

### createColliderDescr (method)

**Signature**

```ts
public createColliderDescr(descriptor: Shape3DDescriptor): ColliderDesc[]
```

### createRigidBodyDescr (method)

**Signature**

```ts
public createRigidBodyDescr(
    options: Partial<Body3DOptions>,
    transform?: { position?: Point3; rotation?: Point4 },
  ): RigidBodyDesc
```
