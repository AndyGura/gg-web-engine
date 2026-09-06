---
title: core/3d/entities/camera-3d.entity.ts
nav_order: 39
parent: Modules
---

## camera-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Camera3dEntity (class)](#camera3dentity-class)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## Camera3dEntity (class)

A positioned entity wrapping a camera component (`VTypeDoc['camera']`, e.g. the adapter-specific
camera type an app's `TypedGg3dWorld` uses) - not attached to any renderer/canvas itself (pass
`.camera` to `Gg3dWorld.addRenderer` for that), but addressable in the world/entity trees like
any other entity: `world.addEntity`/`getEntityByName`, `IEntity.getChildEntityByName`,
`removeEntity`.

**Signature**

```ts
export declare class Camera3dEntity<VTypeDoc> {
  constructor(public readonly camera: VTypeDoc['camera'])
}
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```
