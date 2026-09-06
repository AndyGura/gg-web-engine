---
title: ammo/components/ammo-trigger.component.ts
nav_order: 8
parent: Modules
---

## ammo-trigger.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoTriggerComponent (class)](#ammotriggercomponent-class)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [refreshCG (method)](#refreshcg-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [overlaps (property)](#overlaps-property)
    - [onEnter$ (property)](#onenter-property)
    - [onLeft$ (property)](#onleft-property)

---

# utils

## AmmoTriggerComponent (class)

**Signature**

```ts
export declare class AmmoTriggerComponent {
  constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: Ammo.btPairCachingGhostObject,
    public readonly shape: Shape3DDescriptor
  )
}
```

### checkOverlaps (method)

**Signature**

```ts
checkOverlaps(): void
```

### clone (method)

**Signature**

```ts
clone(): AmmoTriggerComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: AmmoGgWorld)
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: AmmoGgWorld): void
```

### refreshCG (method)

**Signature**

```ts
refreshCG(): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
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
