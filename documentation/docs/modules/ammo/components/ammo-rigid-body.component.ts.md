---
title: ammo/components/ammo-rigid-body.component.ts
nav_order: 7
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
removeFromWorld(world: AmmoGgWorld): void
```

### refreshCG (method)

**Signature**

```ts
refreshCG(): void
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
