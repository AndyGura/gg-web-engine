---
title: core/3d/models/environment.ts
nav_order: 93
parent: Modules
---

## environment overview

Fog fading distant objects into `color`. `LINEAR` fog starts at `near` and is opaque at `far`;
`EXPONENTIAL` fog thickens with distance at the given `density`.

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CubeTextureFaces (type alias)](#cubetexturefaces-type-alias)
  - [Environment3dOpts (type alias)](#environment3dopts-type-alias)
  - [Fog3dOpts (type alias)](#fog3dopts-type-alias)
  - [LoadTextureOptions (type alias)](#loadtextureoptions-type-alias)

---

# utils

## CubeTextureFaces (type alias)

The six images of a cube-map sky, each named after the world direction it is seen in (the
engine is Z-up, so `pz` is the sky overhead and `nz` the ground below). Every image is drawn as
seen from inside the cube. The four side images (`px`, `nx`, `py`, `ny`) have their top edge
towards `+Z`; the top edge of `pz` is towards `+Y` and the top edge of `nz` towards `-Y`.

**Signature**

```ts
export type CubeTextureFaces = {
  px: string
  nx: string
  py: string
  ny: string
  pz: string
  nz: string
}
```

## Environment3dOpts (type alias)

Scene-wide environment settings - see `IVisualScene3dComponent.setEnvironment`.

**Signature**

```ts
export type Environment3dOpts<Tex> = {
  /**
   * What is drawn behind everything: a `0xRRGGBB` color, or a sky texture (a cube texture from
   * `IDisplayObject3dComponentLoader.loadCubeTexture`, or an equirectangular panorama from
   * `loadTexture(url, { mapping: 'equirectangular' })`). `null` shows the renderer's own clear
   * color (`RendererOptions.background`).
   */
  background: number | Tex | null
  /**
   * Texture lit materials reflect and are lit by (image-based lighting) - same kinds of texture
   * as `background`. Affects `'standart'`-shaded primitives and PBR materials of loaded models.
   * `null` disables it.
   */
  environmentMap: Tex | null
  /** Fog settings, `null` for no fog. */
  fog: Fog3dOpts | null
}
```

## Fog3dOpts (type alias)

Fog fading distant objects into `color`. `LINEAR` fog starts at `near` and is opaque at `far`;
`EXPONENTIAL` fog thickens with distance at the given `density`.

**Signature**

```ts
export type Fog3dOpts =
  | { type: 'LINEAR'; color: number; near: number; far: number }
  | { type: 'EXPONENTIAL'; color: number; density: number }
```

## LoadTextureOptions (type alias)

Options for `IDisplayObject3dComponentLoader.loadTexture`.

**Signature**

```ts
export type LoadTextureOptions = {
  /**
   * How the texture is projected. `'uv'` (default) is an ordinary texture for a mesh's `diffuse`;
   * `'equirectangular'` is a 2:1 panorama usable as `Environment3dOpts.background`/`environmentMap`,
   * with its horizon along the world's horizontal (XY) plane.
   */
  mapping?: 'uv' | 'equirectangular'
}
```
