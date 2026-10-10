---
title: core/3d/entities/gg-car/gg-car.entity.ts
nav_order: 80
parent: Modules
---

## gg-car.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [DEFAULT_AIR_DENSITY](#default_air_density)
  - [DEFAULT_BRAKING_FORCE_PER_RPM](#default_braking_force_per_rpm)
  - [DEFAULT_OVER_REV_BRAKE_FORCE](#default_over_rev_brake_force)
  - [GgCarEntity (class)](#ggcarentity-class)
    - [calculateRpmFromCarSpeed (method)](#calculaterpmfromcarspeed-method)
    - [engineBrakingForce (method)](#enginebrakingforce-method)
    - [setTailLightsOn (method)](#settaillightson-method)
    - [getMaxSteerAngle (method)](#getmaxsteerangle-method)
    - [createRaycastVehicle (method)](#createraycastvehicle-method)
    - [onSpawned (method)](#onspawned-method)
    - [selectAutoGear (method)](#selectautogear-method)
    - [computeDrive (method)](#computedrive-method)
    - [applyDrive (method)](#applydrive-method)
    - [applyResistance (method)](#applyresistance-method)
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

## DEFAULT_AIR_DENSITY

Default `GgCarProperties.aerodynamics.airDensity`, kg/m³ at sea level.

**Signature**

```ts
export declare const DEFAULT_AIR_DENSITY: 1.225
```

## DEFAULT_BRAKING_FORCE_PER_RPM

Default `GgCarProperties.engine.brakingForcePerRpm`: 1 N per rpm, for the whole car.

**Signature**

```ts
export declare const DEFAULT_BRAKING_FORCE_PER_RPM: 1
```

## DEFAULT_OVER_REV_BRAKE_FORCE

Default `GgCarProperties.engine.overRevBrakeForce`: 24 000 N for the whole car.

**Signature**

```ts
export declare const DEFAULT_OVER_REV_BRAKE_FORCE: 24000
```

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

### engineBrakingForce (method)

The force at the wheels, in Newtons for the whole car and signed along the car's forward
axis, from the engine being turned by the wheels with the throttle released, at the rpm
`calculatedRpm` the wheels would spin it at - negative in a forward gear while above idle. See
`GgCarProperties.engine.brakingTorquePer1000Rpm`/`brakingForcePerRpm` for the two models.

**Signature**

```ts
protected engineBrakingForce(calculatedRpm: number): number
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

### selectAutoGear (method)

The automatic transmission's choice of forward gear for the current engine rpm, given the
current forward gear (`gear > 0`): up while the rpm reaches the current gear's `upShifts`
entry (projecting the rpm into each next gear), otherwise down while the lower gear would
turn the engine at most its own `upShifts` entry less `downshiftMargin`. Override to
replace the shift logic; called every `AUTO_SHIFT_INTERVAL` ms of world time while the car
is on the ground, in a forward gear, not shifting, and not driven by remote input.

**Signature**

```ts
protected selectAutoGear(): number
```

### computeDrive (method)

This tick's drive force (Newtons for the whole car, signed along the car's forward axis) and
brake pedal (0..1) from the car's inputs and state, for `applyDrive`. Override to change how
the engine, the rev limiter, engine braking or `autoHold` turn into a force. Only called while
the car touches the ground.

**Signature**

```ts
protected computeDrive(): { force: number; brake: number }
```

### applyDrive (method)

Hands `computeDrive`'s result to the wheels: with the brake pedal released, `force` is split
between the axles by `tractionBias` and equally over each axle's wheels (so the whole car is
pushed by `force`, whatever its wheel count); with it pressed, the wheels brake with
`carProperties.brake`'s per-wheel forces instead. The handbrake then overrides the rear axle.

**Signature**

```ts
protected applyDrive(force: number, brake: number): void
```

### applyResistance (method)

Applies this tick's air drag (`carProperties.aerodynamics`) and rolling resistance
(`carProperties.rollingResistance`) to the chassis through `IRigidBodyComponent.applyForce`.
Both are off unless configured. Override to add other forces acting on the chassis each tick.

**Signature**

```ts
protected applyResistance(delta: number): void
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
spring from the old pose. The gear change in progress is adopted as the owner has it
(`shiftMs`), not restarted by the replica's own `gear` setter, so the replica's engine
reconnects when the owner's does.

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
while non-null input arrives, since the gear comes from the possessor. A gear change in the
input starts the same `shiftTime` gear change here as on the possessor, through the `gear`
setter, so both engines reconnect after the same world time.

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
  /** Milliseconds left of a gear change in progress (`GgCarEntity.isShifting`), `0` when none. */
  shiftMs: number
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
    /**
     * Rev limiter. Whenever the wheels would spin the engine past `maxRpm` the throttle is cut, and
     * this braking force (Newtons, for the whole car - see `GgCarEntity.tractionForce` for how a
     * car's drive force is split over its driven wheels) holds the car back, against its direction
     * of travel. Default {@link DEFAULT_OVER_REV_BRAKE_FORCE}. `0` makes the limiter a plain
     * throttle cut: above redline the car coasts under ordinary engine braking instead.
     */
    overRevBrakeForce?: number
    /**
     * Engine braking as an engine torque: N·m per 1000 rpm the engine turns above `minRpm`, with
     * the throttle released, multiplied through the drivetrain (gear ratio, final drive,
     * efficiencies, wheel radius) exactly like the drive torque - so a low gear brakes harder than
     * a high one at the same speed, as in a real car. Replaces {@link brakingForcePerRpm} when set.
     */
    brakingTorquePer1000Rpm?: number
    /**
     * Engine braking as a force at the wheels: Newtons per rpm of difference between `minRpm` and
     * the rpm the wheels would spin the engine at, for the whole car, with the throttle released.
     * Independent of the gear ratio, and below idle it turns into a push (an automatic's creep).
     * Default {@link DEFAULT_BRAKING_FORCE_PER_RPM}; ignored when `brakingTorquePer1000Rpm` is set.
     */
    brakingForcePerRpm?: number
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
    /**
     * Per forward gear, the engine rpm at which an automatic transmission shifts up out of that
     * gear (`upShifts[0]` leaves 1st gear). It also shifts down whenever the lower gear would turn
     * the engine no faster than that gear's own `upShifts` entry, less `downshiftMargin`.
     */
    upShifts: number[]
    /**
     * Rpm of hysteresis for an automatic's downshifts (default `0`): the lower gear is only
     * selected while the engine would turn at most `upShifts[lower] - downshiftMargin` in it.
     * Without a margin a car that has just shifted up, then slows a little, shifts straight back.
     */
    downshiftMargin?: number
    /**
     * How long a gear change takes, in milliseconds of world time (default `0`, instant). While
     * a shift is in progress (`GgCarEntity.isShifting`) the engine is disconnected: no drive force
     * and no engine braking reach the wheels, the throttle doesn't rev the engine, and an
     * automatic doesn't reconsider its gear. Every change of `gear` to a gear other than neutral
     * starts a shift, manual and automatic alike.
     */
    shiftTime?: number
    /**
     * Efficiency of each forward gear (`gearEfficiencies[0]` for 1st), a multiplier on the drive
     * torque on top of `drivelineEfficiency`. Missing entries (and reverse) count as `1`.
     */
    gearEfficiencies?: number[]
    autoHold: boolean
  }
  /**
   * Air drag, `½ · ρ · Cd · A · v²` against the chassis' velocity, applied through
   * `IRigidBodyComponent.applyForce` every tick, on the ground and in the air. Without it a car
   * is only ever held back by engine braking and the rev limiter, so its top speed is the redline
   * in top gear. `airDensity` (ρ) defaults to 1.225 kg/m³ (sea level); `dragCoefficient` (Cd) is
   * about 0.25-0.35 for a modern road car, `frontalArea` (A) about 2-2.5 m².
   */
  aerodynamics?: {
    dragCoefficient: number
    frontalArea: number
    airDensity?: number
  }
  /**
   * Rolling resistance coefficient (about 0.01-0.015 for car tyres on asphalt): a force of
   * `rollingResistance · m · g` against the chassis' motion whenever the wheels touch the ground,
   * never more than what stops the car within the tick. Applied through
   * `IRigidBodyComponent.applyForce`. Default `0`.
   */
  rollingResistance?: number
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
