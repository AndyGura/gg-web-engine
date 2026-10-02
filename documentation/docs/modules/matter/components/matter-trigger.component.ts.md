---
title: matter/components/matter-trigger.component.ts
nav_order: 152
parent: Modules
---

## matter-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterTriggerComponent (class)](#mattertriggercomponent-class)
    - [handleCollisionStart (method)](#handlecollisionstart-method)
    - [handleCollisionEnd (method)](#handlecollisionend-method)
    - [isPolled (method)](#ispolled-method)
    - [overlaps (method)](#overlaps-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [checkPolledBodyOverlaps (method)](#checkpolledbodyoverlaps-method)
    - [clone (method)](#clone-method)
    - [onEnter$ (property)](#onenter-property)
    - [onLeft$ (property)](#onleft-property)
    - [currentCharacterOverlaps (property)](#currentcharacteroverlaps-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [intersectionsAmount (property)](#intersectionsamount-property)
    - [currentOverlaps (property)](#currentoverlaps-property)
    - [polledOverlaps (property)](#polledoverlaps-property)

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

### isPolled (method)

Whether matter's detector never pairs `comp` with this trigger: it skips every pair whose bodies
are both static or sleeping, and the trigger body is static. That covers sleeping bodies and
kinematic ones (built as static here, see `MatterFactory`). Bodies requested as `'static'` are
level geometry and are never reported.

**Signature**

```ts
protected isPolled(comp: MatterRigidBodyComponent): boolean
```

### overlaps (method)

**Signature**

```ts
protected overlaps(comp: MatterRigidBodyComponent): boolean
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

Awake dynamic bodies are handled by `handleCollisionStart`/`handleCollisionEnd` above, off
matter's own native `collisionStart`/`collisionEnd` engine events; kinematic and sleeping ones,
which matter never pairs with this static body, are polled by `checkPolledBodyOverlaps()`.
A `MatterCharacterControllerComponent`'s own phantom body is
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

### checkPolledBodyOverlaps (method)

Enter/exit of the rigid bodies matter's detector never pairs with this trigger (see
{@link isPolled}): a kinematic platform moving in or out, a body asleep inside. Like the
character poll below, `Query.collides` ignores `collisionFilter`, so `Detector.canCollide` is
checked by hand.

**Signature**

```ts
protected checkPolledBodyOverlaps(): void
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

### polledOverlaps (property)

The subset of `currentOverlaps` whose exit `checkOverlaps()` detects by polling, because matter's
detector doesn't pair them with this (static) trigger body - see {@link isPolled}. A body moves
back to the native-event path once a native `collisionStart` reports it (it woke up inside).

**Signature**

```ts
polledOverlaps: Set<MatterRigidBodyComponent>
```
