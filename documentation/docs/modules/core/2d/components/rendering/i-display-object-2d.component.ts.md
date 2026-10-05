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
}
```
