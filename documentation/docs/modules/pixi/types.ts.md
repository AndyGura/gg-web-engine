---
title: pixi/types.ts
nav_order: 114
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiGgWorld (type alias)](#pixiggworld-type-alias)
  - [PixiVisualTypeDocRepo2D (type alias)](#pixivisualtypedocrepo2d-type-alias)

---

# utils

## PixiGgWorld (type alias)

**Signature**

```ts
export type PixiGgWorld = Gg2dWorld<
  Gg2dWorldTypeDocVPatch<PixiVisualTypeDocRepo2D>,
  Gg2dWorldSceneTypeDocVPatch<PixiVisualTypeDocRepo2D, PixiSceneComponent>
>
```

## PixiVisualTypeDocRepo2D (type alias)

**Signature**

```ts
export type PixiVisualTypeDocRepo2D = {
  factory: PixiFactory
  displayObject: PixiDisplayObjectComponent
  renderer: PixiRendererComponent
  rendererExtraOpts: ApplicationOptions
  texture: Texture
}
```
