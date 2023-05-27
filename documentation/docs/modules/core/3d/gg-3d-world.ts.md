---
title: core/3d/gg-3d-world.ts
nav_order: 31
parent: Modules
---

## gg-3d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dWorld (class)](#gg3dworld-class)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [loader (property)](#loader-property)

---

# utils

## Gg3dWorld (class)

**Signature**

```ts
export declare class Gg3dWorld<V, P> {
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
addPrimitiveRigidBody(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
  ): Gg3dEntity
```

### loader (property)

**Signature**

```ts
readonly loader: Gg3dLoader
```
