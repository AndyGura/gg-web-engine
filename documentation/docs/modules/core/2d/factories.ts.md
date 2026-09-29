---
title: core/2d/factories.ts
nav_order: 33
parent: Modules
---

## factories overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [DisplayObject2dOpts (type alias)](#displayobject2dopts-type-alias)
  - [IAudioSource2dComponentFactory (interface)](#iaudiosource2dcomponentfactory-interface)
  - [IDisplayObject2dComponentFactory (class)](#idisplayobject2dcomponentfactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [randomColor (method)](#randomcolor-method)
    - [createBox (method)](#createbox-method)
    - [createCircle (method)](#createcircle-method)
    - [createCapsule (method)](#createcapsule-method)
    - [createConvexHull (method)](#createconvexhull-method)
    - [createPolygon (method)](#createpolygon-method)
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

## IAudioSource2dComponentFactory (interface)

**Signature**

```ts
export interface IAudioSource2dComponentFactory<ATypeDoc extends AudioTypeDocRepo2D = AudioTypeDocRepo2D>
  extends IAudioSourceComponentFactory<Point2, number, ATypeDoc> {}
```

## IDisplayObject2dComponentFactory (class)

**Signature**

```ts
export declare class IDisplayObject2dComponentFactory<VTypeDoc>
```

### createPrimitive (method)

**Signature**

```ts
abstract createPrimitive(
    descriptor: Shape2DDescriptor,
    material?: DisplayObject2dOpts<VTypeDoc['texture']>,
  ): VTypeDoc['displayObject'];
```

### randomColor (method)

**Signature**

```ts
randomColor(): number
```

### createBox (method)

**Signature**

```ts
createBox(dimensions: Point2, material: DisplayObject2dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject']
```

### createCircle (method)

**Signature**

```ts
createCircle(radius: number, material: DisplayObject2dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject']
```

### createCapsule (method)

**Signature**

```ts
createCapsule(
    radius: number,
    centersDistance: number,
    material: DisplayObject2dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject']
```

### createConvexHull (method)

**Signature**

```ts
createConvexHull(
    vertices: Point2[],
    material: DisplayObject2dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject']
```

### createPolygon (method)

**Signature**

```ts
createPolygon(
    vertices: Point2[],
    material: DisplayObject2dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject']
```

## IPhysicsBody2dComponentFactory (interface)

**Signature**

```ts
export interface IPhysicsBody2dComponentFactory<PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D> {
  createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2
      rotation?: number
    }
  ): PTypeDoc['rigidBody']

  createTrigger(
    descriptor: Shape2DDescriptor,
    transform?: {
      position?: Point2
      rotation?: number
    }
  ): PTypeDoc['trigger']

  createCharacterController(
    options: CharacterController2dOptions,
    transform?: {
      position?: Point2
      rotation?: number
    }
  ): PTypeDoc['characterController']
}
```
