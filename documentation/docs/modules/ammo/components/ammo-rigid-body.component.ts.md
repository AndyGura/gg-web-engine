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
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [refreshCG (method)](#refreshcg-method)
    - [detachFromBroadphaseTemporarily (method)](#detachfrombroadphasetemporarily-method)
    - [reattachToBroadphase (method)](#reattachtobroadphase-method)
    - [resetMotion (method)](#resetmotion-method)
    - [entity (property)](#entity-property)
    - [debugBodySettings (property)](#debugbodysettings-property)

---

# utils

## AmmoRigidBodyComponent (class)

**Signature**

```ts
export declare class AmmoRigidBodyComponent {
  constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: Ammo.btRigidBody,
    public readonly shape: Shape3DDescriptor
  )
}
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

### resetMotion (method)

**Signature**

```ts
resetMotion(): void
```

### entity (property)

**Signature**

```ts
entity: any
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: any
```
