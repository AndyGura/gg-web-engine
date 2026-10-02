---
title: rapier3d/components/rapier-3d-raycast-vehicle.component.ts
nav_order: 174
parent: Modules
---

## rapier-3d-raycast-vehicle.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dRaycastVehicleComponent (class)](#rapier3draycastvehiclecomponent-class)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [stepVehicleController (method)](#stepvehiclecontroller-method)
    - [attachWheel (method)](#attachwheel-method)
    - [addWheel (method)](#addwheel-method)
    - [setSteering (method)](#setsteering-method)
    - [applyEngineForce (method)](#applyengineforce-method)
    - [applyBrake (method)](#applybrake-method)
    - [isWheelTouchesGround (method)](#iswheeltouchesground-method)
    - [getWheelTransform (method)](#getwheeltransform-method)
    - [resetSuspension (method)](#resetsuspension-method)
    - [clone (method)](#clone-method)
    - [resetMotion (method)](#resetmotion-method)
    - [\_nativeVehicle (property)](#_nativevehicle-property)

---

# utils

## Rapier3dRaycastVehicleComponent (class)

Rapier's `DynamicRayCastVehicleController` (`world.createVehicleController`) is a thin wrapper
around wheel raycasting only - nothing steps it automatically as part of `World.step()`.
Instead, `updateVehicle(dt, ...)` must be called once per tick _before_ `world.step()` - it directly writes the chassis's own
`linvel`/`angvel` from that tick's suspension/engine/brake forces, which `world.step()` then
integrates like any other dynamic body's velocity. This component registers itself into
`Rapier3dWorldComponent.raycastVehicles` on `addToWorld`/`removeFromWorld` so the world component
can drive that call centrally from `simulate()` - see that class's doc.

Like `Rapier3dCharacterControllerComponent`/`Rapier3dTriggerComponent`, this class and
`Rapier3dWorldComponent` import each other (the world needs this class purely as a type for its
`raycastVehicles` set, the vehicle needs the world's concrete type for its constructor/`addToWorld`
parameter) - this circular import is an established, safe pattern in this package (see those two
classes), not specific to this one.

**Signature**

```ts
export declare class Rapier3dRaycastVehicleComponent {
  constructor(protected readonly world: Rapier3dWorldComponent, private chassisBody: Rapier3dRigidBodyComponent)
}
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Rapier3dGgWorld)
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean)
```

### stepVehicleController (method)

Called once per `simulate()` tick by `Rapier3dWorldComponent`, _before_ `World.step()` - see
this class's own doc for why. `filterGroups` threads this vehicle's own collision groups
(`this.collisionGroups`, inherited from `Rapier3dRigidBodyComponent` and already packed in the
`InteractionGroups` layout Rapier expects) into the wheels' own suspension raycasts, so a
vehicle in one collision group doesn't get held up by suspension force from a floor it isn't
meant to interact with - without this, only the chassis's own broadphase collision would
respect collision groups, not the ray-cast-based wheel/ground detection (see
`gg-engine-physics-adapter`'s testing guidance on this). `EXCLUDE_SENSORS` keeps a `Trigger`'s
sensor volume from ever acting as solid ground for a wheel, mirroring
`Rapier3dCharacterControllerComponent.move()`'s identical guard.

**Signature**

```ts
public stepVehicleController(dt: number): void
```

### attachWheel (method)

**Signature**

```ts
private attachWheel(nativeVehicle: DynamicRayCastVehicleController, wheel: WheelEntry): void
```

### addWheel (method)

**Signature**

```ts
addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void
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

**Signature**

```ts
applyBrake(wheelIndex: number, force: number): void
```

### isWheelTouchesGround (method)

**Signature**

```ts
isWheelTouchesGround(wheelIndex: number): boolean
```

### getWheelTransform (method)

Rapier's controller exposes no single call that bakes suspension travel, steering and roll into
one transform for rendering - only the individual pieces
(`wheelHardPoint`/`wheelSuspensionLength`/`wheelDirectionCs`/`wheelAxleCs`/`wheelSteering`/
`wheelRotation`), which this method composes by hand:

- **Position**: `wheelHardPoint` is already world-space (the ray-cast's own start point, fixed
  relative to the chassis) - moving it `wheelSuspensionLength` further along the _world-space_
  suspension direction (`wheelDirectionCs` rotated by the chassis's current rotation) lands
  exactly on the wheel's current (compressed-by-however-much) center, airborne or grounded alike.
- **Rotation**: composed as chassis rotation ∘ steering (about the chassis's local up axis,
  `Pnt3.Z` - only ever nonzero for wheels `RaycastVehicle3dEntity` actually steers) ∘ roll (about
  this wheel's own configured local axle, `wheelRotation`'s accumulated spin angle). This is a
  best-effort reconstruction, not something read back verbatim from the native engine - document
  as a known limitation rather than chasing exactness, same spirit as
  `Rapier3dCharacterControllerComponent`'s ground-normal approximation.

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
public clone(): Rapier3dRaycastVehicleComponent
```

### resetMotion (method)

**Signature**

```ts
resetMotion()
```

### \_nativeVehicle (property)

**Signature**

```ts
_nativeVehicle: DynamicRayCastVehicleController | null
```
