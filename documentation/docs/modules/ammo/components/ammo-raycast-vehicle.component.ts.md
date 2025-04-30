---
title: ammo/components/ammo-raycast-vehicle.component.ts
nav_order: 6
parent: Modules
---

## ammo-raycast-vehicle.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoRaycastVehicleComponent (class)](#ammoraycastvehiclecomponent-class)
    - [refreshCG (method)](#refreshcg-method)
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
    - [resetMotion (method)](#resetmotion-method)
    - [nativeVehicle (property)](#nativevehicle-property)
    - [vehicleTuning (property)](#vehicletuning-property)
    - [wheelDirectionCS0 (property)](#wheeldirectioncs0-property)
    - [wheelAxleCS (property)](#wheelaxlecs-property)
    - [entity (property)](#entity-property)
    - [raycaster (property)](#raycaster-property)

---

# utils

## AmmoRaycastVehicleComponent (class)

**Signature**

```ts
export declare class AmmoRaycastVehicleComponent {
  constructor(protected readonly world: AmmoWorldComponent, public chassisBody: AmmoRigidBodyComponent)
}
```

### refreshCG (method)

**Signature**

```ts
refreshCG()
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>)
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>)
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
public clone(): AmmoRaycastVehicleComponent
```

### resetMotion (method)

**Signature**

```ts
resetMotion()
```

### nativeVehicle (property)

**Signature**

```ts
readonly nativeVehicle: Ammo.btRaycastVehicle
```

### vehicleTuning (property)

**Signature**

```ts
readonly vehicleTuning: Ammo.btVehicleTuning
```

### wheelDirectionCS0 (property)

**Signature**

```ts
readonly wheelDirectionCS0: Ammo.btVector3
```

### wheelAxleCS (property)

**Signature**

```ts
readonly wheelAxleCS: Ammo.btVector3
```

### entity (property)

**Signature**

```ts
entity: any
```

### raycaster (property)

**Signature**

```ts
readonly raycaster: Ammo.btDefaultVehicleRaycaster
```
