---
title: core/3d/entities/controllers/animators/camera-3d.animator.ts
nav_order: 37
parent: Modules
---

## camera-3d.animator overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Camera3dAnimationArgs (type alias)](#camera3danimationargs-type-alias)
  - [Camera3dAnimator (class)](#camera3danimator-class)
    - [onSpawned (method)](#onspawned-method)
    - [applyPositioning (method)](#applypositioning-method)

---

# utils

## Camera3dAnimationArgs (type alias)

**Signature**

```ts
export type Camera3dAnimationArgs = {
  position: Point3
  target: Point3
  up?: Point3
  fov?: number
}
```

## Camera3dAnimator (class)

**Signature**

```ts
export declare class Camera3dAnimator<VTypeDoc> {
  constructor(
    public entity: Renderer3dEntity<VTypeDoc>,
    protected _animationFunction: AnimationFunction<Camera3dAnimationArgs>
  )
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld<VTypeDoc>)
```

### applyPositioning (method)

**Signature**

```ts
protected applyPositioning(value: Camera3dAnimationArgs)
```
