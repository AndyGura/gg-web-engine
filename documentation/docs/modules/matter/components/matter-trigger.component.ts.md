---
title: matter/components/matter-trigger.component.ts
nav_order: 148
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
    - [currentCharacterOverlaps (property)](#currentcharacteroverlaps-property)
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

Regular rigid-body overlaps are handled entirely by `handleCollisionStart`/`handleCollisionEnd`
above, off matter's own native `collisionStart`/`collisionEnd` engine events - so this used to be
a pure no-op for matter-js. A `MatterCharacterControllerComponent`'s own phantom body is
deliberately never added to `Composite`/`engine.world` at all (see that class's own doc), so no
native collision pair - and thus no native event - can ever involve it. Since `checkOverlaps()` is
already called once per tick by `Trigger2dEntity` regardless of backend, this is the natural place
to add the poll this needs instead of inventing a second, differently-shaped mechanism: every
`MatterCharacterControllerComponent` currently in the world (`world.children`, which - unlike
matter's own `Composite` - already tracks it) is tested against this trigger's own body via
`Query.collides`, diffed against `currentCharacterOverlaps` to fire `onEntityEntered`/
`onEntityLeft` exactly on the enter/exit transitions, the same as the native-event path does for
ordinary bodies.

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

### currentCharacterOverlaps (property)

Character controllers currently overlapping this trigger, as of the last `checkOverlaps()`
poll - see that method's own doc for why this needs its own separate polling mechanism instead
of the native `collisionStart`/`collisionEnd` events `handleCollisionStart`/`handleCollisionEnd`
below rely on for ordinary rigid bodies.

**Signature**

```ts
currentCharacterOverlaps: Set<MatterCharacterControllerComponent>
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: DebugBody2DSettings
```

### intersectionsAmount (property)

**Signature**

```ts
intersectionsAmount: number
```

### currentOverlaps (property)

**Signature**

```ts
currentOverlaps: Set<MatterRigidBodyComponent>
```
