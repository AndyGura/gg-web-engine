---
title: rapier3d/components/rapier-3d-rigid-body.component.ts
nav_order: 123
parent: Modules
---

## rapier-3d-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dRigidBodyComponent (class)](#rapier3drigidbodycomponent-class)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [resetMotion (method)](#resetmotion-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [\_nativeBody (property)](#_nativebody-property)
    - [\_nativeBodyColliders (property)](#_nativebodycolliders-property)
    - [name (property)](#name-property)
    - [collisionGroups (property)](#collisiongroups-property)

---

# utils

## Rapier3dRigidBodyComponent (class)

**Signature**

```ts
export declare class Rapier3dRigidBodyComponent {
  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape3DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body3DOptions, 'dynamic'>, 'mass'>
  )
}
```

### clone (method)

**Signature**

```ts
clone(): Rapier3dRigidBodyComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Rapier3dGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Rapier3dGgWorld): void
```

### resetMotion (method)

**Signature**

```ts
resetMotion(): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
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

### \_nativeBody (property)

**Signature**

```ts
_nativeBody: any
```

### \_nativeBodyColliders (property)

**Signature**

```ts
_nativeBodyColliders: any[] | null
```

### name (property)

**Signature**

```ts
name: string
```

### collisionGroups (property)

**Signature**

```ts
collisionGroups: any
```
