---
title: rapier3d/components/rapier-3d-world.component.ts
nav_order: 158
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
readonly mainCollisionGroup: any
```

### \_nativeWorld (property)

**Signature**

```ts
_nativeWorld: any
```

### handleIdEntityMap (property)

**Signature**

```ts
readonly handleIdEntityMap: any
```

### lockedCollisionGroups (property)

**Signature**

```ts
lockedCollisionGroups: number[]
```
