---
title: pixi/types.ts
nav_order: 125
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiGgWorld (type alias)](#pixiggworld-type-alias)
  - [PixiSceneTypeDoc (type alias)](#pixiscenetypedoc-type-alias)
  - [PixiTypeDoc (type alias)](#pixitypedoc-type-alias)
  - [PixiVisualTypeDocRepo2D (type alias)](#pixivisualtypedocrepo2d-type-alias)

---

# utils

## PixiGgWorld (type alias)

**Signature**

```ts
export type PixiGgWorld = Gg2dWorld<PixiTypeDoc, PixiSceneTypeDoc>
```

## PixiSceneTypeDoc (type alias)

**Signature**

```ts
export type PixiSceneTypeDoc = Gg2dWorldSceneTypeDocVPatch<PixiVisualTypeDocRepo2D, PixiSceneComponent>
```

## PixiTypeDoc (type alias)

**Signature**

```ts
export type PixiTypeDoc = Gg2dWorldTypeDocVPatch<PixiVisualTypeDocRepo2D>
```

## PixiVisualTypeDocRepo2D (type alias)

**Signature**

```ts
export type PixiVisualTypeDocRepo2D = {
  factory: PixiFactory
  displayObject: PixiDisplayObjectComponent
  camera: PixiCameraComponent
  renderer: PixiRendererComponent
  rendererExtraOpts: ApplicationOptions
  texture: Texture
}
```
