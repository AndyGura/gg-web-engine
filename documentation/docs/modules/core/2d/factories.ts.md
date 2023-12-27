---
title: core/2d/factories.ts
nav_order: 23
parent: Modules
---

## factories overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [DisplayObject2dOpts (type alias)](#displayobject2dopts-type-alias)
  - [IDisplayObject2dComponentFactory (class)](#idisplayobject2dcomponentfactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [randomColor (method)](#randomcolor-method)
    - [createSquare (method)](#createsquare-method)
    - [createCircle (method)](#createcircle-method)
  - [IPhysicsBody2dComponentFactory (interface)](#iphysicsbody2dcomponentfactory-interface)

---

# utils

## DisplayObject2dOpts (type alias)

**Signature**

```ts
export type DisplayObject2dOpts<Tex> = {
  color?: number
  texture?: Tex
}
```

## IDisplayObject2dComponentFactory (class)

**Signature**

```ts
export declare class IDisplayObject2dComponentFactory<TypeDoc>
```

### createPrimitive (method)

**Signature**

```ts
abstract createPrimitive(
    descriptor: Shape2DDescriptor,
    material?: DisplayObject2dOpts<TypeDoc['texture']>,
  ): TypeDoc['displayObject'];
```

### randomColor (method)

**Signature**

```ts
randomColor(): number
```

### createSquare (method)

**Signature**

```ts
createSquare(dimensions: Point2, material: DisplayObject2dOpts<TypeDoc['texture']> = {}): TypeDoc['displayObject']
```

### createCircle (method)

**Signature**

```ts
createCircle(radius: number, material: DisplayObject2dOpts<TypeDoc['texture']> = {}): TypeDoc['displayObject']
```

## IPhysicsBody2dComponentFactory (interface)

**Signature**

```ts
export interface IPhysicsBody2dComponentFactory<TypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D> {
  createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2
      rotation?: number
    }
  ): TypeDoc['rigidBody']

  createTrigger(
    descriptor: Shape2DDescriptor,
    transform?: {
      position?: Point2
      rotation?: number
    }
  ): TypeDoc['trigger']
}
```
