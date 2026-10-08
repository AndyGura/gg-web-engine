---
title: core/3d/entities/gg-car/gg-car.entity.ts
nav_order: 77
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
    - [serializeSettings (method)](#serializesettings-method)
    - [serializeWheelFields (method)](#serializewheelfields-method)
    - [resetTo (method)](#resetto-method)
    - [captureNetworkState (method)](#capturenetworkstate-method)
    - [applyNetworkState (method)](#applynetworkstate-method)
    - [captureLocalInput (method)](#capturelocalinput-method)
    - [applyRemoteInput (method)](#applyremoteinput-method)
    - [tickOrder (property)](#tickorder-property)
    - [\_rpm$ (property)](#_rpm-property)
    - [\_acceleration$ (property)](#_acceleration-property)
    - [\_brake$ (property)](#_brake-property)
    - [handBrake$ (property)](#handbrake-property)
    - [autoShiftEnabled (property)](#autoshiftenabled-property)
    - [raycastVehicle (property)](#raycastvehicle-property)
  - [GgCarInput (interface)](#ggcarinput-interface)
  - [GgCarNetState (type alias)](#ggcarnetstate-type-alias)
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

### serializeSettings (method)

`ISerializableEntity` implementation: returns `GgCar3DSettings`-shaped `config` - both the
construction-time tuning `carProperties` already holds (`engine`/`brake`/`transmission`/
`suspension`/`tractionBias`/`maxSteerAngle`/`mpsToRpmFactor`, plus `wheelBase`/`wheelOptions`
geometry) and what it doesn't: chassis `dimensions`/`material`/`body`, recovered from the live
chassis rigid body/mesh the same way `Gg3dLevelLoader`'s `"Primitive"` live serializer recovers
a primitive's own (see `IMaterialReadable3dComponent`) - plus a `state` block capturing this
car's current runtime-mutated driving state (`gear`/`acceleration`/`brake`/`handBrake`/
`steeringFactor`), none of which a spawn-time `config` alone could ever reflect, since all five
change continuously as the car is driven. `Gg3dLevelLoader.createGgCar` applies `state` back
onto a freshly-built car if present, after construction - see that method's own doc.

Wheel/chassis `display`/`material` recovery only works for a mesh built via
`IDisplayObject3dComponentFactory.createPrimitive` (or a shortcut built on it) - see
`IMaterialReadable3dComponent`'s own doc; a chassis/wheel with no visual mesh at all
(`chassis3D`/a wheel's `displayObject` unset) simply omits `material`/`display`, same as
building one without `display`/`material` in the first place. `wheelObjectDirection`
round-trips exactly (already plain data on `RVEntitySharedWheelOptions.display`);
`autoScaleMesh` doesn't, since `Gg3dLevelLoader.resolveWheelDisplay` never sets it either.

**Signature**

```ts
public serializeSettings(): { config: Record<string, any> }
```

### serializeWheelFields (method)

Strips a wheel/axle settings object's live `display.displayObject` down to a JSON-safe
`{ material?, wheelObjectDirection? }` - see {@link serializeSettings}'s own doc for the
capability this depends on.

**Signature**

```ts
private serializeWheelFields<T extends { display?: WheelDisplayOptions }>(
    wheel: T,
  ): Omit<T, 'display'> & {
    display?: { material?: DisplayObject3dOpts<any>; wheelObjectDirection?: AxisDirection3 };
  }
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

### captureNetworkState (method)

`INetworkSyncable`: chassis snapshot plus driving state - see `GgCarNetState`.

**Signature**

```ts
public captureNetworkState(): GgCarNetState
```

### applyNetworkState (method)

`INetworkSyncable`: correct the chassis toward the owner's snapshot (see `RigidBodyCorrection`)
and adopt its driving state - unless remote input drives this car, which already carries the
same values (see `applyRemoteInput`). A snap also resets the suspension, so the wheels don't
spring from the old pose.

**Signature**

```ts
public applyNetworkState(target: GgCarNetState, ctx: NetworkApplyContext): CorrectionOutcome
```

### captureLocalInput (method)

`INetworkInputDriven`: what the local input driver set on this car. Ends any remote-input suspension of auto-shift.

**Signature**

```ts
public captureLocalInput(): GgCarInput
```

### applyRemoteInput (method)

`INetworkInputDriven`: drive this replica with the possessor's input. `null` is neutral:
throttle 0, steering 0, full brake, neutral gear, handbrake off. Auto-shift stays suspended
while non-null input arrives, since the gear comes from the possessor.

**Signature**

```ts
public applyRemoteInput(input: GgCarInput | null): void
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

### autoShiftEnabled (property)

Whether an automatic transmission (`carProperties.transmission.isAuto`) shifts gears by itself.
Default `true`. While `false` the auto-shift logic doesn't run and `gear` only ever changes from
outside. Also suspended automatically while the car is driven by remote input (a networked
replica takes its gear from the possessor's input instead of shifting on its own).

**Signature**

```ts
autoShiftEnabled: boolean
```

### raycastVehicle (property)

**Signature**

```ts
readonly raycastVehicle: RVEntity
```

## GgCarInput (interface)

Input a possessing peer forwards for a `GgCarEntity` - see `INetworkInputDriven`.

**Signature**

```ts
export interface GgCarInput {
  steeringFactor: number
  acceleration: number
  brake: number
  gear: number
  handBrake: boolean
}
```

## GgCarNetState (type alias)

Networked state of a `GgCarEntity`: the chassis rigid-body snapshot plus its driving state, which
a replica adopts only while no remote input drives it (a Free car keeps its owner's controls).
Engine RPM is deliberately absent - it's derived locally from speed and gear on every peer.

**Signature**

```ts
export type GgCarNetState = RigidBodyNetState<Point3, Point4> & {
  gear: number
  steering: number
  accel: number
  brake: number
  handBrake: boolean
}
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
  /**
   * Brake forces, in Newtons per wheel (see `IRaycastVehicleComponent.applyBrake`): the pedal
   * (`GgCarEntity.brake`, 0..1) scales `frontAxleForce` on each front wheel and `rearAxleForce` on
   * each rear wheel, the handbrake applies `handbrakeForce` to each rear wheel. Until tyre grip
   * runs out, the car decelerates by the sum of all wheels' forces divided by its mass, e.g. 1 g
   * with a 60% front share for a car of mass `m`: `frontAxleForce = 0.6 * m * 9.82 / 2`,
   * `rearAxleForce = 0.4 * m * 9.82 / 2`.
   */
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
