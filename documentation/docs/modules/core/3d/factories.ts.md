---
title: core/3d/factories.ts
nav_order: 30
parent: Modules
---

## factories overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IGg3dBodyFactory (interface)](#igg3dbodyfactory-interface)
  - [IGg3dObjectFactory (class)](#igg3dobjectfactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [createBox (method)](#createbox-method)
    - [createCapsule (method)](#createcapsule-method)
    - [createCylinder (method)](#createcylinder-method)
    - [createCone (method)](#createcone-method)
    - [createSphere (method)](#createsphere-method)

---

# utils

## IGg3dBodyFactory (interface)

**Signature**

```ts
export interface IGg3dBodyFactory<T extends IGg3dBody = IGg3dBody, K extends IGg3dTrigger = IGg3dTrigger> {
  createRigidBody(descriptor: BodyShape3DDescriptor, transform?: { position?: Point3; rotation?: Point4 }): T
  createTrigger(descriptor: Shape3DDescriptor, transform?: { position?: Point3; rotation?: Point4 }): K
}
```

## IGg3dObjectFactory (class)

**Signature**

```ts
export declare class IGg3dObjectFactory<T>
```

### createPrimitive (method)

**Signature**

```ts
abstract createPrimitive(descriptor: Shape3DDescriptor, material?: any): T;
```

### createBox (method)

**Signature**

```ts
createBox(dimensions: Point3, material?: any): T
```

### createCapsule (method)

**Signature**

```ts
createCapsule(radius: number, centersDistance: number, material?: any): T
```

### createCylinder (method)

**Signature**

```ts
createCylinder(radius: number, height: number, material?: any): T
```

### createCone (method)

**Signature**

```ts
createCone(radius: number, height: number, material?: any): T
```

### createSphere (method)

**Signature**

```ts
createSphere(radius: number): T
```
