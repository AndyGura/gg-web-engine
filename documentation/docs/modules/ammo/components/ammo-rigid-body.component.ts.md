---
title: ammo/components/ammo-rigid-body.component.ts
nav_order: 8
parent: Modules
---

## ammo-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoRigidBodyComponent (class)](#ammorigidbodycomponent-class)
    - [applyWorldTransform (method)](#applyworldtransform-method)
    - [applyForce (method)](#applyforce-method)
    - [applyImpulse (method)](#applyimpulse-method)
    - [applyTorque (method)](#applytorque-method)
    - [applyTorqueImpulse (method)](#applytorqueimpulse-method)
    - [relativeToCenterOfMass (method)](#relativetocenterofmass-method)
    - [emitCollisionStart (method)](#emitcollisionstart-method)
    - [emitCollisionEnd (method)](#emitcollisionend-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [refreshCG (method)](#refreshcg-method)
    - [detachFromBroadphaseTemporarily (method)](#detachfrombroadphasetemporarily-method)
    - [reattachToBroadphase (method)](#reattachtobroadphase-method)
    - [wakeUp (method)](#wakeup-method)
    - [sleep (method)](#sleep-method)
    - [resetMotion (method)](#resetmotion-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [onCollisionStart$ (property)](#oncollisionstart-property)
    - [onCollisionEnd$ (property)](#oncollisionend-property)

---

# utils

## AmmoRigidBodyComponent (class)

**Signature**

```ts
export declare class AmmoRigidBodyComponent {
  constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: Ammo.btRigidBody,
    public readonly shape: Shape3DDescriptor,
    public readonly bodyType: BodyType = 'dynamic',
    public readonly ccd: boolean = false,
    public readonly canSleep: boolean = true
  )
}
```

### applyWorldTransform (method)

Bullet keeps a rigid body's pose in three places, and a teleport (the `position`/`rotation`
setters, `resetMotion()`) has to write every one this body type reads, or a later step reads a
stale one:

- `kinematic_pos`/`kinematic_vel`: Bullet's own kinematic bookkeeping
  (`btRigidBody::saveKinematicState`, run every `stepSimulation` for every
  `CF_KINEMATIC_OBJECT` body) _pulls_ the body's transform from its motion state, overwriting
  `m_worldTransform`, and derives the body's velocity for that step from the move (the velocity
  that lets it push/wake the dynamic bodies it sweeps into). Writing only `setWorldTransform`
  gets reverted by the next step - a real, reproduced regression: a moving kinematic floor's
  position writes looked fought/ignored. So the motion state is written too.
- `dynamic`: `setCenterOfMassTransform`, which besides `m_worldTransform` sets the
  interpolation transform and velocities and the world-space inertia tensor (a rotation
  teleport with `setWorldTransform` alone leaves the inertia tensor oriented for the old
  rotation until the next step). The motion state is written too:
  `btRaycastVehicle.updateWheelTransform(i, true)` (`AmmoRaycastVehicleComponent
.resetSuspension()`) places the wheels from the chassis's motion state.
- `static`: the plain `setWorldTransform` of `AmmoBodyComponent` - Bullet never reads anything
  else of a static body.

**Signature**

```ts
protected applyWorldTransform(transform: Ammo.btTransform): void
```

### applyForce (method)

Bullet accumulates applied forces/torques in the body (`m_totalForce`/`m_totalTorque`), uses
them in every internal substep of the next `stepSimulation` and clears them at its end - exactly
`IRigidBodyComponent.applyForce`'s "the next `simulate()` call, then gone" lifetime, so no
bookkeeping is needed here. A force at a point is `applyForce(force, rel_pos)`, `rel_pos` being
the point relative to the centre of mass in world orientation. Bullet only clears the
accumulators of bodies in the world, so a body outside one ignores the call (per the contract)
rather than banking every tick's force to fire at once after `addToWorld`.

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

### relativeToCenterOfMass (method)

A fresh `btVector3` (caller destroys it) of `worldPoint` relative to the centre of mass, or zero without one.

**Signature**

```ts
private relativeToCenterOfMass(worldPoint?: Point3): Ammo.btVector3
```

### emitCollisionStart (method)

Called by `AmmoWorldComponent.simulate()` only - see `onCollisionStart$`'s own doc.

**Signature**

```ts
emitCollisionStart(event: CollisionEvent<Point3, AmmoRigidBodyComponent>): void
```

### emitCollisionEnd (method)

Called by `AmmoWorldComponent.simulate()` only - see `onCollisionStart$`'s own doc.

**Signature**

```ts
emitCollisionEnd(other: AmmoRigidBodyComponent | null): void
```

### clone (method)

**Signature**

```ts
clone(): AmmoRigidBodyComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: AmmoGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: AmmoGgWorld, dispose?: boolean): void
```

### refreshCG (method)

**Signature**

```ts
refreshCG(): void
```

### detachFromBroadphaseTemporarily (method)

Temporarily detaches this body from the world's broadphase - deliberately **not** the same as
`removeFromWorld`/`addToWorld` (no `world.removed$`/`added$` notification is emitted, and
`addedToWorld` stays `true` throughout): for a caller doing a short, synchronous,
self-contained collision query that needs this specific body genuinely invisible to detection,
not just non-colliding, without those bookkeeping side effects. Restore with
`reattachToBroadphase()` before returning control to anything else. See
`AmmoCharacterControllerComponent.ignoredBodies` for the concrete use (a currently-held
`Grabbable3dEntity` excluded from its holder's own sweeps/overlap recovery - see
`ICharacterController3dComponent.ignoredBodies`'s doc for why collision groups can't do this).

Returns whether this body was actually detached (`false`, a no-op, if it wasn't in this world's
broadphase to begin with) - callers should only call `reattachToBroadphase()` for a body this
returned `true` for, mirroring `removeCollisionObject`/`addCollisionObject`'s own pairing.

**Signature**

```ts
detachFromBroadphaseTemporarily(): boolean
```

### reattachToBroadphase (method)

Undoes `detachFromBroadphaseTemporarily()` - see its own doc.

**Signature**

```ts
reattachToBroadphase(): void
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

### resetMotion (method)

Stops the body where it is: clears its forces and velocities in place, without taking it out
of the world (no `world.removed$`/`added$`, which would make e.g. `SurfaceFollowingEntity`
drop the body's road plane). A dynamic body's interpolation velocities are cleared as well
(`setCenterOfMassTransform` copies the now-zero velocities into them).

**Signature**

```ts
resetMotion(): void
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

### onCollisionStart$ (property)

Back `onCollisionStart`/`onCollisionEnd` below. Populated exclusively by
`AmmoWorldComponent.simulate()`'s own post-`stepSimulation` manifold bookkeeping via
`emitCollisionStart`/`emitCollisionEnd` - a single body has no way to discover the _other_
side of a contact pair (or when it stops touching something) on its own, so the world
component (which walks `dispatcher.getNumManifolds()` once per tick) is the only writer.
Kept protected rather than exposing the Subjects directly, mirroring how
`AmmoTriggerComponent` keeps its own `onEnter$`/`onLeft$` reachable only through its own
bookkeeping method (`checkOverlaps`).

**Signature**

```ts
readonly onCollisionStart$: any
```

### onCollisionEnd$ (property)

**Signature**

```ts
readonly onCollisionEnd$: any
```
