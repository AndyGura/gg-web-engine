---
title: ammo/components/ammo-trigger.component.ts
nav_order: 9
parent: Modules
---

## ammo-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoTriggerComponent (class)](#ammotriggercomponent-class)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [refreshCG (method)](#refreshcg-method)
    - [detachFromBroadphaseTemporarily (method)](#detachfrombroadphasetemporarily-method)
    - [reattachToBroadphase (method)](#reattachtobroadphase-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [overlaps (property)](#overlaps-property)
    - [onEnter$ (property)](#onenter-property)
    - [onLeft$ (property)](#onleft-property)
  - [isAmmoTrigger](#isammotrigger)

---

# utils

## AmmoTriggerComponent (class)

**Signature**

```ts
export declare class AmmoTriggerComponent {
  constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: Ammo.btPairCachingGhostObject,
    public readonly shape: Shape3DDescriptor
  )
}
```

### checkOverlaps (method)

**Signature**

```ts
checkOverlaps(): void
```

### clone (method)

**Signature**

```ts
clone(): AmmoTriggerComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: AmmoGgWorld)
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

Mirrors `AmmoRigidBodyComponent.detachFromBroadphaseTemporarily()`/`reattachToBroadphase()` for
this trigger's ghost object, backed by `removeCollisionObject`/`addCollisionObject` (the same
pair `addToWorld` itself uses, unlike a real rigid body's `removeRigidBody`/`addRigidBody`) -
see `AmmoCharacterControllerComponent`'s own doc for why its movement/ground-check queries need
every trigger excluded from the collision world for their duration: a trigger is a sensor with
no collision response by definition (see `ITrigger3dComponent`), so it must never physically
block or "ground" a character the way a real obstacle does.

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

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: DebugBody3DSettings
```

### overlaps (property)

**Signature**

```ts
readonly overlaps: Set<Ammo.btCollisionObject>
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

## isAmmoTrigger

A query resolving a native body/ghost object to its owning component must never treat a
`Trigger` as a hit - it's a sensor with no collision response by definition
(`ITrigger3dComponent`), so it was never meant to obstruct one. Shared by every JS-side
post-filter call site that needs this exact check
(`AmmoWorldComponent.raycast()`'s `closestNonTriggerHit`/`solidRayFallback`,
`AmmoCharacterControllerComponent.recoverFromPenetration()`) - see `raycast()`'s own doc for why
these filter in JS rather than via a broadphase detach.

**Signature**

```ts
export declare function isAmmoTrigger(body: unknown): body is AmmoTriggerComponent
```
