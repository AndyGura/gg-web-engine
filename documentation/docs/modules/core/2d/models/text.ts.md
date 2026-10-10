---
title: core/2d/models/text.ts
nav_order: 49
parent: Modules
---

## text overview

How a 2D text object looks, see `IDisplayObject2dComponentFactory.createText`. Every field is
optional; an omitted one keeps the adapter's default (or, in `IText2dComponent.setStyle`, its
current value).

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Text2dStyle (type alias)](#text2dstyle-type-alias)

---

# utils

## Text2dStyle (type alias)

How a 2D text object looks, see `IDisplayObject2dComponentFactory.createText`. Every field is
optional; an omitted one keeps the adapter's default (or, in `IText2dComponent.setStyle`, its
current value).

**Signature**

```ts
export type Text2dStyle = {
  /** CSS font family, e.g. `'monospace'`. */
  fontFamily?: string
  /** Font size in pixels. */
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  /** Fill color of the glyphs, e.g. `0xffffff`. */
  color?: number
  /** An outline drawn around the glyphs. */
  stroke?: { color: number; width: number }
  /** Alignment of the lines of a multi-line text relative to each other. */
  align?: 'left' | 'center' | 'right'
  /**
   * Which point of the text's bounding box sits at the object's `position`, in fractions of its
   * size: `{ x: 0, y: 0 }` is the top-left corner, `{ x: 0.5, y: 0.5 }` the center, `{ x: 0.5, y: 1 }`
   * the bottom-center. Default `{ x: 0, y: 0 }`.
   */
  anchor?: { x: number; y: number }
}
```
