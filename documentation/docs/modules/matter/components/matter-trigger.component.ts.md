---
title: matter/components/matter-trigger.component.ts
nav_order: 136
parent: Modules
---

## matter-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterTriggerComponent (class)](#mattertriggercomponent-class)
    - [handleCollisionStart (method)](#handlecollisionstart-method)
    - [handleCollisionEnd (method)](#handlecollisionend-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
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

### handleCollisionStart (method)

**Signature**

```ts
private handleCollisionStart(event: IEventCollision<Engine>)
```

### handleCollisionEnd (method)

**Signature**

```ts
private handleCollisionEnd(event: IEventCollision<Engine>)
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: MatterGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: MatterGgWorld, dispose?: boolean): void
```

### dispose (method)

Completes `onEnter$`/`onLeft$` on top of `MatterRigidBodyComponent.dispose()`'s own
`onCollisionStart$`/`onCollisionEnd$` completion (via `super.dispose()`) - this trigger's own
enter/exit subjects are a separate pair this subclass owns and must complete itself.

**Signature**

```ts
dispose(): void
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
