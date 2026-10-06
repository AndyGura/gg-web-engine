---
title: core/2d/components/rendering/i-display-object-2d.component.ts
nav_order: 20
parent: Modules
---

## i-display-object-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IDisplayObject2dComponent (interface)](#idisplayobject2dcomponent-interface)

---

# utils

## IDisplayObject2dComponent (interface)

**Signature**

```ts
export interface IDisplayObject2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IDisplayObjectComponent<Point2, number, VTypeDoc> {
  /**
   * Draw order: objects with a higher `zIndex` are drawn on top of lower ones, and equal values keep
   * the order they were added in. Default `0`. Parallax layers default to `-1` (behind the world).
   */
  zIndex: number

  /**
   * A color multiplied over this object's own colors, e.g. to color a white or grayscale sprite per
   * player. `0xffffff` (the default) leaves the colors unchanged. Applies to every child added with
   * `addChild` too.
   */
  tint: number

  /**
   * Opacity from `0` (invisible) to `1` (opaque, the default). Applies to every child added with
   * `addChild` too, multiplied with the child's own opacity.
   */
  opacity: number
}
```
