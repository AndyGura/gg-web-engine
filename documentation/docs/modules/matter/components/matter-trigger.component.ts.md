---
title: matter/components/matter-trigger.component.ts
nav_order: 105
parent: Modules
---

## matter-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterTriggerComponent (class)](#mattertriggercomponent-class)
    - [onCollisionStart (method)](#oncollisionstart-method)
    - [onCollisionEnd (method)](#oncollisionend-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [clone (method)](#clone-method)
    - [onEnter$ (property)](#onenter-property)
    - [onLeft$ (property)](#onleft-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [intersectionsAmount (property)](#intersectionsamount-property)
    - [currentOverlaps (property)](#currentoverlaps-property)

---

# utils

## MatterTriggerComponent (class)

**Signature**

```ts
export declare class MatterTriggerComponent {
  constructor(
    nativeBody: Body,
    public readonly shape: Shape2DDescriptor,
    protected readonly world: MatterWorldComponent
  )
}
```

### onCollisionStart (method)

**Signature**

```ts
private onCollisionStart(event: IEventCollision<Engine>)
```

### onCollisionEnd (method)

**Signature**

```ts
private onCollisionEnd(event: IEventCollision<Engine>)
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

### checkOverlaps (method)

**Signature**

```ts
checkOverlaps(): void
```

### clone (method)

**Signature**

```ts
clone(): MatterTriggerComponent
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

### currentOverlaps (property)

**Signature**

```ts
currentOverlaps: any
```
