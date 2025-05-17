---
title: core/3d/factories.ts
nav_order: 50
parent: Modules
---

## factories overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [DisplayObject3dOpts (type alias)](#displayobject3dopts-type-alias)
  - [IDisplayObject3dComponentFactory (class)](#idisplayobject3dcomponentfactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [createPerspectiveCamera (method)](#createperspectivecamera-method)
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
}
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
}
```
