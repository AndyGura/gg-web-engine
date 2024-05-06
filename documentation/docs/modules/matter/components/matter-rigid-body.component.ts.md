---
title: matter/components/matter-rigid-body.component.ts
nav_order: 99
parent: Modules
---

## matter-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterRigidBodyComponent (class)](#matterrigidbodycomponent-class)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [resetMotion (method)](#resetmotion-method)
    - [name (property)](#name-property)
    - [entity (property)](#entity-property)

---

# utils

## MatterRigidBodyComponent (class)

**Signature**

```ts
export declare class MatterRigidBodyComponent {
  constructor(public nativeBody: Body, public readonly shape: Shape2DDescriptor)
}
```

### clone (method)

**Signature**

```ts
clone(): MatterRigidBodyComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(
    world: Gg2dWorld<VisualTypeDocRepo2D, MatterPhysicsTypeDocRepo, IVisualScene2dComponent, MatterWorldComponent>,
  ): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(
    world: Gg2dWorld<VisualTypeDocRepo2D, MatterPhysicsTypeDocRepo, IVisualScene2dComponent, MatterWorldComponent>,
  ): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### resetMotion (method)

**Signature**

```ts
resetMotion(): void
```

### name (property)

**Signature**

```ts
name: string
```

### entity (property)

**Signature**

```ts
entity: any
```
