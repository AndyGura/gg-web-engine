---
title: core/2d/factories.ts
nav_order: 13
parent: Modules
---

## factories overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IGg2dBodyFactory (interface)](#igg2dbodyfactory-interface)
  - [IGg2dObjectFactory (class)](#igg2dobjectfactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [createSquare (method)](#createsquare-method)
    - [createCircle (method)](#createcircle-method)

---

# utils

## IGg2dBodyFactory (interface)

**Signature**

```ts
export interface IGg2dBodyFactory<T extends IGg2dBody = IGg2dBody, K extends IGg2dTrigger = IGg2dTrigger> {
  createRigidBody(descriptor: BodyShape2DDescriptor, transform?: { position?: Point2; rotation?: number }): T
  createTrigger(descriptor: Shape2DDescriptor, transform?: { position?: Point2; rotation?: number }): K
}
```

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
