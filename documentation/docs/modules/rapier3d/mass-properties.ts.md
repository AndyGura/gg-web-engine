---
title: rapier3d/mass-properties.ts
nav_order: 208
parent: Modules
---

## mass-properties overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [inertiaAboutOrigin](#inertiaaboutorigin)

---

# utils

## inertiaAboutOrigin

The principal inertia and its frame of a body about its own origin, given the body's mass
properties about its centre of mass (`com`, in body space): the parallel-axis theorem applied to
the inertia tensor, then diagonalized again.

**Signature**

```ts
export declare function inertiaAboutOrigin(
  mass: number,
  com: Point3,
  principal: Point3,
  frame: Point4
): { principal: Point3; frame: Point4 }
```
