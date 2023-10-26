---
title: core/3d/entities/raycast-vehicle-3d.entity.ts
nav_order: 43
parent: Modules
---

## raycast-vehicle-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CarProperties (type alias)](#carproperties-type-alias)
  - [RaycastVehicle3dEntity (class)](#raycastvehicle3dentity-class)
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
    - [wheels (property)](#wheels-property)
    - [wheelLocalRotation (property)](#wheellocalrotation-property)
    - [wheelLocalTranslation (property)](#wheellocaltranslation-property)
    - [frontWheelsIndices (property)](#frontwheelsindices-property)
    - [rearWheelsIndices (property)](#rearwheelsindices-property)
    - [tractionWheelIndices (property)](#tractionwheelindices-property)
    - [tractionWheelRadius (property)](#tractionwheelradius-property)
    - [\_rpm$ (property)](#_rpm-property)
    - [\_acceleration$ (property)](#_acceleration-property)
    - [brake$ (property)](#brake-property)
    - [handBrake$ (property)](#handbrake-property)

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
  brake: {
    frontAxleForce: number
    rearAxleForce: number
    handbrakeForce: number
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

## RaycastVehicle3dEntity (class)

**Signature**

```ts
export declare class RaycastVehicle3dEntity {
  constructor(
    public readonly carProperties: CarProperties,
    public readonly chassis3D: IDisplayObject3dComponent | null,
    public readonly chassisBody: IRaycastVehicleComponent,
    public readonly wheelObject: IDisplayObject3dComponent | null = null,
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
protected runTransformBinding(objectBody: IRigidBody3dComponent, object3D: IDisplayObject3dComponent): void
```

### updateEngine (method)

**Signature**

```ts
protected updateEngine(delta: number)
```

### resetTo (method)

**Signature**

```ts
public resetTo(options: { position?: Point3; rotation?: Point4 } = {})
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

### wheels (property)

**Signature**

```ts
readonly wheels: ((IEntity<any, any, IVisualSceneComponent<any, any>, IPhysicsWorldComponent<any, any>> & IPositionable3d) | null)[]
```

### wheelLocalRotation (property)

**Signature**

```ts
readonly wheelLocalRotation: (Point4 | null)[]
```

### wheelLocalTranslation (property)

**Signature**

```ts
readonly wheelLocalTranslation: Point3[]
```

### frontWheelsIndices (property)

**Signature**

```ts
readonly frontWheelsIndices: number[]
```

### rearWheelsIndices (property)

**Signature**

```ts
readonly rearWheelsIndices: number[]
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

### handBrake$ (property)

**Signature**

```ts
handBrake$: any
```
