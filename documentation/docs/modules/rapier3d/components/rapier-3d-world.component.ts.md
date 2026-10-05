---
title: rapier3d/components/rapier-3d-world.component.ts
nav_order: 189
parent: Modules
---

## rapier-3d-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dWorldComponent (class)](#rapier3dworldcomponent-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [dispatchCollisionEvents (method)](#dispatchcollisionevents-method)
    - [computeContactGeometry (method)](#computecontactgeometry-method)
    - [registerCollisionGroup (method)](#registercollisiongroup-method)
    - [deregisterCollisionGroup (method)](#deregistercollisiongroup-method)
    - [raycast (method)](#raycast-method)
    - [dispose (method)](#dispose-method)
    - [added$ (property)](#added-property)
    - [removed$ (property)](#removed-property)
    - [children (property)](#children-property)
    - [mainCollisionGroup (property)](#maincollisiongroup-property)
    - [\_nativeWorld (property)](#_nativeworld-property)
    - [handleIdEntityMap (property)](#handleidentitymap-property)
    - [raycastVehicles (property)](#raycastvehicles-property)
    - [lockedCollisionGroups (property)](#lockedcollisiongroups-property)

---

# utils

## Rapier3dWorldComponent (class)

**Signature**

```ts
export declare class Rapier3dWorldComponent {
  constructor()
}
```

### init (method)

**Signature**

```ts
async init(): Promise<void>
```

### simulate (method)

**Signature**

```ts
simulate(delta: number): void
```

### dispatchCollisionEvents (method)

Drains `eventQueue` exactly once per `simulate()` call and routes each entry to whichever
component(s) care - this is the _only_ place `drainCollisionEvents` is called for the whole
world (see `Rapier3dTriggerComponent.notifyOverlap`'s doc for why a second/independent drain
elsewhere would silently steal events from this one). A collider pair with sensor
semantics (either side `isSensor()`) is routed as a trigger overlap; an ordinary pair is routed
as a real rigid-body collision.

`EventQueue.drainCollisionEvents` reports _collider_ handles, not rigid-body handles -
`handleIdEntityMap` is keyed by rigid-body handle (see `addToWorld`), so each handle is resolved
via `World.getCollider(handle)` (returns `null` for a since-removed collider, not a throw - safe
to just skip) then `Collider.parent()` to reach the owning `RigidBody` before the map lookup.

`handleIdEntityMap` also holds `Rapier3dCharacterControllerComponent`s (see its own doc), so
`comp1`/`comp2` below can each be a character controller as well as a rigid body/trigger - the
sensor branch handles that directly (`notifyOverlap` accepts either), while the real-contact
branch narrows to `Rapier3dRigidBodyComponent` first, since a character controller has no
collision-event API to call into.

**Signature**

```ts
protected dispatchCollisionEvents(): void
```

### computeContactGeometry (method)

Reads world-space contact position/normal/impulse for a just-started contact between two
non-sensor colliders via `World.contactPair`'s `TempContactManifold`. Returns `null` only if the
pair has no manifold at all (shouldn't normally happen for a pair `drainCollisionEvents` just
reported as newly touching, but guarded defensively). `World.contactPair`'s callback can in
principle be invoked once per manifold between the pair - for the compound/multi-collider shapes
this can matter for, each sub-collider pair already gets its own separate `drainCollisionEvents`
entry (and thus its own `computeContactGeometry` call) since collision events are per-_collider_,
not per-body, so in practice a single call here only ever sees one manifold; only the first
encountered is used regardless. `impulse` sums `contactImpulse(i)` across every contact point of
that manifold (an already-solved _impulse_, not a force estimate - the pinned
`@dimforge/rapier3d-compat` build's constraint solver runs within the same `World.step()` call
that produced this `started` event, so the manifold's impulses are already up to date by the time
this runs). `normal` is returned oriented "away from `collider1` towards `collider2`" - Rapier's
`contactPair(a, b, f)` reports whether its own internally-cached manifold order matches the
queried `(a, b)` order via the callback's `flipped` flag; when `flipped` is `true` the manifold's
`normal()` (always world-space, always pointing from the manifold's own shape1 to shape2) actually
points from `collider2` to `collider1` and must be negated to match this method's documented
orientation - verified empirically against a ball resting on a floor below it (see
`gg-engine-physics-adapter-rapier` for the exact reproduction).

**Signature**

```ts
protected computeContactGeometry(
    collider1: Collider,
    collider2: Collider,
  ): { position: Point3; normal: Point3; impulse: number } | null
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

### raycast (method)

`castRay`'s own default (no `filterFlags`) treats a sensor collider as a solid obstacle, exactly
like any real one - `QueryFilterFlags.EXCLUDE_SENSORS` is required so a raycast never reports a
hit against a `Trigger`'s own collider, matching what "trigger" means everywhere else in this
engine (a sensor with no collision response, see `ITrigger3dComponent`).

**Signature**

```ts
raycast(options: RaycastOptions<Point3>): RaycastResult<Point3, Rapier3dRigidBodyComponent>
```

### dispose (method)

**Signature**

```ts
dispose(): void
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
readonly children: Rapier3dWorldChild[]
```

### mainCollisionGroup (property)

**Signature**

```ts
readonly mainCollisionGroup: number
```

### \_nativeWorld (property)

**Signature**

```ts
_nativeWorld: World | null
```

### handleIdEntityMap (property)

Keyed by rigid-body handle. Includes `Rapier3dCharacterControllerComponent`s alongside ordinary
`Rapier3dRigidBodyComponent`s (triggers included, since `Rapier3dTriggerComponent extends
Rapier3dRigidBodyComponent`) - a character controller's kinematic body still gets a real Rapier
rigid-body handle on `addToWorld` (see that class), so it registers here the same way, letting
`dispatchCollisionEvents` resolve sensor-overlap pairs against it (so a `Trigger` fires for a
player walking through it, not just for ordinary rigid bodies/vehicle chassis) and letting
`raycast()` resolve a hit against it too. `dispatchCollisionEvents` still narrows to
`Rapier3dRigidBodyComponent` before treating a pair as a real (non-sensor) contact, since a
character controller has no `notifyCollisionStart`/`notifyCollisionEnd` to call - its physical
response comes from its own sweep-based `move()`, not Rapier's contact solver.

**Signature**

```ts
readonly handleIdEntityMap: Map<number, Rapier3dWorldChild>
```

### raycastVehicles (property)

Every `Rapier3dRaycastVehicleComponent` currently in this world - unlike an ordinary rigid body
or `Rapier3dCharacterControllerComponent`, a vehicle needs an explicit per-tick
`updateVehicle()` call (see that class's own doc for why: nothing steps Rapier's vehicle
controller automatically as part of `World.step()`). `simulate()` drives every registered
vehicle from this set immediately before stepping the world, so the forces it just wrote into
the chassis's velocity get integrated by that same step.

**Signature**

```ts
readonly raycastVehicles: Set<Rapier3dRaycastVehicleComponent>
```

### lockedCollisionGroups (property)

**Signature**

```ts
lockedCollisionGroups: number[]
```
