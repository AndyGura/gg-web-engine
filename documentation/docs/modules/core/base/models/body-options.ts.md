---
title: core/base/models/body-options.ts
nav_order: 152
parent: Modules
---

## body-options overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BodyOptions (interface)](#bodyoptions-interface)
  - [BodyType (type alias)](#bodytype-type-alias)
  - [CollisionGroup (type alias)](#collisiongroup-type-alias)
  - [DebugBodySettings (class)](#debugbodysettings-class)
  - [DebugBodyType (type alias)](#debugbodytype-type-alias)

---

# utils

## BodyOptions (interface)

**Signature**

```ts
export interface BodyOptions {
  bodyType: BodyType
  /**
   * Total mass of a dynamic body. In 3D the body's centre of mass is its origin, whatever its shape
   * (a `COMPOUND`'s parts don't move it), so where a model's origin sits is where its weight is -
   * low between the wheels for a car chassis. How rotational inertia follows from the shape is up
   * to each physics adapter.
   */
  mass: number
  restitution: number
  friction: number
  ownCollisionGroups: ReadonlyArray<CollisionGroup> | 'all'
  interactWithCollisionGroups: ReadonlyArray<CollisionGroup> | 'all'
  ccd: boolean
  /**
   * Whether the physics engine may put this body to sleep once it comes to rest. Default `true`.
   * A sleeping body is skipped by the solver until something wakes it up (a collision with an
   * awake body, a velocity write, `wakeUp()`); `false` keeps it simulated every step - for a body
   * whose motion matters even when it momentarily stops, e.g. one that should keep reacting to its
   * collision groups being changed under it. Only meaningful for a dynamic body: static bodies
   * never move and kinematic ones never sleep anyway.
   */
  canSleep: boolean
}
```

## BodyType (type alias)

**Signature**

```ts
export type BodyType = 'dynamic' | 'static' | 'kinematic_pos' | 'kinematic_vel'
```

## CollisionGroup (type alias)

**Signature**

```ts
export type CollisionGroup = number
```

## DebugBodySettings (class)

**Signature**

```ts
export declare class DebugBodySettings<S> {
  protected constructor(
    private _type: DebugBodyType,
    private _shape: S,
    private _ignoreTransform: boolean = false,
    private _color: number | undefined = undefined
  )
}
```

## DebugBodyType (type alias)

**Signature**

```ts
export type DebugBodyType =
  | { type: 'RIGID_KINEMATIC' }
  | { type: 'RIGID_STATIC' }
  | { type: 'TRIGGER'; activated: () => boolean }
  | { type: 'RIGID_DYNAMIC'; sleeping: () => boolean }
```
