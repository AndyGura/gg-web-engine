---
title: core/3d/components/rendering/i-visual-scene-3d.component.ts
nav_order: 33
parent: Modules
---

## i-visual-scene-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IVisualScene3dComponent (interface)](#ivisualscene3dcomponent-interface)

---

# utils

## IVisualScene3dComponent (interface)

**Signature**

```ts
export interface IVisualScene3dComponent extends IVisualSceneComponent<Point3, Point4> {
  readonly factory: IDisplayObject3dComponentFactory
  readonly loader: IDisplayObject3dComponentLoader

  createRenderer(
    camera: ICameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions>
  ): IRenderer3dComponent
}
```
