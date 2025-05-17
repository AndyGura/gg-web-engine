---
title: core/2d/components/rendering/i-visual-scene-2d.component.ts
nav_order: 16
parent: Modules
---

## i-visual-scene-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IVisualScene2dComponent (interface)](#ivisualscene2dcomponent-interface)

---

# utils

## IVisualScene2dComponent (interface)

**Signature**

```ts
export interface IVisualScene2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IVisualSceneComponent<Point2, number, VTypeDoc> {
  createRenderer(
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']>
  ): VTypeDoc['renderer']
}
```
