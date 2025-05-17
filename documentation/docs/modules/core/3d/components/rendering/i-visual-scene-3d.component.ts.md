---
title: core/3d/components/rendering/i-visual-scene-3d.component.ts
nav_order: 35
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
export interface IVisualScene3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IVisualSceneComponent<Point3, Point4, VTypeDoc> {
  readonly loader: VTypeDoc['loader']

  createRenderer(
    camera: VTypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']>
  ): VTypeDoc['renderer']
}
```
