---
title: rapier3d/components/rapier-3d-trigger.component.ts
nav_order: 122
parent: Modules
---

## rapier-3d-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dTriggerComponent (class)](#rapier3dtriggercomponent-class)
    - [addToWorld (method)](#addtoworld-method)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [clone (method)](#clone-method)
    - [onEnter$ (property)](#onenter-property)
    - [onLeft$ (property)](#onleft-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [intersectionsAmount (property)](#intersectionsamount-property)

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
addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, Rapier3dPhysicsTypeDocRepo>): void
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

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: any
```

### intersectionsAmount (property)

**Signature**

```ts
intersectionsAmount: number
```
