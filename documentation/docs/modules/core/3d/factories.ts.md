---
title: core/3d/factories.ts
nav_order: 86
parent: Modules
---

## factories overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [DisplayObject3dOpts (type alias)](#displayobject3dopts-type-alias)
  - [IAudioSource3dComponentFactory (interface)](#iaudiosource3dcomponentfactory-interface)
  - [IDisplayObject3dComponentFactory (class)](#idisplayobject3dcomponentfactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [createPerspectiveCamera (method)](#createperspectivecamera-method)
    - [createLight (method)](#createlight-method)
    - [createTextureFromCanvas (method)](#createtexturefromcanvas-method)
    - [randomColor (method)](#randomcolor-method)
    - [createPlane (method)](#createplane-method)
    - [createBox (method)](#createbox-method)
    - [createCapsule (method)](#createcapsule-method)
    - [createCylinder (method)](#createcylinder-method)
    - [createCone (method)](#createcone-method)
    - [createSphere (method)](#createsphere-method)
  - [IPhysicsBody3dComponentFactory (interface)](#iphysicsbody3dcomponentfactory-interface)

---

# utils

## DisplayObject3dOpts (type alias)

**Signature**

```ts
export type DisplayObject3dOpts<Tex> = {
  color?: number
  shading?: 'unlit' | 'standart' | 'phong' | 'wireframe'
  diffuse?: Tex
  castShadow?: boolean
  receiveShadow?: boolean
  /**
   * Opacity from `0` (invisible) to `1` (opaque, the default). Anything below `1` makes the
   * material render as transparent.
   */
  opacity?: number
}
```

## IAudioSource3dComponentFactory (interface)

**Signature**

```ts
export interface IAudioSource3dComponentFactory<ATypeDoc extends AudioTypeDocRepo3D = AudioTypeDocRepo3D>
  extends IAudioSourceComponentFactory<Point3, Point4, ATypeDoc> {}
```

## IDisplayObject3dComponentFactory (class)

**Signature**

```ts
export declare class IDisplayObject3dComponentFactory<VTypeDoc>
```

### createPrimitive (method)

**Signature**

```ts
abstract createPrimitive(
    descriptor: Shape3DMeshDescriptor,
    material?: DisplayObject3dOpts<VTypeDoc['texture']>,
  ): VTypeDoc['displayObject'];
```

### createPerspectiveCamera (method)

**Signature**

```ts
abstract createPerspectiveCamera(settings?: {
    fov?: number;
    aspectRatio?: number;
    frustrum?: { near: number; far: number };
  }): VTypeDoc['camera'];
```

### createLight (method)

Creates a light. Wrap it in a `Light3dEntity` (or use `Gg3dWorld.addLight`) to add it to a world.

**Signature**

```ts
abstract createLight(descriptor: Light3dDescriptor): VTypeDoc['light'];
```

### createTextureFromCanvas (method)

Creates a texture from a canvas the app has drawn on, e.g. a procedurally generated pattern,
for `DisplayObject3dOpts.diffuse`. The canvas is read once, now: drawing on it afterwards
doesn't update the texture. To load an image file instead, see
`IDisplayObject3dComponentLoader.loadTexture`.

**Signature**

```ts
abstract createTextureFromCanvas(canvas: HTMLCanvasElement, options?: LoadTextureOptions): VTypeDoc['texture'];
```

### randomColor (method)

**Signature**

```ts
randomColor(): number
```

### createPlane (method)

**Signature**

```ts
createPlane(material: DisplayObject3dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject']
```

### createBox (method)

**Signature**

```ts
createBox(dimensions: Point3, material: DisplayObject3dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject']
```

### createCapsule (method)

**Signature**

```ts
createCapsule(
    radius: number,
    centersDistance: number,
    material: DisplayObject3dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject']
```

### createCylinder (method)

**Signature**

```ts
createCylinder(
    radius: number,
    height: number,
    material: DisplayObject3dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject']
```

### createCone (method)

**Signature**

```ts
createCone(
    radius: number,
    height: number,
    material: DisplayObject3dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject']
```

### createSphere (method)

**Signature**

```ts
createSphere(radius: number, material: DisplayObject3dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject']
```

## IPhysicsBody3dComponentFactory (interface)

**Signature**

```ts
export interface IPhysicsBody3dComponentFactory<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D> {
  createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3
      rotation?: Point4
    }
  ): PTypeDoc['rigidBody']

  createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3
      rotation?: Point4
    }
  ): PTypeDoc['trigger']

  createRaycastVehicle(chassis: PTypeDoc['rigidBody']): PTypeDoc['raycastVehicle']

  createCharacterController(
    options: CharacterController3dOptions,
    transform?: {
      position?: Point3
      rotation?: Point4
    }
  ): PTypeDoc['characterController']
}
```
