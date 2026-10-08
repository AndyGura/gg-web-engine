---
title: core/2d/factories.ts
nav_order: 37
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
    - [createParallaxLayer (method)](#createparallaxlayer-method)
    - [loadTexture (method)](#loadtexture-method)
    - [createTextureFromCanvas (method)](#createtexturefromcanvas-method)
    - [createText (method)](#createtext-method)
    - [createCamera (method)](#createcamera-method)
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
  /** Fill color of an untextured shape; with a `texture`, a tint multiplied over it instead. */
  color?: number
  texture?: Tex
  /** An outline around an untextured shape. Ignored for a textured one. */
  stroke?: { color: number; width: number }
  /** Opacity from `0` (invisible) to `1` (opaque, the default), see `IDisplayObject2dComponent.opacity`. */
  opacity?: number
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

### createParallaxLayer (method)

Creates a parallax layer (see `ParallaxLayer2dOpts`). Wrap it in a `ParallaxLayer2dEntity` (or
use `Gg2dWorld.addParallaxLayer`) to add it to a world.

**Signature**

```ts
abstract createParallaxLayer(options: ParallaxLayer2dOpts<VTypeDoc['texture']>): VTypeDoc['parallaxLayer'];
```

### loadTexture (method)

Loads an image as a texture, for `DisplayObject2dOpts.texture`, a parallax layer or a background.

**Signature**

```ts
abstract loadTexture(url: string, options?: TextureOptions): Promise<VTypeDoc['texture']>;
```

### createTextureFromCanvas (method)

Creates a texture from a canvas the app has drawn on, e.g. a procedurally generated backdrop.
The canvas is read once, now: drawing on it afterwards doesn't update the texture.

**Signature**

```ts
abstract createTextureFromCanvas(canvas: HTMLCanvasElement, options?: TextureOptions): VTypeDoc['texture'];
```

### createText (method)

Creates a text object, see `IText2dComponent` and `Text2dStyle`.

**Signature**

```ts
abstract createText(text: string, style?: Text2dStyle): VTypeDoc['text'];
```

### createCamera (method)

Creates a camera, to pass to `Gg2dWorld.addRenderer`. Its `position` is the world point shown
at the renderer's top-left corner, and `zoom` scales the view (see `ICamera2dComponent`).

**Signature**

```ts
abstract createCamera(): VTypeDoc['camera'];
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
