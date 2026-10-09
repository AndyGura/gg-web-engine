---
title: rapier3d/components/rapier-3d-rigid-body.component.ts
nav_order: 205
parent: Modules
---

## rapier-3d-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dRigidBodyComponent (class)](#rapier3drigidbodycomponent-class)
    - [applyForce (method)](#applyforce-method)
    - [applyImpulse (method)](#applyimpulse-method)
    - [applyTorque (method)](#applytorque-method)
    - [applyTorqueImpulse (method)](#applytorqueimpulse-method)
    - [notifyCollisionStart (method)](#notifycollisionstart-method)
    - [notifyCollisionEnd (method)](#notifycollisionend-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [applyMassProperties (method)](#applymassproperties-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [resetMotion (method)](#resetmotion-method)
    - [wakeUp (method)](#wakeup-method)
    - [sleep (method)](#sleep-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [\_nativeBody (property)](#_nativebody-property)
    - [\_nativeBodyColliders (property)](#_nativebodycolliders-property)
    - [name (property)](#name-property)
    - [collidingWith (property)](#collidingwith-property)
    - [onCollisionStart$ (property)](#oncollisionstart-property)
    - [onCollisionEnd$ (property)](#oncollisionend-property)
    - [collisionGroups (property)](#collisiongroups-property)

---

# utils

## Rapier3dRigidBodyComponent (class)

**Signature**

```ts
export declare class Rapier3dRigidBodyComponent {
  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape3DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body3DOptions, 'bodyType'>, 'mass'>
  )
}
```

### applyForce (method)

Rapier keeps an added force until `resetForces` - `Rapier3dWorldComponent.simulate()` resets
every body registered in its `forcedBodies` after the last substep of the call, which gives
`IRigidBodyComponent.applyForce` its "next `simulate()` call only" lifetime across all of that
call's substeps.

**Signature**

```ts
applyForce(force: Point3, worldPoint?: Point3): void
```

### applyImpulse (method)

**Signature**

```ts
applyImpulse(impulse: Point3, worldPoint?: Point3): void
```

### applyTorque (method)

**Signature**

```ts
applyTorque(torque: Point3): void
```

### applyTorqueImpulse (method)

**Signature**

```ts
applyTorqueImpulse(torqueImpulse: Point3): void
```

### notifyCollisionStart (method)

Called by `Rapier3dWorldComponent`'s centralized collision-event dispatch (see
`Rapier3dWorldComponent.simulate`) - not meant to be called by app code directly. Kept `public`
(rather than some cross-class-accessible `protected`) purely because the dispatching class isn't
a subclass of this one; there's nothing else in this package it's meant to be called from.

**Signature**

```ts
public notifyCollisionStart(event: CollisionEvent<Point3, Rapier3dRigidBodyComponent>): void
```

### notifyCollisionEnd (method)

See `notifyCollisionStart`'s doc. `otherBody: null` signals the partner was removed from the
world while still in contact, per `onCollisionEnd`'s doc.

**Signature**

```ts
public notifyCollisionEnd(otherBody: Rapier3dRigidBodyComponent | null): void
```

### clone (method)

**Signature**

```ts
clone(): Rapier3dRigidBodyComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Rapier3dGgWorld): void
```

### applyMassProperties (method)

Places a dynamic body's centre of mass at its origin, as `BodyOptions.mass` documents it for 3D
(Bullet's compound shape does this natively). Rapier derives the centre of
mass from the colliders instead, which for a compound shape (a car chassis built from a few
boxes) lands wherever the boxes average out - often far above the wheels. The total mass is
spread over the colliders by volume (uniform density), the resulting inertia is moved to the
origin (parallel-axis theorem), and the body carries it as its own mass properties with
massless colliders.

**Signature**

```ts
private applyMassProperties(body: RigidBody, colliders: Collider[]): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean): void
```

### resetMotion (method)

**Signature**

```ts
resetMotion(): void
```

### wakeUp (method)

**Signature**

```ts
wakeUp(): void
```

### sleep (method)

**Signature**

```ts
sleep(): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### entity (property)

**Signature**

```ts
entity: Entity3d<Gg3dWorldTypeDocRepo> | null
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: DebugBody3DSettings
```

### \_nativeBody (property)

**Signature**

```ts
_nativeBody: RigidBody | null
```

### \_nativeBodyColliders (property)

**Signature**

```ts
_nativeBodyColliders: Collider[] | null
```

### name (property)

**Signature**

```ts
name: string
```

### collidingWith (property)

Other rigid-body components this one is currently touching via a real (non-sensor) contact -
mirrors `Rapier3dTriggerComponent.overlaps`, but symmetric: both sides of an ordinary collision
get notified, so both sides track it. Populated/drained by `Rapier3dWorldComponent`'s centralized
collision-event dispatch (see `notifyCollisionStart`/`notifyCollisionEnd` below), and consulted by
`removeFromWorld` to emit `onCollisionEnd(null)` to any partner still touching this body at the
moment it's removed (per `CollisionEvent`'s "null when the other body was removed from the world
while still in contact" convention) - Rapier does not reliably emit a native collision-stop event
for a collider that's simply deleted mid-contact (same reason `Rapier3dTriggerComponent.
checkOverlaps` has its own manual `!body.nativeBody` cleanup pass instead of trusting the event
queue for that case).

**Signature**

```ts
readonly collidingWith: Set<Rapier3dRigidBodyComponent>
```

### onCollisionStart$ (property)

**Signature**

```ts
readonly onCollisionStart$: any
```

### onCollisionEnd$ (property)

**Signature**

```ts
readonly onCollisionEnd$: any
```

### collisionGroups (property)

**Signature**

```ts
collisionGroups: number
```
