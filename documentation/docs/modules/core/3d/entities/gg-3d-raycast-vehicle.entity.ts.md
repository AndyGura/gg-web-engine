---
title: core/3d/entities/gg-3d-raycast-vehicle.entity.ts
nav_order: 24
parent: Modules
---

## gg-3d-raycast-vehicle.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CarProperties (type alias)](#carproperties-type-alias)
  - [Gg3dRaycastVehicleEntity (class)](#gg3draycastvehicleentity-class)
    - [getSpeed (method)](#getspeed-method)
    - [calculateRpmFromCarSpeed (method)](#calculaterpmfromcarspeed-method)
    - [getDisplaySpeed (method)](#getdisplayspeed-method)
    - [getMaxStableSteerVal (method)](#getmaxstablesteerval-method)
    - [setTailLightsOn (method)](#settaillightson-method)
    - [setSteeringValue (method)](#setsteeringvalue-method)
    - [onSpawned (method)](#onspawned-method)
    - [runTransformBinding (method)](#runtransformbinding-method)
    - [updateEngine (method)](#updateengine-method)
    - [resetTo (method)](#resetto-method)
    - [setXAxisControlValue (method)](#setxaxiscontrolvalue-method)
    - [setYAxisControlValue (method)](#setyaxiscontrolvalue-method)
    - [frontWheelsIndices (property)](#frontwheelsindices-property)
    - [tractionWheelIndices (property)](#tractionwheelindices-property)
    - [tractionWheelRadius (property)](#tractionwheelradius-property)
    - [\_rpm$ (property)](#_rpm-property)
    - [\_acceleration$ (property)](#_acceleration-property)
    - [brake$ (property)](#brake-property)
  - [SuspensionOptions (type alias)](#suspensionoptions-type-alias)
  - [WheelOptions (type alias)](#wheeloptions-type-alias)

---

# utils

## CarProperties (type alias)

**Signature**

```ts
export type CarProperties = {
  typeOfDrive: 'RWD' | 'FWD' | '4WD' // FIXME 4WD car won't brake
  wheelOptions: WheelOptions[]
  mpsToRpmFactor?: number
  engine: {
    minRpm: number
    maxRpm: number
    torques: { rpm: number; torque: number }[]
    maxRpmIncreasePerSecond: number
    maxRpmDecreasePerSecond: number
  }
  transmission: {
    isAuto: boolean
    reverseGearRatio: number
    gearRatios: number[]
    drivelineEfficiency: number
    finalDriveRatio: number // differential
    upShifts: number[]
  }
  suspension: SuspensionOptions
}
```

## Gg3dRaycastVehicleEntity (class)

**Signature**

```ts
export declare class Gg3dRaycastVehicleEntity {
  constructor(
    public readonly carProperties: CarProperties,
    public readonly chassis3D: IGg3dObject | null,
    public readonly chassisBody: IGg3dRaycastVehicle,
    public readonly wheelObject: IGg3dObject | null = null,
    public readonly wheelObjectDirection: AxisDirection3 = 'x'
  )
}
```

### getSpeed (method)

**Signature**

```ts
public getSpeed(): number
```

### calculateRpmFromCarSpeed (method)

**Signature**

```ts
public calculateRpmFromCarSpeed(): number
```

### getDisplaySpeed (method)

**Signature**

```ts
public getDisplaySpeed(units: 'ms' | 'kmh' | 'mph' = 'ms'): number
```

### getMaxStableSteerVal (method)

**Signature**

```ts
private getMaxStableSteerVal(): number
```

### setTailLightsOn (method)

**Signature**

```ts
protected setTailLightsOn(value: boolean)
```

### setSteeringValue (method)

**Signature**

```ts
protected setSteeringValue(value: number)
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld)
```

### runTransformBinding (method)

**Signature**

```ts
protected runTransformBinding(objectBody: IGg3dBody, object3D: IGg3dObject): void
```

### updateEngine (method)

**Signature**

```ts
private updateEngine(delta: number)
```

### resetTo (method)

**Signature**

```ts
resetTo(options: { position?: Point3; rotation?: Point4 } = {})
```

### setXAxisControlValue (method)

**Signature**

```ts
public setXAxisControlValue(value: number)
```

### setYAxisControlValue (method)

**Signature**

```ts
public setYAxisControlValue(value: number)
```

### frontWheelsIndices (property)

**Signature**

```ts
readonly frontWheelsIndices: number[]
```

### tractionWheelIndices (property)

**Signature**

```ts
readonly tractionWheelIndices: number[]
```

### tractionWheelRadius (property)

**Signature**

```ts
readonly tractionWheelRadius: number
```

### \_rpm$ (property)

**Signature**

```ts
readonly _rpm$: any
```

### \_acceleration$ (property)

**Signature**

```ts
_acceleration$: any
```

### brake$ (property)

**Signature**

```ts
brake$: any
```

## SuspensionOptions (type alias)

**Signature**

```ts
export type SuspensionOptions = {
  stiffness: number
  damping: number
  compression: number
  restLength: number
}
```

## WheelOptions (type alias)

**Signature**

```ts
export type WheelOptions = {
  tyre_width: number
  tyre_radius: number
  wheelObject?: IGg3dObject
  wheelObjectDirection?: AxisDirection3
  isLeft: boolean
  isFront: boolean
  position: Point3
  frictionSlip: number // friction with road
  rollInfluence: number
  maxTravel: number
}
```