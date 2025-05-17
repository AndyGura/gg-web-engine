---
title: three/types.ts
nav_order: 138
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeGgWorld (type alias)](#threeggworld-type-alias)
  - [ThreeVisualTypeDocRepo (type alias)](#threevisualtypedocrepo-type-alias)

---

# utils

## ThreeGgWorld (type alias)

**Signature**

```ts
export type ThreeGgWorld = Gg3dWorld<
  Gg3dWorldTypeDocVPatch<ThreeVisualTypeDocRepo>,
  Gg3dWorldSceneTypeDocVPatch<ThreeVisualTypeDocRepo, ThreeSceneComponent>
>
```

## ThreeVisualTypeDocRepo (type alias)

**Signature**

```ts
export type ThreeVisualTypeDocRepo = {
  factory: ThreeFactory
  loader: ThreeLoader
  displayObject: ThreeDisplayObjectComponent
  renderer: ThreeRendererComponent
  rendererExtraOpts: WebGLRendererParameters
  camera: ThreeCameraComponent
  texture: Texture
}
```
