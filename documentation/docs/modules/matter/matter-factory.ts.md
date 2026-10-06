---
title: matter/matter-factory.ts
nav_order: 178
parent: Modules
---

## matter-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterFactory (class)](#matterfactory-class)
    - [createRigidBody (method)](#createrigidbody-method)
    - [createTrigger (method)](#createtrigger-method)
    - [createCharacterController (method)](#createcharactercontroller-method)

---

# utils

## MatterFactory (class)

**Signature**

```ts
export declare class MatterFactory {
  constructor(protected readonly world: MatterWorldComponent)
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
  ): MatterTriggerComponent
```

### createCharacterController (method)

**Signature**

```ts
createCharacterController(
    options: CharacterController2dOptions,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): MatterCharacterControllerComponent
```
