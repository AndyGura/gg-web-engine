---
title: matter/matter-factory.ts
nav_order: 100
parent: Modules
---

## matter-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterFactory (class)](#matterfactory-class)
    - [createRigidBody (method)](#createrigidbody-method)
    - [createTrigger (method)](#createtrigger-method)
    - [transformOptions (method)](#transformoptions-method)

---

# utils

## MatterFactory (class)

**Signature**

```ts
export declare class MatterFactory
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
  ): MatterRigidBodyComponent
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
  ): any
```

### transformOptions (method)

**Signature**

```ts
private transformOptions(options: Partial<Body2DOptions>): IBodyDefinition
```
