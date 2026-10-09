---
title: ammo/components/ammo-raycast-vehicle.component.ts
nav_order: 7
parent: Modules
---

## ammo-raycast-vehicle.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoRaycastVehicleComponent (class)](#ammoraycastvehiclecomponent-class)
    - [refreshCG (method)](#refreshcg-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [addWheel (method)](#addwheel-method)
    - [setWheelFrictionSlip (method)](#setwheelfrictionslip-method)
    - [getWheelFrictionSlip (method)](#getwheelfrictionslip-method)
    - [setSteering (method)](#setsteering-method)
    - [applyEngineForce (method)](#applyengineforce-method)
    - [applyBrake (method)](#applybrake-method)
    - [applyBrakeImpulses (method)](#applybrakeimpulses-method)
    - [isWheelTouchesGround (method)](#iswheeltouchesground-method)
    - [getWheelTransform (method)](#getwheeltransform-method)
    - [resetSuspension (method)](#resetsuspension-method)
    - [clone (method)](#clone-method)
    - [resetMotion (method)](#resetmotion-method)
    - [nativeVehicle (property)](#nativevehicle-property)
    - [vehicleTuning (property)](#vehicletuning-property)
    - [wheelDirectionCS0 (property)](#wheeldirectioncs0-property)
    - [wheelAxleCS (property)](#wheelaxlecs-property)
    - [entity (property)](#entity-property)
    - [raycaster (property)](#raycaster-property)
    - [brakeForces (property)](#brakeforces-property)

---

# utils

## AmmoRaycastVehicleComponent (class)

**Signature**

```ts
export declare class AmmoRaycastVehicleComponent {
  constructor(protected readonly world: AmmoWorldComponent, public chassisBody: AmmoRigidBodyComponent)
}
```

### refreshCG (method)

**Signature**

```ts
refreshCG()
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: AmmoGgWorld)
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: AmmoGgWorld, dispose?: boolean)
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### addWheel (method)

**Signature**

```ts
addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void
```

### setWheelFrictionSlip (method)

**Signature**

```ts
setWheelFrictionSlip(wheelIndex: number, frictionSlip: number): void
```

### getWheelFrictionSlip (method)

**Signature**

```ts
getWheelFrictionSlip(wheelIndex: number): number
```

### setSteering (method)

**Signature**

```ts
setSteering(wheelIndex: number, steering: number): void
```

### applyEngineForce (method)

**Signature**

```ts
applyEngineForce(wheelIndex: number, force: number): void
```

### applyBrake (method)

Stores the brake force (Newtons); `AmmoWorldComponent.simulate()` hands it to Bullet before
every step - see `applyBrakeImpulses()`.

**Signature**

```ts
applyBrake(wheelIndex: number, force: number): void
```

### applyBrakeImpulses (method)

Converts every wheel's brake force into what Bullet's `setBrake` takes: the maximum impulse
the wheel's braking may apply in one internal substep (`btRaycastVehicle::updateFriction`
clamps the wheel's rolling impulse to `m_brake`), i.e. `force × substep length`. Passing the
force through unconverted brakes harder the shorter the substeps are, which is the case at a
higher frame rate (`AmmoWorldComponent.simulate()` splits each frame into substeps of 5-10 ms
depending on the frame's length): a 1.5 t car braked at 3.4 g at 50 FPS and 5 g at 144 FPS
with the same values. Called by `AmmoWorldComponent.simulate()` right before
`stepSimulation`, whose substeps all have exactly `subStepLength` seconds.

**Signature**

```ts
applyBrakeImpulses(subStepLength: number): void
```

### isWheelTouchesGround (method)

**Signature**

```ts
isWheelTouchesGround(wheelIndex: number): boolean
```

### getWheelTransform (method)

**Signature**

```ts
getWheelTransform(wheelIndex: number): { position: Point3; rotation: Point4 }
```

### resetSuspension (method)

**Signature**

```ts
resetSuspension(): void
```

### clone (method)

**Signature**

```ts
public clone(): AmmoRaycastVehicleComponent
```

### resetMotion (method)

**Signature**

```ts
resetMotion()
```

### nativeVehicle (property)

**Signature**

```ts
readonly nativeVehicle: Ammo.btRaycastVehicle
```

### vehicleTuning (property)

**Signature**

```ts
readonly vehicleTuning: Ammo.btVehicleTuning
```

### wheelDirectionCS0 (property)

**Signature**

```ts
readonly wheelDirectionCS0: Ammo.btVector3
```

### wheelAxleCS (property)

**Signature**

```ts
readonly wheelAxleCS: Ammo.btVector3
```

### entity (property)

**Signature**

```ts
entity: RaycastVehicle3dEntity<Gg3dWorldTypeDocRepo> | null
```

### raycaster (property)

**Signature**

```ts
readonly raycaster: Ammo.btDefaultVehicleRaycaster
```

### brakeForces (property)

Brake force of every wheel, in Newtons - see `applyBrake()`.

**Signature**

```ts
readonly brakeForces: number[]
```
