---
title: core/base/particles/particle-frames.ts
nav_order: 170
parent: Modules
---

## particle-frames overview

One sprite region of a particle texture (an atlas), in normalized texture coordinates with the
origin at the image's top-left corner and `y` going down, like the image file itself: `x`/`y` is
the region's top-left corner, `width`/`height` its size, each from `0` to `1`. Regions may differ
in size and aspect; the drawn quad's size comes from the particle (`Particle.size`), so give a
non-square region a non-square particle size to keep its aspect.

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [FULL_PARTICLE_FRAME](#full_particle_frame)
  - [ParticleFrame (type alias)](#particleframe-type-alias)
  - [ParticleFrames (class)](#particleframes-class)
    - [grid (static method)](#grid-static-method)
    - [fromPixels (static method)](#frompixels-static-method)

---

# utils

## FULL_PARTICLE_FRAME

The whole texture as one frame - the default when a system defines no `frames`.

**Signature**

```ts
export declare const FULL_PARTICLE_FRAME: ParticleFrame
```

## ParticleFrame (type alias)

One sprite region of a particle texture (an atlas), in normalized texture coordinates with the
origin at the image's top-left corner and `y` going down, like the image file itself: `x`/`y` is
the region's top-left corner, `width`/`height` its size, each from `0` to `1`. Regions may differ
in size and aspect; the drawn quad's size comes from the particle (`Particle.size`), so give a
non-square region a non-square particle size to keep its aspect.

**Signature**

```ts
export type ParticleFrame = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
```

## ParticleFrames (class)

Helpers building `ParticleFrame` lists.

**Signature**

```ts
export declare class ParticleFrames
```

### grid (static method)

The cells of a uniform grid atlas, row by row from the top-left one.

**Signature**

```ts
static grid(columns: number, rows: number, count: number = columns * rows): ParticleFrame[]
```

### fromPixels (static method)

Regions given in pixels of a texture of `textureWidth` x `textureHeight` pixels, e.g. sprites of
different sizes packed into one atlas.

**Signature**

```ts
static fromPixels(
    regions: readonly { x: number; y: number; width: number; height: number }[],
    textureWidth: number,
    textureHeight: number,
  ): ParticleFrame[]
```
