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
export interface IVisualScene3dComponent<TypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IVisualSceneComponent<Point3, Point4, TypeDoc> {
  readonly loader: TypeDoc['loader']

  createRenderer(
    camera: TypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & TypeDoc['rendererExtraOpts']>
  ): TypeDoc['renderer']
}
```
