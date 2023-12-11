---
title: rapier2d/components/rapier-2d-rigid-body.component.ts
nav_order: 105
parent: Modules
---

## rapier-2d-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dRigidBodyComponent (class)](#rapier2drigidbodycomponent-class)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [resetMotion (method)](#resetmotion-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [\_nativeBody (property)](#_nativebody-property)
    - [\_nativeBodyColliders (property)](#_nativebodycolliders-property)
    - [name (property)](#name-property)

---

# utils

## Rapier2dRigidBodyComponent (class)

**Signature**

```ts
export declare class Rapier2dRigidBodyComponent {
  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body2DOptions, 'dynamic'>, 'mass'>
  )
}
```

### clone (method)

**Signature**

```ts
clone(): Rapier2dRigidBodyComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg2dWorld<IVisualScene2dComponent, Rapier2dWorldComponent>): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg2dWorld<IVisualScene2dComponent, Rapier2dWorldComponent>): void
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
