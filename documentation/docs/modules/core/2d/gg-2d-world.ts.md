---
title: core/2d/gg-2d-world.ts
nav_order: 15
parent: Modules
---

## gg-2d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dWorld (class)](#gg2dworld-class)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)

---

# utils

## Gg2dWorld (class)

**Signature**

```ts
export declare class Gg2dWorld<V, P> {
  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false
  )
}
```

### addPrimitiveRigidBody (method)

**Signature**

```ts
addPrimitiveRigidBody(descr: BodyShape2DDescriptor, position: Point2 = Pnt2.O, rotation: number = 0): Gg2dEntity
```
