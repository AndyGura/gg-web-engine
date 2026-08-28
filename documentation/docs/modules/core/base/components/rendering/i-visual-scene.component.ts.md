---
title: core/base/components/rendering/i-visual-scene.component.ts
nav_order: 78
parent: Modules
---

## i-visual-scene.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IVisualSceneComponent (interface)](#ivisualscenecomponent-interface)

---

# utils

## IVisualSceneComponent (interface)

**Signature**

```ts
export interface IVisualSceneComponent<D, R, VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IComponent {
  readonly factory: VTypeDoc['factory']

  init(): Promise<void>

  createRenderer(
    camera: VTypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']>
  ): VTypeDoc['renderer']
}
```
