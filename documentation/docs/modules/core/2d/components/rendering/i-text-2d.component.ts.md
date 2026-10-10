---
title: core/2d/components/rendering/i-text-2d.component.ts
nav_order: 25
parent: Modules
---

## i-text-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IText2dComponent (interface)](#itext2dcomponent-interface)

---

# utils

## IText2dComponent (interface)

A display object that draws a string, created with `IDisplayObject2dComponentFactory.createText`.
Wrap it in an `Entity2d` to place it in a world, like any other display object.

**Signature**

```ts
export interface IText2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IDisplayObject2dComponent<VTypeDoc> {
  /** The displayed string. `\n` starts a new line. */
  text: string

  /** The current style, with every field the adapter resolved. */
  readonly style: Text2dStyle

  /** Changes the given style fields and keeps the rest. */
  setStyle(style: Text2dStyle): void
}
```
