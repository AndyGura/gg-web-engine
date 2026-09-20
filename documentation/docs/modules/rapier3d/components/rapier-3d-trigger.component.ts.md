---
title: rapier3d/components/rapier-3d-trigger.component.ts
nav_order: 157
parent: Modules
---

## rapier-3d-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dTriggerComponent (class)](#rapier3dtriggercomponent-class)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [notifyOverlap (method)](#notifyoverlap-method)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [clone (method)](#clone-method)
    - [dispose (method)](#dispose-method)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [overlaps (property)](#overlaps-property)
    - [onEnter$ (property)](#onenter-property)
    - [onLeft$ (property)](#onleft-property)

---

# utils

## Rapier3dTriggerComponent (class)

**Signature**

```ts
export declare class Rapier3dTriggerComponent {
  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape3DDescriptor,
    protected _bodyDescr: RigidBodyDesc
  )
}
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Rapier3dGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean)
```

### notifyOverlap (method)

Called by `Rapier3dWorldComponent`'s centralized collision-event dispatch (see
`Rapier3dWorldComponent.simulate`) once per drained sensor-intersection event involving this
trigger - not meant to be called by app code directly. Previously this trigger drained
`world.eventQueue` itself from inside `checkOverlaps()`, matching `otherBody` by comparing an
event's _collider_ handle against `this.nativeBody?.handle` (a _rigid-body_ handle) - those are
two different handle namespaces in this pinned `@dimforge/rapier3d-compat` build, and the
comparison only ever happened to work by coincidence (a body's first/only collider is allocated
from a separate arena that, absent any prior removals, marches in lockstep with the rigid-body
arena for the common one-collider-per-body case - see `gg-engine-physics-adapter-rapier` for the
full incident). `EventQueue.drainCollisionEvents` also fully drains the _shared_ queue on every
call, so more than one consumer draining it independently (this trigger, another trigger, and now
`Rapier3dRigidBodyComponent`'s own collision events) would silently steal each other's events -
`Rapier3dWorldComponent` is now the single place that drains it, resolving collider handles to
components correctly via `Collider.parent()`, and pushes matching events to whichever
component(s) care.

**Signature**

```ts
public notifyOverlap(otherBody: Rapier3dRigidBodyComponent, started: boolean): void
```

### checkOverlaps (method)

**Signature**

```ts
checkOverlaps(): void
```

### clone (method)

**Signature**

```ts
clone(): Rapier3dTriggerComponent
```

### dispose (method)

Completes `onEnter$`/`onLeft$` on top of `Rapier3dRigidBodyComponent.dispose()`'s own
`onCollisionStart$`/`onCollisionEnd$` completion (via `super.dispose()`) - this trigger's own
subjects have no other owner to complete them.

**Signature**

```ts
dispose()
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: any
```

### overlaps (property)

**Signature**

```ts
readonly overlaps: any
```

### onEnter$ (property)

**Signature**

```ts
readonly onEnter$: any
```

### onLeft$ (property)

**Signature**

```ts
readonly onLeft$: any
```
