---
title: core/3d/interfaces.ts
nav_order: 29
parent: Modules
---

## interfaces overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dRenderer (class)](#gg3drenderer-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [camera (property)](#camera-property)
  - [IGg3dBody (interface)](#igg3dbody-interface)
  - [IGg3dBodyLoader (class)](#igg3dbodyloader-class)
    - [loadFromGgGlb (method)](#loadfromggglb-method)
  - [IGg3dCamera (interface)](#igg3dcamera-interface)
  - [IGg3dObject (interface)](#igg3dobject-interface)
  - [IGg3dObjectLoader (interface)](#igg3dobjectloader-interface)
  - [IGg3dPhysicsWorld (interface)](#igg3dphysicsworld-interface)
  - [IGg3dRaycastVehicle (interface)](#igg3draycastvehicle-interface)
  - [IGg3dTrigger (interface)](#igg3dtrigger-interface)
  - [IGg3dVisualScene (interface)](#igg3dvisualscene-interface)

---

# utils

## Gg3dRenderer (class)

**Signature**

```ts
export declare class Gg3dRenderer
```

### onSpawned (method)

**Signature**

```ts
public onSpawned(world: GgWorld<any, any>)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### camera (property)

**Signature**

```ts
readonly camera: Gg3dCameraEntity<IGg3dCamera>
```

## IGg3dBody (interface)

**Signature**

```ts
export interface IGg3dBody extends GgBody<Point3, Point4> {}
```

## IGg3dBodyLoader (class)

**Signature**

```ts
export declare class IGg3dBodyLoader {
  protected constructor(protected readonly world: IGg3dPhysicsWorld)
}
```

### loadFromGgGlb (method)

**Signature**

```ts
async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<IGg3dBody[]>
```

## IGg3dCamera (interface)

**Signature**

```ts
export interface IGg3dCamera extends IGg3dObject {
```

## IGg3dObject (interface)

**Signature**

```ts
export interface IGg3dObject extends GgObject<Point3, Point4> {}
```

## IGg3dObjectLoader (interface)

**Signature**

```ts
export interface IGg3dObjectLoader {
  loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<IGg3dObject | null>
}
```

## IGg3dPhysicsWorld (interface)

**Signature**

```ts
export interface IGg3dPhysicsWorld extends GgPhysicsWorld<Point3, Point4> {
  readonly factory: IGg3dBodyFactory
  readonly loader: IGg3dBodyLoader
}
```

## IGg3dRaycastVehicle (interface)

**Signature**

```ts
export interface IGg3dRaycastVehicle extends IGg3dBody {
```

## IGg3dTrigger (interface)

**Signature**

```ts
export interface IGg3dTrigger extends GgTrigger<Point3, Point4> {
```

## IGg3dVisualScene (interface)

**Signature**

```ts
export interface IGg3dVisualScene extends GgVisualScene<Point3, Point4> {
  readonly factory: IGg3dObjectFactory
  readonly loader: IGg3dObjectLoader
}
```
