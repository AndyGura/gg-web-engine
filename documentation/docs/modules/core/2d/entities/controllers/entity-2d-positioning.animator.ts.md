---
title: core/2d/entities/controllers/entity-2d-positioning.animator.ts
nav_order: 16
parent: Modules
---

## entity-2d-positioning.animator overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Entity2dPositioningAnimator (class)](#entity2dpositioninganimator-class)
    - [onSpawned (method)](#onspawned-method)
    - [applyPositioning (method)](#applypositioning-method)

---

# utils

## Entity2dPositioningAnimator (class)

**Signature**

```ts
export declare class Entity2dPositioningAnimator<T> {
  constructor(public entity: T, protected _animationFunction: AnimationFunction<Positioning2d>)
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg2dWorld)
```

### applyPositioning (method)

**Signature**

```ts
protected applyPositioning(value: Positioning2d)
```
