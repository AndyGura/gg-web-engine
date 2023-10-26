---
title: core/3d/factories.ts
nav_order: 44
parent: Modules
---

## factories overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IDisplayObject3dComponentFactory (class)](#idisplayobject3dcomponentfactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [createBox (method)](#createbox-method)
    - [createCapsule (method)](#createcapsule-method)
    - [createCylinder (method)](#createcylinder-method)
    - [createCone (method)](#createcone-method)
    - [createSphere (method)](#createsphere-method)
  - [IPhysicsBody3dComponentFactory (interface)](#iphysicsbody3dcomponentfactory-interface)

---

# utils

## IDisplayObject3dComponentFactory (class)

**Signature**

```ts
export declare class IDisplayObject3dComponentFactory<DOC>
```

### createPrimitive (method)

**Signature**

```ts
abstract createPrimitive(descriptor: Shape3DDescriptor, material?: any): DOC;
```

### createBox (method)

**Signature**

```ts
createBox(dimensions: Point3, material?: any): DOC
```

### createCapsule (method)

**Signature**

```ts
createCapsule(radius: number, centersDistance: number, material?: any): DOC
```

### createCylinder (method)

**Signature**

```ts
createCylinder(radius: number, height: number, material?: any): DOC
```

### createCone (method)

**Signature**

```ts
createCone(radius: number, height: number, material?: any): DOC
```

### createSphere (method)

**Signature**

```ts
createSphere(radius: number): DOC
```

## IPhysicsBody3dComponentFactory (interface)

**Signature**

```ts
export interface IPhysicsBody3dComponentFactory<
  T extends IRigidBody3dComponent = IRigidBody3dComponent,
  K extends ITrigger3dComponent = ITrigger3dComponent
> {
  createRigidBody(descriptor: BodyShape3DDescriptor, transform?: { position?: Point3; rotation?: Point4 }): T

  createTrigger(descriptor: Shape3DDescriptor, transform?: { position?: Point3; rotation?: Point4 }): K
}
```
