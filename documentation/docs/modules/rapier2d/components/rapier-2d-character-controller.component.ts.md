---
title: rapier2d/components/rapier-2d-character-controller.component.ts
nav_order: 167
parent: Modules
---

## rapier-2d-character-controller.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dCharacterControllerComponent (class)](#rapier2dcharactercontrollercomponent-class)
    - [syncColliderTransform (method)](#synccollidertransform-method)
    - [ignoredBodiesFilterPredicate (method)](#ignoredbodiesfilterpredicate-method)
    - [move (method)](#move-method)
    - [pushDynamicBodies (method)](#pushdynamicbodies-method)
    - [computeGroundNormal (method)](#computegroundnormal-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [name (property)](#name-property)
    - [radius (property)](#radius-property)
    - [centersDistance (property)](#centersdistance-property)
    - [ignoredBodies (property)](#ignoredbodies-property)
    - [\_nativeBody (property)](#_nativebody-property)
    - [\_nativeCollider (property)](#_nativecollider-property)
    - [\_nativeController (property)](#_nativecontroller-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [collisionGroups (property)](#collisiongroups-property)

---

# utils

## Rapier2dCharacterControllerComponent (class)

A capsule-shaped kinematic character controller backed by Rapier's own `KinematicCharacterController`
(`world.createCharacterController`) - the 2D counterpart of `Rapier3dCharacterControllerComponent`,
which this mirrors closely (2D `Vector2`/scalar rotation instead of 3D `Vector3`/`Quaternion`, the
snap-to-ground/autostep-vs-jump guard, the hand-rolled `pushDynamicBodies`, the "reuse the best-
`up`-aligned collision normal, falling back to the previous tick's rather than a flat guess"
ground-normal derivation - all identical). See that class's own doc for the full rationale behind
each of these; only 2D-specific notes are repeated here. One deliberate divergence: `move()` here
sweeps `desiredTranslation` as two single-axis passes (horizontal, then any remaining vertical
intent) rather than 3D's single combined sweep - see this method's own doc for why.

**Signature**

```ts
export declare class Rapier2dCharacterControllerComponent {
  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected readonly options: Required<CharacterController2dOptions>,
    protected _bodyDescr: RigidBodyDesc
  )
}
```

### syncColliderTransform (method)

**Signature**

```ts
private syncColliderTransform(): void
```

### ignoredBodiesFilterPredicate (method)

**Signature**

```ts
private ignoredBodiesFilterPredicate(): ((collider: Collider) => boolean) | undefined
```

### move (method)

**Signature**

```ts
move(desiredTranslation: Point2, dt?: number): void
```

### pushDynamicBodies (method)

Mirrors `Rapier3dCharacterControllerComponent.pushDynamicBodies` exactly, projected into 2D -
except `hitBodies` is passed in by the caller rather than read fresh from
`this._nativeController.numComputedCollisions()`/`computedCollision()` here, since by the time
this runs those may already reflect a _later_ sweep than the horizontal one this method cares
about (see `move()`'s own `collectHorizontalHitBodies`).

**Signature**

```ts
private pushDynamicBodies(hitBodies: RigidBody[], desiredTranslation: Point2, dt: number | undefined): void
```

### computeGroundNormal (method)

Mirrors `Rapier3dCharacterControllerComponent.computeGroundNormal` exactly, projected into 2D -
see that method's own doc for the full rationale (why a `0`-collision grounded call must reuse
the previous tick's normal rather than guessing flat `up`).

**Signature**

```ts
private computeGroundNormal(): Point2 | null
```

### clone (method)

**Signature**

```ts
clone(): Rapier2dCharacterControllerComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Rapier2dGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Rapier2dGgWorld, dispose?: boolean): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### entity (property)

**Signature**

```ts
entity: IEntity<any, any, GgWorldTypeDocRepo<any, any>> | null
```

### name (property)

**Signature**

```ts
name: string
```

### radius (property)

**Signature**

```ts
readonly radius: number
```

### centersDistance (property)

**Signature**

```ts
readonly centersDistance: number
```

### ignoredBodies (property)

See `ICharacterController2dComponent.ignoredBodies`'s doc.

**Signature**

```ts
readonly ignoredBodies: Set<Rapier2dRigidBodyComponent>
```

### \_nativeBody (property)

**Signature**

```ts
_nativeBody: RigidBody | null
```

### \_nativeCollider (property)

**Signature**

```ts
_nativeCollider: Collider | null
```

### \_nativeController (property)

**Signature**

```ts
_nativeController: KinematicCharacterController | null
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: DebugBody2DSettings
```

### collisionGroups (property)

**Signature**

```ts
collisionGroups: number
```
