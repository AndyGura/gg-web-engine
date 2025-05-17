---
title: rapier2d/components/rapier-2d-trigger.component.ts
nav_order: 117
parent: Modules
---

## rapier-2d-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dTriggerComponent (class)](#rapier2dtriggercomponent-class)
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
addToWorld(world: Rapier2dGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Rapier2dGgWorld)
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
