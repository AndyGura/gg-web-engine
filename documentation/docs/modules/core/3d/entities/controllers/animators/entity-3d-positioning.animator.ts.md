---
title: core/3d/entities/controllers/animators/entity-3d-positioning.animator.ts
nav_order: 36
parent: Modules
---

## entity-3d-positioning.animator overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Entity3dPositioningAnimator (class)](#entity3dpositioninganimator-class)
    - [onSpawned (method)](#onspawned-method)
    - [applyPositioning (method)](#applypositioning-method)

---

# utils

## Entity3dPositioningAnimator (class)

**Signature**

```ts
export declare class Entity3dPositioningAnimator<T> {
  constructor(public entity: T, protected _animationFunction: AnimationFunction<Positioning3d>)
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld)
```

### applyPositioning (method)

**Signature**

```ts
protected applyPositioning(value: Positioning3d)
```
