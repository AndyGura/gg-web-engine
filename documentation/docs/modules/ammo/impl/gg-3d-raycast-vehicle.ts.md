---
title: ammo/impl/gg-3d-raycast-vehicle.ts
nav_order: 9
parent: Modules
---

## gg-3d-raycast-vehicle overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dRaycastVehicle (class)](#gg3draycastvehicle-class)
    - [addToWorld (method)](#addtoworld-method)
    - [addWheel (method)](#addwheel-method)
    - [setSteering (method)](#setsteering-method)
    - [applyEngineForce (method)](#applyengineforce-method)
    - [applyBrake (method)](#applybrake-method)
    - [isWheelTouchesGround (method)](#iswheeltouchesground-method)
    - [getWheelTransform (method)](#getwheeltransform-method)
    - [resetSuspension (method)](#resetsuspension-method)
    - [nativeVehicle (property)](#nativevehicle-property)
    - [vehicleTuning (property)](#vehicletuning-property)
    - [wheelDirectionCS0 (property)](#wheeldirectioncs0-property)
    - [wheelAxleCS (property)](#wheelaxlecs-property)
    - [entity (property)](#entity-property)

---

# utils

## Gg3dRaycastVehicle (class)

**Signature**

```ts
export declare class Gg3dRaycastVehicle {
  constructor(protected readonly world: Gg3dPhysicsWorld, public chassisBody: Ammo.btRigidBody)
}
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dPhysicsWorld)
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

### nativeVehicle (property)

**Signature**

```ts
readonly nativeVehicle: any
```

### vehicleTuning (property)

**Signature**

```ts
readonly vehicleTuning: any
```

### wheelDirectionCS0 (property)

**Signature**

```ts
readonly wheelDirectionCS0: any
```

### wheelAxleCS (property)

**Signature**

```ts
readonly wheelAxleCS: any
```

### entity (property)

**Signature**

```ts
entity: any
```