---
title: core/3d/entities/raycast-vehicle-3d.entity.ts
nav_order: 46
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
    - [applyTractionForce (method)](#applytractionforce-method)
    - [applyBrake (method)](#applybrake-method)
    - [runTransformBinding (method)](#runtransformbinding-method)
    - [resetTo (method)](#resetto-method)
    - [wheels (property)](#wheels-property)
    - [wheelLocalRotation (property)](#wheellocalrotation-property)
    - [frontWheelsIndices (property)](#frontwheelsindices-property)
    - [rearWheelsIndices (property)](#rearwheelsindices-property)
    - [tractionWheelIndices (property)](#tractionwheelindices-property)
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
  typeOfDrive: 'RWD' | 'FWD' | '4WD'
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

**Signature**

```ts
export type RVEntitySharedWheelOptions = {
  tyreWidth?: number
  tyreRadius?: number
  frictionSlip?: number
  rollInfluence?: number
  maxTravel?: number
  display?: WheelDisplayOptions
}
```

## RaycastVehicle3dEntity (class)

**Signature**

```ts
export declare class RaycastVehicle3dEntity<VTypeDoc, PTypeDoc> {
  constructor(
    public readonly carProperties: RVEntityProperties,
    public readonly chassis3D: IDisplayObject3dComponent | null,
    public readonly chassisBody: IRaycastVehicleComponent
  )
}
```

### getSpeed (method)

**Signature**

```ts
public getSpeed(): number
```

### applyTractionForce (method)

**Signature**

```ts
public applyTractionForce(force: number)
```

### applyBrake (method)

**Signature**

```ts
public applyBrake(axle: 'front' | 'rear' | 'both', force: number)
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
readonly wheels: (Entity3d<VTypeDoc, PTypeDoc> | null)[]
```

### wheelLocalRotation (property)

**Signature**

```ts
readonly wheelLocalRotation: (Point4 | null)[]
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

## WheelDisplayOptions (type alias)

**Signature**

```ts
export type WheelDisplayOptions = {
  displayObject?: IDisplayObject3dComponent
  wheelObjectDirection?: AxisDirection3
  autoScaleMesh?: boolean
}
```
