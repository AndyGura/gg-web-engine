---
title: core/3d/components/physics/i-raycast-vehicle.component.ts
nav_order: 52
parent: Modules
---

## i-raycast-vehicle.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRaycastVehicleComponent (interface)](#iraycastvehiclecomponent-interface)
  - [SuspensionOptions (type alias)](#suspensionoptions-type-alias)
  - [WheelOptions (type alias)](#wheeloptions-type-alias)
  - [defaultMaxSuspensionForce](#defaultmaxsuspensionforce)

---

# utils

## IRaycastVehicleComponent (interface)

**Signature**

```ts
export interface IRaycastVehicleComponent<
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
> extends IRigidBody3dComponent<PTypeDoc> {
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
  isLeft: boolean
  isFront: boolean
  tyreWidth: number
  tyreRadius: number
  position: Point3
  /**
   * Tyre friction coefficient with the road (μ): the most sideways force a wheel holds is about
   * `frictionSlip` × the load on that wheel, so on flat ground the car corners at up to about
   * `frictionSlip` g before sliding. Street tyres are around 1.0-1.2; values far above that make
   * the car stick to the road like a train on rails.
   */
  frictionSlip: number
  /**
   * Bullet's roll influence: the share (0..1) of the wheel's sideways force applied at the contact
   * point rather than at the chassis' centre of mass, so lower values make the car lean and roll
   * over less in a turn. Physics engines without this knob (Rapier) ignore it.
   */
  rollInfluence: number
  /**
   * Multiplier on the tyre's sideways grip (default 1): below 1 the car slides out of turns
   * earlier, above 1 it holds the line harder. Physics engines without this knob (Ammo, whose side
   * grip follows `frictionSlip` alone) ignore it.
   */
  sideFrictionStiffness?: number
  /**
   * How far the wheel can move up from its rest position, in meters (from `restLength` toward
   * the connection point `position`). A value above `SuspensionOptions.restLength` lets the wheel
   * center rise above its connection point, into the car body.
   */
  maxTravel: number
  /**
   * The most force one wheel's suspension can push the chassis with, in Newtons. Beyond it the
   * spring stops getting stiffer, the suspension compresses to its travel limit, and the chassis
   * box hits the road. Defaults to {@link defaultMaxSuspensionForce} of the chassis mass.
   */
  maxSuspensionForce?: number
}
```

## defaultMaxSuspensionForce

Default `WheelOptions.maxSuspensionForce` for a chassis of `chassisMass` kg: twice the full car
weight per wheel (2 × mass × 9.82 N), so it never limits a car on its wheels - braking,
cornering, dips and landings stay far below it - and only clamps a pathological spike. Physics
engines' own default of 6000 N per wheel holds a 1.5 t car only up to ~1.6 g.

**Signature**

```ts
export declare const defaultMaxSuspensionForce: (chassisMass: number) => number
```
