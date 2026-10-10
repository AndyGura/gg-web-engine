---
title: core/base/assets/asset-ref.ts
nav_order: 104
parent: Modules
---

## asset-ref overview

Names one asset for `world.loader.preload` and for the `assets` hook of a level entity class:
the same thing the matching loader method takes.

- `ggGlb`: a `.glb`+`.meta` pair, as `loadGgGlb` (`url` without extension). `loadProps: false`
  leaves out the props/scenes the meta references, `propsPath` is where to find them.
- `glb`: a plain `.glb`, as `loadModel` (`url` without extension).
- `texture`: as `loadTexture`, with the same options.
- `cubeTexture`: as `loadCubeTexture` (3D only).
- `clip`: an audio clip, as `loadClip`.

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AssetRef (type alias)](#assetref-type-alias)
  - [stableKey](#stablekey)

---

# utils

## AssetRef (type alias)

Names one asset for `world.loader.preload` and for the `assets` hook of a level entity class:
the same thing the matching loader method takes.

- `ggGlb`: a `.glb`+`.meta` pair, as `loadGgGlb` (`url` without extension). `loadProps: false`
  leaves out the props/scenes the meta references, `propsPath` is where to find them.
- `glb`: a plain `.glb`, as `loadModel` (`url` without extension).
- `texture`: as `loadTexture`, with the same options.
- `cubeTexture`: as `loadCubeTexture` (3D only).
- `clip`: an audio clip, as `loadClip`.

**Signature**

```ts
export type AssetRef =
  | { kind: 'ggGlb'; url: string; loadProps?: boolean; propsPath?: string }
  | { kind: 'glb'; url: string; options?: Record<string, any> }
  | { kind: 'texture'; url: string; options?: Record<string, any> }
  | { kind: 'cubeTexture'; faces: Record<string, string> }
  | { kind: 'clip'; url: string }
```

## stableKey

Stable JSON of plain option objects, for cache keys: key order does not matter.

**Signature**

```ts
export declare function stableKey(value: unknown): string
```
