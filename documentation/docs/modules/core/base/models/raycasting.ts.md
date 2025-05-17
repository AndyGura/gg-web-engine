---
title: core/base/models/raycasting.ts
nav_order: 96
parent: Modules
---

## raycasting overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [RaycastOptions (interface)](#raycastoptions-interface)
  - [RaycastResult (interface)](#raycastresult-interface)

---

# utils

## RaycastOptions (interface)

Interface representing options for a raycast operation.

**Signature**

```ts
export interface RaycastOptions<D> {
  /**
   * The starting point of the ray.
   */
  from: D

  /**
   * The end point of the ray.
   */
  to: D

  /**
   * Optional collision filter groups for the ray.
   */
  collisionFilterGroups?: CollisionGroup[]

  /**
   * Optional collision filter mask for the ray.
   */
  collisionFilterMask?: CollisionGroup[]
}
```

## RaycastResult (interface)

Interface representing the result of a raycast operation.

**Signature**

```ts
export interface RaycastResult<D, B> {
  /**
   * Whether the ray hit something.
   */
  hasHit: boolean

  /**
   * The hit body, if any.
   */
  hitBody?: B

  /**
   * The hit point in world space, if any.
   */
  hitPoint?: D

  /**
   * The hit normal in world space, if any.
   */
  hitNormal?: D

  /**
   * The distance from the ray origin to the hit point, if any.
   */
  hitDistance?: number
}
```
