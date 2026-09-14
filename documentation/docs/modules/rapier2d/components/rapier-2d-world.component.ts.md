---
title: rapier2d/components/rapier-2d-world.component.ts
nav_order: 149
parent: Modules
---

## rapier-2d-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dWorldComponent (class)](#rapier2dworldcomponent-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [dispatchCollisionEvents (method)](#dispatchcollisionevents-method)
    - [emitCollisionStart (method)](#emitcollisionstart-method)
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

## Rapier2dWorldComponent (class)

**Signature**

```ts
export declare class Rapier2dWorldComponent {
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

Drains this step's collision events from the world's single shared `EventQueue` and routes
each start/stop transition to whichever component(s) it belongs to - a sensor-overlap
transition (either side a `Rapier2dTriggerComponent`) goes to that trigger's own
`handleOverlapEvent` (its `onEntityEntered`/`onEntityLeft`), a real contact transition between
two plain rigid bodies goes to both sides' `handleCollisionStart`/`handleCollisionEnd`
(`onCollisionStart`/`onCollisionEnd`).

This drains the queue exactly once per `simulate()` call, centrally, rather than leaving each
trigger to drain the whole (shared, single) queue itself from its own `checkOverlaps()` - two
triggers both calling `drainCollisionEvents` in the same frame would otherwise race for the
same queue, with the first drain silently consuming events the second was waiting for (this
was already a latent limitation of the pre-existing single-trigger-only draining approach).
`Rapier2dTriggerComponent.checkOverlaps()` still exists and is still called by `Trigger2dEntity`
every tick, but it no longer drains anything itself - see its own doc.

**Signature**

```ts
private dispatchCollisionEvents(): void
```

### emitCollisionStart (method)

Builds and emits the reciprocal `onCollisionStart` pair for two plain rigid-body colliders
that Rapier just reported as newly touching.

`impulse` is derived from `TempContactManifold.contactImpulse(i)` - the actual per-contact
impulse magnitude already solved by Rapier for this step (summed across every contact in the
manifold), not an approximation - so it's directly comparable across hits from this adapter.
`position` is the first solver contact point (already world-space); `normal` is the manifold's
world-space contact normal, oriented for each body so it always points away from that body
towards the other (Rapier's `contactPair` may invoke the callback with `flipped: true` when it
internally stored the pair as (collider2, collider1) rather than (collider1, collider2), in
which case the raw normal already points from collider2 towards collider1 and must be negated
to keep a consistent "away from collider1, towards collider2" convention before per-body
orientation is applied below).

A manifold can legitimately be empty the same step a `started` event is reported for it (the
narrow-phase pass that produced the event and the manifold read back here are the same pass,
but Rapier doesn't guarantee a manifold survives with contact data intact for every shape pair
across that boundary) - in that rare case this falls back to the midpoint between the two
bodies' own positions and the direction between them, with `impulse: 0`, rather than dropping
the event outright.

**Signature**

```ts
private emitCollisionStart(
    c1: Rapier2dRigidBodyComponent,
    c2: Rapier2dRigidBodyComponent,
    collider1: Collider,
    collider2: Collider,
  ): void
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
raycast(options: RaycastOptions<Point2>): RaycastResult<Point2, Rapier2dRigidBodyComponent>
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
readonly children: Rapier2dRigidBodyComponent[]
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
