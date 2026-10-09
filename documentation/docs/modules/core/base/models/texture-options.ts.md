---
title: core/base/models/texture-options.ts
nav_order: 159
parent: Modules
---

## texture-options overview

How a texture is sampled when drawn bigger or smaller than its own resolution: `linear` smooths
between texels (the default, right for photos and painted art), `nearest` picks the closest texel
and keeps hard pixel edges (right for pixel art).

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [TextureFilter (type alias)](#texturefilter-type-alias)
  - [TextureOptions (type alias)](#textureoptions-type-alias)

---

# utils

## TextureFilter (type alias)

How a texture is sampled when drawn bigger or smaller than its own resolution: `linear` smooths
between texels (the default, right for photos and painted art), `nearest` picks the closest texel
and keeps hard pixel edges (right for pixel art).

**Signature**

```ts
export type TextureFilter = 'linear' | 'nearest'
```

## TextureOptions (type alias)

Options for loading or creating a texture, shared by 2D and 3D factories.

**Signature**

```ts
export type TextureOptions = {
  /** See `TextureFilter`. Default `linear`. */
  filter?: TextureFilter
}
```
