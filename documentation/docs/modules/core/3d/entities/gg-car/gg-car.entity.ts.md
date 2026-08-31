---
title: core/3d/entities/gg-car/gg-car.entity.ts
nav_order: 47
parent: Modules
---

## gg-car.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgCarEntity (class)](#ggcarentity-class)
    - [calculateRpmFromCarSpeed (method)](#calculaterpmfromcarspeed-method)
    - [setTailLightsOn (method)](#settaillightson-method)
    - [getMaxSteerAngle (method)](#getmaxsteerangle-method)
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
export declare class GgCarEntity<TypeDoc, RVEntity> {
  constructor(
    public readonly carProperties: GgCarProperties,
    chassis3D: TypeDoc['vTypeDoc']['displayObject'] | null,
    chassisBody: TypeDoc['pTypeDoc']['raycastVehicle']
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

### getMaxSteerAngle (method)

Resolves the current effective max steering angle (radians) from `carProperties.maxSteerAngle`,
scaling down with speed when that's given as a breakpoint array - see its TSDoc.

**Signature**

```ts
protected getMaxSteerAngle(): number
```

### createRaycastVehicle (method)

**Signature**

```ts
protected createRaycastVehicle(
    carProperties: GgCarProperties,
    chassis3D: TypeDoc['vTypeDoc']['displayObject'] | null,
    chassisBody: TypeDoc['pTypeDoc']['raycastVehicle'],
  ): RVEntity
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld<TypeDoc>)
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
  /**
   * Max steering lock, in radians, applied at `steeringFactor` of ±1.
   *
   * - A plain `number` applies that angle at every speed (the original, unconditional behavior).
   * - An array of `{ atSpeedMs, angleRad }` breakpoints (speed in m/s, angle in radians) instead
   *   scales the max angle down as the car speeds up - full lock-to-lock steering at parking-lot
   *   speed will otherwise demand more lateral slip than a raycast vehicle's simplified friction
   *   model (`frictionSlip * wheelLoad`) can supply, causing the car to snap/spin rather than
   *   understeer. Breakpoints must be sorted ascending by `atSpeedMs`; the effective angle is
   *   linearly interpolated between the two straddling the current `|getSpeed()|`, clamped to the
   *   first entry's `angleRad` below the lowest speed and the last entry's `angleRad` at/above the
   *   highest. A validated shape for this: full angle below 5 m/s, linearly tapering to 30% of
   *   that by 30 m/s, flat beyond - e.g.
   *   `[{ atSpeedMs: 5, angleRad: 0.2 }, { atSpeedMs: 30, angleRad: 0.06 }]`.
   */
  maxSteerAngle: number | { atSpeedMs: number; angleRad: number }[]
}
```
