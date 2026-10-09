---
title: core/3d/entities/raycast-vehicle-3d.entity.ts
nav_order: 82
parent: Modules
---

## raycast-vehicle-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [RVEntityAxleOptions (type alias)](#rventityaxleoptions-type-alias)
  - [RVEntityProperties (type alias)](#rventityproperties-type-alias)
  - [RVEntitySharedWheelOptions (type alias)](#rventitysharedwheeloptions-type-alias)
  - [RaycastVehicle3dEntity (class)](#raycastvehicle3dentity-class)
    - [getSpeed (method)](#getspeed-method)
    - [applyTraction (method)](#applytraction-method)
    - [applyBrake (method)](#applybrake-method)
    - [setFrictionSlip (method)](#setfrictionslip-method)
    - [wheelCount (method)](#wheelcount-method)
    - [runTransformBinding (method)](#runtransformbinding-method)
    - [resetTo (method)](#resetto-method)
    - [wheels (property)](#wheels-property)
    - [wheelLocalRotation (property)](#wheellocalrotation-property)
    - [frontWheelsIndices (property)](#frontwheelsindices-property)
    - [rearWheelsIndices (property)](#rearwheelsindices-property)
    - [tractionWheelRadius (property)](#tractionwheelradius-property)
  - [WheelDisplayOptions (type alias)](#wheeldisplayoptions-type-alias)

---

# utils

## RVEntityAxleOptions (type alias)

**Signature**

```ts
export type RVEntityAxleOptions = {
  halfAxleWidth: number
  axlePosition: number
  axleHeight: number
} & RVEntitySharedWheelOptions
```

## RVEntityProperties (type alias)

**Signature**

```ts
export type RVEntityProperties = {
  tractionBias: RVEntityTractionBias | number
  suspension: SuspensionOptions
} & (
  | {
      wheelBase: {
        shared: RVEntitySharedWheelOptions
        front: RVEntityAxleOptions
        rear: RVEntityAxleOptions
      }
    }
  | {
      wheelOptions: (RVEntitySharedWheelOptions & {
        isLeft: boolean
        isFront: boolean
        position: Point3
      })[]
      sharedWheelOptions?: RVEntitySharedWheelOptions
    }
)
```

## RVEntitySharedWheelOptions (type alias)

Wheel settings shared by several wheels. Anything left out takes the default: `tyreWidth` 0.3,
`tyreRadius` 0.4, `frictionSlip` 1.2 (street tyres - see `WheelOptions.frictionSlip`),
`rollInfluence` 0.2, `sideFrictionStiffness` 1, `maxTravel` equal to `suspension.restLength` (the wheel compresses at most
up to its connection point), `maxSuspensionForce` per `defaultMaxSuspensionForce`.

**Signature**

```ts
export type RVEntitySharedWheelOptions = {
  tyreWidth?: number
  tyreRadius?: number
  frictionSlip?: number
  rollInfluence?: number
  sideFrictionStiffness?: number
  maxTravel?: number
  maxSuspensionForce?: number
  display?: WheelDisplayOptions
}
```

## RaycastVehicle3dEntity (class)

**Signature**

```ts
export declare class RaycastVehicle3dEntity<TypeDoc> {
  constructor(
    public readonly carProperties: RVEntityProperties,
    public readonly chassis3D: IDisplayObject3dComponent | null,
    public readonly vehicleComponent: IRaycastVehicleComponent
  )
}
```

### getSpeed (method)

**Signature**

```ts
public getSpeed(): number
```

### applyTraction (method)

Sets the engine force of every wheel of `axle`, in Newtons per wheel - see `IRaycastVehicleComponent.applyEngineForce`.

**Signature**

```ts
public applyTraction(axle: 'front' | 'rear' | 'both', force: number)
```

### applyBrake (method)

Sets the brake force of every wheel of `axle`, in Newtons per wheel - see `IRaycastVehicleComponent.applyBrake`.

**Signature**

```ts
public applyBrake(axle: 'front' | 'rear' | 'both', force: number)
```

### setFrictionSlip (method)

Sets the tyre friction coefficient of every wheel of `axle` - see
`IRaycastVehicleComponent.setWheelFrictionSlip`. Lets a handbrake or a surface change retune
grip without touching the physics backend.

**Signature**

```ts
public setFrictionSlip(axle: 'front' | 'rear' | 'both', frictionSlip: number)
```

### wheelCount (method)

How many wheels `axle` has (`'both'`: all wheels).

**Signature**

```ts
public wheelCount(axle: 'front' | 'rear' | 'both'): number
```

### runTransformBinding (method)

**Signature**

```ts
protected runTransformBinding(objectBody: IRigidBody3dComponent, object3D: IDisplayObject3dComponent): void
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

### wheels (property)

**Signature**

```ts
readonly wheels: (Entity3d<TypeDoc> | null)[]
```

### wheelLocalRotation (property)

**Signature**

```ts
readonly wheelLocalRotation: (Readonly<MutablePoint4> | null)[]
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

### tractionWheelRadius (property)

**Signature**

```ts
readonly tractionWheelRadius: number
```

## WheelDisplayOptions (type alias)

**Signature**

```ts
export type WheelDisplayOptions = {
  displayObject?: IDisplayObject3dComponent
  wheelObjectDirection?: AxisDirection3
  autoScaleMesh?: boolean
}
```
