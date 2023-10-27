---
title: core/2d/factories.ts
nav_order: 21
parent: Modules
---

## factories overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IGg2dObjectFactory (class)](#igg2dobjectfactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [createSquare (method)](#createsquare-method)
    - [createCircle (method)](#createcircle-method)
  - [IPhysicsBody2dComponentFactory (interface)](#iphysicsbody2dcomponentfactory-interface)

---

# utils

## IGg2dObjectFactory (class)

**Signature**

```ts
export declare class IGg2dObjectFactory<T>
```

### createPrimitive (method)

**Signature**

```ts
abstract createPrimitive(descriptor: Shape2DDescriptor): T;
```

### createSquare (method)

**Signature**

```ts
createSquare(dimensions: Point2): T
```

### createCircle (method)

**Signature**

```ts
createCircle(radius: number): T
```

## IPhysicsBody2dComponentFactory (interface)

**Signature**

```ts
export interface IPhysicsBody2dComponentFactory<
  T extends IRigidBody2dComponent = IRigidBody2dComponent,
  K extends ITrigger2dComponent = ITrigger2dComponent
> {
  createRigidBody(descriptor: BodyShape2DDescriptor, transform?: { position?: Point2; rotation?: number }): T

  createTrigger(descriptor: Shape2DDescriptor, transform?: { position?: Point2; rotation?: number }): K
}
```
