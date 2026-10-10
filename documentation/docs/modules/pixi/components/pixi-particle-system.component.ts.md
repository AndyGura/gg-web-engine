---
title: pixi/components/pixi-particle-system.component.ts
nav_order: 198
parent: Modules
---

## pixi-particle-system.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiParticleSystemComponent (class)](#pixiparticlesystemcomponent-class)
    - [setParticles (method)](#setparticles-method)
    - [frameTexture (method)](#frametexture-method)
    - [disposeFrameTextures (method)](#disposeframetextures-method)
    - [clone (method)](#clone-method)
    - [popChild (method)](#popchild-method)
    - [dispose (method)](#dispose-method)
    - [nativeSprite (property)](#nativesprite-property)
    - [capacity (property)](#capacity-property)
  - [PixiParticleSystemExtraOpts (type alias)](#pixiparticlesystemextraopts-type-alias)

---

# utils

## PixiParticleSystemComponent (class)

The pixi.js `IParticleSystem2dComponent`: a `ParticleContainer` whose `particleChildren` are
`capacity` pooled plain `IParticle` records, refilled from core's `ParticleRenderBuffers` on every
`setParticles` - position, scale (the particle's size in world units over the frame's size in
pixels), rotation, packed tint and opacity, and the atlas region as a sub-texture of the system's
texture (one `Texture` per distinct region, created on demand and shared by every particle
showing it). Every property is dynamic, so the container re-uploads them each frame. The
container's own `tint`/`opacity` multiply the particles' (inherited, like any pixi container).

pixi's `ParticleContainer` never computes bounds itself, so `getBoundings` reports whatever
`nativeSprite.boundsArea` was set to (an empty box by default).

**Signature**

```ts
export declare class PixiParticleSystemComponent {
  constructor(options: ParticleSystem2dRenderOptions<Texture> & PixiParticleSystemExtraOpts)
}
```

### setParticles (method)

**Signature**

```ts
setParticles(buffers: ParticleRenderBuffers): void
```

### frameTexture (method)

The sub-texture of the system's texture showing the atlas region (normalized, top-left origin),
the texture itself for the whole image.

**Signature**

```ts
private frameTexture(x: number, y: number, width: number, height: number): Texture
```

### disposeFrameTextures (method)

**Signature**

```ts
private disposeFrameTextures(): void
```

### clone (method)

**Signature**

```ts
clone(): PixiParticleSystemComponent
```

### popChild (method)

**Signature**

```ts
popChild(): null
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### nativeSprite (property)

**Signature**

```ts
readonly nativeSprite: ParticleContainer<IParticle>
```

### capacity (property)

**Signature**

```ts
readonly capacity: number
```

## PixiParticleSystemExtraOpts (type alias)

pixi.js-only particle system options, merged into `ParticleSystem2dRenderOptions` when creating a
system (`factory.createParticleSystem` / `world.addParticleSystem`).

**Signature**

```ts
export type PixiParticleSystemExtraOpts = {
  /** Whether sprite positions are rounded to whole pixels (crisp pixel art). Default `false`. */
  roundPixels?: boolean
}
```
