---
title: rapier3d/components/rapier-3d-raycast-vehicle.component.ts
nav_order: 119
parent: Modules
---

## rapier-3d-raycast-vehicle.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dRaycastVehicleComponent (class)](#rapier3draycastvehiclecomponent-class)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [addWheel (method)](#addwheel-method)
    - [setSteering (method)](#setsteering-method)
    - [applyEngineForce (method)](#applyengineforce-method)
    - [applyBrake (method)](#applybrake-method)
    - [isWheelTouchesGround (method)](#iswheeltouchesground-method)
    - [getWheelTransform (method)](#getwheeltransform-method)
    - [resetSuspension (method)](#resetsuspension-method)
    - [clone (method)](#clone-method)
    - [dispose (method)](#dispose-method)
    - [\_nativeVehicle (property)](#_nativevehicle-property)

---

# utils

## Rapier3dRaycastVehicleComponent (class)

**Signature**

```ts
export declare class Rapier3dRaycastVehicleComponent {
  constructor(protected readonly world: Rapier3dWorldComponent, private chassisBody: Rapier3dRigidBodyComponent)
}
```

### addToWorld (method)

**Signature**

```ts
addToWorld(
    world: Gg3dWorld<VisualTypeDocRepo3D, Rapier3dPhysicsTypeDocRepo, IVisualScene3dComponent, Rapier3dWorldComponent>,
  )
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(
    world: Gg3dWorld<VisualTypeDocRepo3D, Rapier3dPhysicsTypeDocRepo, IVisualScene3dComponent, Rapier3dWorldComponent>,
  )
```

### addWheel (method)

**Signature**

```ts
addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void
```

### setSteering (method)

**Signature**

```ts
setSteering(wheelIndex: number, steering: number): void
```

### applyEngineForce (method)

**Signature**

```ts
applyEngineForce(wheelIndex: number, force: number): void
```

### applyBrake (method)

**Signature**

```ts
applyBrake(wheelIndex: number, force: number): void
```

### isWheelTouchesGround (method)

**Signature**

```ts
isWheelTouchesGround(wheelIndex: number): boolean
```

### getWheelTransform (method)

**Signature**

```ts
getWheelTransform(wheelIndex: number): { position: Point3; rotation: Point4 }
```

### resetSuspension (method)

**Signature**

```ts
resetSuspension(): void
```

### clone (method)

**Signature**

```ts
clone(): Rapier3dRaycastVehicleComponent
```

### dispose (method)

**Signature**

```ts
dispose()
```

### \_nativeVehicle (property)

**Signature**

```ts
_nativeVehicle: any
```
