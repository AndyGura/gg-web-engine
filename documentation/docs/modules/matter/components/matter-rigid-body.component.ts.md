---
title: matter/components/matter-rigid-body.component.ts
nav_order: 187
parent: Modules
---

## matter-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterRigidBodyComponent (class)](#matterrigidbodycomponent-class)
    - [applyForce (method)](#applyforce-method)
    - [applyImpulse (method)](#applyimpulse-method)
    - [applyTorque (method)](#applytorque-method)
    - [applyTorqueImpulse (method)](#applytorqueimpulse-method)
    - [updateCollisionFilter (method)](#updatecollisionfilter-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [resetMotion (method)](#resetmotion-method)
    - [wakeUp (method)](#wakeup-method)
    - [sleep (method)](#sleep-method)
    - [name (property)](#name-property)
    - [entity (property)](#entity-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [\_interactWithCGsMask (property)](#_interactwithcgsmask-property)
    - [\_ownCGsMask (property)](#_owncgsmask-property)
    - [onCollisionStart$ (property)](#oncollisionstart-property)
    - [onCollisionEnd$ (property)](#oncollisionend-property)
    - [currentContacts (property)](#currentcontacts-property)

---

# utils

## MatterRigidBodyComponent (class)

**Signature**

```ts
export declare class MatterRigidBodyComponent {
  constructor(
    public nativeBody: Body,
    public readonly shape: Shape2DDescriptor,
    public readonly bodyType: BodyType = 'dynamic',
    public readonly ccd: boolean = false,
    public readonly canSleep: boolean = true
  )
}
```

### applyForce (method)

matter-js accumulates `body.force`/`body.torque` until its next `Engine.update`, which applies
and then clears them - `IRigidBodyComponent.applyForce`'s "next `simulate()` call only"
lifetime for free. `Body.applyForce` with a world point also adds the offset's torque.
`Engine.update` only clears the accumulators of bodies in its composite, so a body outside the
world ignores the call (per the contract) rather than banking every tick's force to fire at
once after `addToWorld`.

**Signature**

```ts
applyForce(force: Point2, worldPoint?: Point2): void
```

### applyImpulse (method)

matter-js has no impulse: the velocity change `impulse / mass` is written directly.

**Signature**

```ts
applyImpulse(impulse: Point2, worldPoint?: Point2): void
```

### applyTorque (method)

**Signature**

```ts
applyTorque(torque: number): void
```

### applyTorqueImpulse (method)

Same unit convention as `linearVelocity`: an angular velocity change of `torqueImpulse / inertia` per second.

**Signature**

```ts
applyTorqueImpulse(torqueImpulse: number): void
```

### updateCollisionFilter (method)

**Signature**

```ts
protected updateCollisionFilter(): void
```

### clone (method)

**Signature**

```ts
clone(): MatterRigidBodyComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: MatterGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: MatterGgWorld, dispose: boolean = false): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### resetMotion (method)

**Signature**

```ts
resetMotion(): void
```

### wakeUp (method)

No-op on a body that reports `isStatic` (a genuine `'static'` body, or a `kinematic_pos`/
`kinematic_vel` request - see `isSleeping`'s own doc for why both are treated the same here).

**Signature**

```ts
wakeUp(): void
```

### sleep (method)

No-op on a body that reports `isStatic` (see `isSleeping`'s own doc) or was created with
`canSleep: false`. Forces sleep immediately,
regardless of whether the world's `Matter.Engine` has `enableSleeping` turned on - unlike a
body naturally falling asleep from inactivity (which requires that engine flag), an explicit
`Sleeping.set(body, true)` call takes effect either way.

**Signature**

```ts
sleep(): void
```

### name (property)

**Signature**

```ts
name: string
```

### entity (property)

**Signature**

```ts
entity: Entity2d<Gg2dWorldTypeDocRepo> | null
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: DebugBody2DSettings
```

### \_interactWithCGsMask (property)

**Signature**

```ts
_interactWithCGsMask: number
```

### \_ownCGsMask (property)

**Signature**

```ts
_ownCGsMask: number
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

### currentContacts (property)

Other rigid bodies this body is currently touching (non-sensor contact only), tracked so
`removeFromWorld` can tell them apart to emit `onCollisionEnd(null)` per that member's
documented "other body removed while still in contact" case. Maintained exclusively via
`notifyCollisionStart`/`notifyCollisionEnd`, called by `MatterWorldComponent`'s single
world-wide `collisionStart`/`collisionEnd` listener - not touched directly by anything else.

**Signature**

```ts
readonly currentContacts: Set<MatterRigidBodyComponent>
```
