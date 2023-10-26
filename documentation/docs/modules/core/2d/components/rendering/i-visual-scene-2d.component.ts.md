---
title: core/2d/components/rendering/i-visual-scene-2d.component.ts
nav_order: 15
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
export interface IVisualScene2dComponent extends IVisualSceneComponent<Point2, number> {
  readonly factory: IGg2dObjectFactory

  createRenderer(canvas?: HTMLCanvasElement, rendererOptions?: Partial<RendererOptions>): IRenderer2dComponent
}
```
