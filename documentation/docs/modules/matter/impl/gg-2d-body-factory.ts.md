---
title: matter/impl/gg-2d-body-factory.ts
nav_order: 70
parent: Modules
---

## gg-2d-body-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dBodyFactory (class)](#gg2dbodyfactory-class)
    - [createRigidBody (method)](#createrigidbody-method)
    - [createTrigger (method)](#createtrigger-method)
    - [transformOptions (method)](#transformoptions-method)

---

# utils

## Gg2dBodyFactory (class)

**Signature**

```ts
export declare class Gg2dBodyFactory
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
  ): Gg2dBody
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
