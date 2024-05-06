---
title: core/3d/entities/gg-car/gg-car.entity.ts
nav_order: 43
parent: Modules
---

## gg-car.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgCarEntity (class)](#ggcarentity-class)
    - [calculateRpmFromCarSpeed (method)](#calculaterpmfromcarspeed-method)
    - [setTailLightsOn (method)](#settaillightson-method)
    - [createRaycastVehicle (method)](#createraycastvehicle-method)
    - [onSpawned (method)](#onspawned-method)
    - [updateEngine (method)](#updateengine-method)
    - [resetTo (method)](#resetto-method)
    - [tickOrder (property)](#tickorder-property)
    - [\_rpm$ (property)](#_rpm-property)
    - [\_acceleration$ (property)](#_acceleration-property)
    - [\_brake$ (property)](#_brake-property)
    - [handBrake$ (property)](#handbrake-property)
    - [raycastVehicle (property)](#raycastvehicle-property)
  - [GgCarProperties (type alias)](#ggcarproperties-type-alias)

---

# utils

## GgCarEntity (class)

**Signature**

```ts
export declare class GgCarEntity<VTypeDoc, PTypeDoc, RVEntity> {
  constructor(
    public readonly carProperties: GgCarProperties,
    chassis3D: VTypeDoc['displayObject'] | null,
    chassisBody: PTypeDoc['raycastVehicle']
  )
}
```

### calculateRpmFromCarSpeed (method)

**Signature**

```ts
public calculateRpmFromCarSpeed(): number
```

### setTailLightsOn (method)

**Signature**

```ts
protected setTailLightsOn(value: boolean)
```

### createRaycastVehicle (method)

**Signature**

```ts
protected createRaycastVehicle(
    carProperties: GgCarProperties,
    chassis3D: VTypeDoc['displayObject'] | null,
    chassisBody: PTypeDoc['raycastVehicle'],
  ): RVEntity
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld<VTypeDoc, PTypeDoc>)
```

### updateEngine (method)

**Signature**

```ts
protected updateEngine(delta: number)
```

### resetTo (method)

**Signature**

```ts
public resetTo(
    options: {
      position?: Point3;
      rotation?: Point4;
    } = {},
  )
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
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

### \_brake$ (property)

**Signature**

```ts
_brake$: any
```

### handBrake$ (property)

**Signature**

```ts
handBrake$: any
```

### raycastVehicle (property)

**Signature**

```ts
readonly raycastVehicle: RVEntity
```

## GgCarProperties (type alias)

**Signature**

```ts
export type GgCarProperties = RVEntityProperties & {
  mpsToRpmFactor?: number
  engine: {
    minRpm: number
    maxRpm: number
    torques: {
      rpm: number
      torque: number
    }[]
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
    autoHold: boolean
  }
  maxSteerAngle: number
}
```
