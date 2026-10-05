---
title: core/2d/entities/parallax-layer-2d.entity.ts
nav_order: 33
parent: Modules
---

## parallax-layer-2d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ParallaxLayer2dEntity (class)](#parallaxlayer2dentity-class)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## ParallaxLayer2dEntity (class)

Wraps a parallax layer component (`VTypeDoc['parallaxLayer']`, see `IParallaxLayer2dComponent`)
so it can be added to a world, found by name and removed with its level. Created by
`Gg2dWorld.addParallaxLayer` or the `"ParallaxLayer"` level-JSON class. The layer positions
itself from each renderer's camera, so this entity has nothing to do per tick.

**Signature**

```ts
export declare class ParallaxLayer2dEntity<VTypeDoc> {
  constructor(public readonly layer: VTypeDoc['parallaxLayer'])
}
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```
