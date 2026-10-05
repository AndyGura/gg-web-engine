---
title: core/3d/entities/light-3d.entity.ts
nav_order: 78
parent: Modules
---

## light-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Light3dEntity (class)](#light3dentity-class)
    - [lookAt (method)](#lookat-method)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## Light3dEntity (class)

A positioned entity wrapping a light component (`VTypeDoc['light']`, see `ILight3dComponent`),
created by `Gg3dWorld.addLight` or the `"Light"` level-JSON class, or by hand from
`visualScene.factory.createLight(...)`. Addressable in the world/entity trees like any other
entity, and removing it removes the light from the scene.

**Signature**

```ts
export declare class Light3dEntity<VTypeDoc> {
  constructor(public readonly light: VTypeDoc['light'])
}
```

### lookAt (method)

Rotates the light so it shines from its current position towards `target` - what `DIRECTIONAL`
and `SPOT` lights normally want. Call it again after moving the light to keep it aimed.

**Signature**

```ts
lookAt(target: Point3): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```
