---
title: core/base/math/matrix4.ts
nav_order: 80
parent: Modules
---

## matrix4 overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Mtrx4 (class)](#mtrx4-class)
    - [lookAt (static method)](#lookat-static-method)

---

# utils

## Mtrx4 (class)

**Signature**

```ts
export declare class Mtrx4
```

### lookAt (static method)

creates a rotation matrix for object, so it will look at some point in space

**Signature**

```ts
static lookAt(eye: Point3, target: Point3, up: Point3): number[]
```
