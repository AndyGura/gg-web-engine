---
title: matter/components/matter-world.component.ts
nav_order: 153
parent: Modules
---

## matter-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterWorldComponent (class)](#matterworldcomponent-class)
    - [init (method)](#init-method)
    - [findRigidBody (method)](#findrigidbody-method)
    - [handleCollisionStart (method)](#handlecollisionstart-method)
    - [handleCollisionEnd (method)](#handlecollisionend-method)
    - [registerCollisionGroup (method)](#registercollisiongroup-method)
    - [deregisterCollisionGroup (method)](#deregistercollisiongroup-method)
    - [simulate (method)](#simulate-method)
    - [raycast (method)](#raycast-method)
    - [dispose (method)](#dispose-method)
    - [matterEngine\_ (property)](#matterengine_-property)
    - [factory (property)](#factory-property)
    - [added$ (property)](#added-property)
    - [removed$ (property)](#removed-property)
    - [children (property)](#children-property)
    - [handleIdEntityMap (property)](#handleidentitymap-property)
    - [mainCollisionGroup (property)](#maincollisiongroup-property)
    - [lockedCollisionGroups (property)](#lockedcollisiongroups-property)

---

# utils

## MatterWorldComponent (class)

**Signature**

```ts
export declare class MatterWorldComponent {
  constructor()
}
```

### init (method)

`Engine.create` is never given `enableSleeping: true` here, matching matter-js's own default -
so a body this world creates never _naturally_ falls asleep from prolonged inactivity, no matter
how long it rests. `IRigidBodyComponent.sleep()`/`wakeUp()` still work regardless of this flag
(`Matter.Sleeping.set` writes a body's `isSleeping` flag directly, and `Engine.update`'s own
per-body integration skip checks that flag unconditionally, not gated behind
`engine.enableSleeping` - only the _automatic_ fall-asleep-from-rest/wake-on-collision behavior
is gated behind that flag) - only automatic, inactivity-driven sleeping is unavailable under the
current setup. A future change enabling it should re-check
`gg-engine-physics-adapter-matter`'s own note on this before assuming every existing
position/velocity setter still behaves the same way once bodies can sleep on their own.

**Signature**

```ts
async init(): Promise<void>
```

### findRigidBody (method)

**Signature**

```ts
private findRigidBody(nativeBody: Body): MatterRigidBodyComponent | undefined
```

### handleCollisionStart (method)

Wires `IRigidBody2dComponent.onCollisionStart` for every non-sensor pair in the world, off
matter-js's own `Matter.Events` 'collisionStart' (fired once per engine, not per-body - see
`gg-engine-physics-adapter-matter` for why it's registered here rather than per component).
`pair.isSensor` (true whenever either side is a trigger's underlying body, which always has
`isSensor: true` - see `MatterTriggerComponent`'s constructor) is skipped entirely, so a
trigger overlapping a rigid body only ever fires the trigger's own `onEntityEntered`, never
this.

Impulse: at the point this event fires, matter-js hasn't run `Resolver.solveVelocity` yet for
this step (that happens later in `Engine.update`, whose event order is
collisionStart → position solve → velocity solve → collisionActive → collisionEnd) - so a
freshly-created pair's `pair.contacts[*].normalImpulse`/`tangentImpulse` are still their
just-initialized `0`, not yet a meaningful number, for every pair this event could ever
report. Rather than reading always-zero data, `impulse` here is estimated as
`|relativeVelocity| * min(massA, massB)` (a rough "how hard did they hit" proxy - a static
body's `mass` is `Infinity`, so `min` naturally reduces to the dynamic side's mass when one
side is static).

**Signature**

```ts
private handleCollisionStart(event: IEventCollision<Engine>): void
```

### handleCollisionEnd (method)

Wires `IRigidBody2dComponent.onCollisionEnd` for every non-sensor pair that just stopped
touching - see `handleCollisionStart`'s doc for why sensor pairs are skipped and why this is
registered once per engine rather than per-body.

**Signature**

```ts
private handleCollisionEnd(event: IEventCollision<Engine>): void
```

### registerCollisionGroup (method)

**Signature**

```ts
registerCollisionGroup(): CollisionGroup
```

### deregisterCollisionGroup (method)

**Signature**

```ts
deregisterCollisionGroup(group: CollisionGroup): void
```

### simulate (method)

**Signature**

```ts
simulate(delta: number): void
```

### raycast (method)

matter-js has no native raycast query. Built on a true parametric ray-vs-polygon intersection
(`segmentIntersection`/`bodyPolygons`), not `Matter.Query.ray` - that helper is only a thin
wrapper over `Query.collides` (a full-geometry SAT test of a synthetic, very thin rectangle body
against candidates), which reports an approximate overlap contact point, not a true "where does
the ray segment first cross this body's boundary" point; verified via this adapter's own
regression suite (`MatterWorldComponent.spec.ts`'s `Raycast` block expects a precise hit point at
a known box edge) that the SAT-approximated version produces a visibly wrong point.

`Query.collides`/`Collision.collides` test raw geometry only and know nothing about
`collisionFilter` (the same limitation `MatterCharacterControllerComponent.collectObstacles`'s
own doc describes) - candidates are pre-filtered here via `Detector.canCollide` itself, called
directly against a synthetic filter built from `options.collisionFilterGroups`/
`collisionFilterMask`. Sensor bodies (triggers) are excluded from candidates entirely, mirroring
`collectObstacles`'s own exclusion - a trigger never physically blocks anything, so it shouldn't
register as a raycast hit either.

`hitNormal` is derived from whichever polygon edge the closest intersection landed on (rotated
90°, sign chosen to point back towards `options.from`) - not from a matter-js collision object at
all, sidestepping the sign-convention pitfall `handleCollisionStart`'s own doc describes for
`pair.collision.normal`.

**Signature**

```ts
raycast(options: RaycastOptions<Point2>): RaycastResult<Point2, MatterRigidBodyComponent>
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### matterEngine\_ (property)

**Signature**

```ts
matterEngine_: Engine | null
```

### factory (property)

**Signature**

```ts
readonly factory: MatterFactory
```

### added$ (property)

**Signature**

```ts
readonly added$: any
```

### removed$ (property)

**Signature**

```ts
readonly removed$: any
```

### children (property)

**Signature**

```ts
readonly children: MatterWorldChild[]
```

### handleIdEntityMap (property)

Mirrors the rapier packages' `handleIdEntityMap` pattern: `Body.id` (matter-js's own
globally-unique numeric id, assigned once per body via `Body.nextId` and stable for its whole
lifetime) to component, kept in sync alongside `children` so `findRigidBody` - called once per
collision pair, per step - is an O(1) lookup instead of an O(n) `Array.find` scan. Also used by
`MatterCharacterControllerComponent.pushDynamicBodies` to resolve a native body it just bumped
into back to its owning component.

**Signature**

```ts
readonly handleIdEntityMap: Map<number, MatterWorldChild>
```

### mainCollisionGroup (property)

**Signature**

```ts
readonly mainCollisionGroup: number
```

### lockedCollisionGroups (property)

**Signature**

```ts
lockedCollisionGroups: number[]
```
