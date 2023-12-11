---
title: rapier2d/rapier-2d-factory.ts
nav_order: 109
parent: Modules
---

## rapier-2d-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dFactory (class)](#rapier2dfactory-class)
    - [createRigidBody (method)](#createrigidbody-method)
    - [createTrigger (method)](#createtrigger-method)
    - [createColliderDescr (method)](#createcolliderdescr-method)
    - [createRigidBodyDescr (method)](#createrigidbodydescr-method)

---

# utils

## Rapier2dFactory (class)

**Signature**

```ts
export declare class Rapier2dFactory {
  constructor(protected readonly world: Rapier2dWorldComponent)
}
```

### createRigidBody (method)

**Signature**

```ts
createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): Rapier2dRigidBodyComponent
```

### createTrigger (method)

**Signature**

```ts
createTrigger(
    descriptor: Shape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): Rapier2dTriggerComponent
```

### createColliderDescr (method)

**Signature**

```ts
public createColliderDescr(descriptor: Shape2DDescriptor): ColliderDesc[]
```

### createRigidBodyDescr (method)

**Signature**

```ts
public createRigidBodyDescr(
    options: Partial<Body2DOptions>,
    transform?: { position?: Point2; rotation?: number },
  ): RigidBodyDesc
```
