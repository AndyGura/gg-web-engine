---
title: three/types.ts
nav_order: 149
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeGgWorld (type alias)](#threeggworld-type-alias)
  - [ThreeSceneTypeDoc (type alias)](#threescenetypedoc-type-alias)
  - [ThreeTypeDoc (type alias)](#threetypedoc-type-alias)
  - [ThreeVisualTypeDocRepo (type alias)](#threevisualtypedocrepo-type-alias)

---

# utils

## ThreeGgWorld (type alias)

**Signature**

```ts
export type ThreeGgWorld = Gg3dWorld<ThreeTypeDoc, ThreeSceneTypeDoc>
```

## ThreeSceneTypeDoc (type alias)

**Signature**

```ts
export type ThreeSceneTypeDoc = Gg3dWorldSceneTypeDocVPatch<ThreeVisualTypeDocRepo, ThreeSceneComponent>
```

## ThreeTypeDoc (type alias)

**Signature**

```ts
export type ThreeTypeDoc = Gg3dWorldTypeDocVPatch<ThreeVisualTypeDocRepo>
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
