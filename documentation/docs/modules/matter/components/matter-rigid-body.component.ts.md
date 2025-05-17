---
title: matter/components/matter-rigid-body.component.ts
nav_order: 104
parent: Modules
---

## matter-rigid-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterRigidBodyComponent (class)](#matterrigidbodycomponent-class)
    - [updateCollisionFilter (method)](#updatecollisionfilter-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [resetMotion (method)](#resetmotion-method)
    - [name (property)](#name-property)
    - [entity (property)](#entity-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [\_interactWithCGsMask (property)](#_interactwithcgsmask-property)
    - [\_ownCGsMask (property)](#_owncgsmask-property)

---

# utils

## MatterRigidBodyComponent (class)

**Signature**

```ts
export declare class MatterRigidBodyComponent {
  constructor(public nativeBody: Body, public readonly shape: Shape2DDescriptor)
}
```

### updateCollisionFilter (method)

**Signature**

```ts
protected updateCollisionFilter(): void
```

### clone (method)

**Signature**

```ts
clone(): MatterRigidBodyComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: MatterGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: MatterGgWorld): void
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

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: any
```

### \_interactWithCGsMask (property)

**Signature**

```ts
_interactWithCGsMask: any
```

### \_ownCGsMask (property)

**Signature**

```ts
_ownCGsMask: any
```
