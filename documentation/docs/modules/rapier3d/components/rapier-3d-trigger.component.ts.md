---
title: rapier3d/components/rapier-3d-trigger.component.ts
nav_order: 124
parent: Modules
---

## rapier-3d-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dTriggerComponent (class)](#rapier3dtriggercomponent-class)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [clone (method)](#clone-method)
    - [dispose (method)](#dispose-method)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [overlaps (property)](#overlaps-property)
    - [onEnter$ (property)](#onenter-property)
    - [onLeft$ (property)](#onleft-property)

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
addToWorld(world: Rapier3dGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Rapier3dGgWorld)
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

### dispose (method)

**Signature**

```ts
dispose()
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: any
```

### overlaps (property)

**Signature**

```ts
readonly overlaps: any
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
