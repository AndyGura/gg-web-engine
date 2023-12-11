---
title: core/3d/components/physics/i-raycast-vehicle.component.ts
nav_order: 28
parent: Modules
---

## i-raycast-vehicle.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRaycastVehicleComponent (interface)](#iraycastvehiclecomponent-interface)
  - [SuspensionOptions (type alias)](#suspensionoptions-type-alias)
  - [WheelOptions (type alias)](#wheeloptions-type-alias)

---

# utils

## IRaycastVehicleComponent (interface)

**Signature**

```ts
export interface IRaycastVehicleComponent<PW extends IPhysicsWorld3dComponent = IPhysicsWorld3dComponent>
  extends IRigidBody3dComponent<PW> {
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
  frictionSlip: number // friction with road
  rollInfluence: number
  maxTravel: number
}
```
