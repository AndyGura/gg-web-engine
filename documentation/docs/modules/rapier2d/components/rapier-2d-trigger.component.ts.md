---
title: rapier2d/components/rapier-2d-trigger.component.ts
nav_order: 115
parent: Modules
---

## rapier-2d-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dTriggerComponent (class)](#rapier2dtriggercomponent-class)
    - [addToWorld (method)](#addtoworld-method)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [clone (method)](#clone-method)
    - [onEnter$ (property)](#onenter-property)
    - [onLeft$ (property)](#onleft-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [intersectionsAmount (property)](#intersectionsamount-property)

---

# utils

## Rapier2dTriggerComponent (class)

**Signature**

```ts
export declare class Rapier2dTriggerComponent {
  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape2DDescriptor,
    protected _bodyDescr: RigidBodyDesc
  )
}
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg2dWorld<VisualTypeDocRepo2D, Rapier2dPhysicsTypeDocRepo>): void
```

### checkOverlaps (method)

**Signature**

```ts
checkOverlaps(): void
```

### clone (method)

**Signature**

```ts
clone(): Rapier2dTriggerComponent
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
