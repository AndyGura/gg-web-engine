---
title: core/2d/components/rendering/i-particle-system-2d.component.ts
nav_order: 23
parent: Modules
---

## i-particle-system-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IParticleSystem2dComponent (interface)](#iparticlesystem2dcomponent-interface)
  - [ParticleBlendMode2d (type alias)](#particleblendmode2d-type-alias)
  - [ParticleSystem2dRenderOptions (type alias)](#particlesystem2drenderoptions-type-alias)

---

# utils

## IParticleSystem2dComponent (interface)

The drawing half of a 2D particle system, created by `IDisplayObject2dComponentFactory
.createParticleSystem` and driven by `ParticleSystem2dEntity` (which owns the simulation, in core,
so every adapter draws exactly the same particles). An adapter draws every particle as one
textured quad, reading `ParticleRenderBuffers` - sprite center, width and height, rotation, tint
and opacity, atlas region - in spawn order (oldest first, so a newer particle is drawn on top).

As a display object it has a position and rotation: particle positions are relative to them.
`ParticleSystem2dEntity` keeps them at the origin for a world-space system and moves them with the
emitter for a local-space one. `tint` and `opacity` multiply every particle's own.

**Signature**

```ts
export interface IParticleSystem2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IDisplayObject2dComponent<VTypeDoc> {
  /** Most particles drawn at once (`renderOptions.capacity`). */
  readonly capacity: number

  /** The options this system was created with (`texture` reflects later changes). */
  readonly renderOptions: Readonly<ParticleSystem2dRenderOptions<VTypeDoc['texture']>>

  /** The sprite texture or atlas; `null` draws plain tinted quads. Can be swapped at any time. */
  texture: VTypeDoc['texture'] | null

  /**
   * Draws the first `buffers.count` particles of `buffers` from now on. `ParticleSystem2dEntity`
   * calls it once per world tick, after simulating; the arrays are reused from tick to tick, so an
   * adapter may keep the reference and read them whenever it draws. `buffers.capacity` must not
   * exceed {@link capacity}.
   */
  setParticles(buffers: ParticleRenderBuffers): void

  /** A new, empty system with the same render options (sharing the texture), not added to any world. */
  clone(): IParticleSystem2dComponent<VTypeDoc>
}
```

## ParticleBlendMode2d (type alias)

How a 2D particle sprite is combined with what is drawn behind it - the subset of
`ParticleBlendMode` every 2D renderer can do with its ordinary sprite blending: `'normal'`
(transparency), `'additive'` (light, fire, sparks) and `'multiply'` (darkening).

**Signature**

```ts
export type ParticleBlendMode2d = 'normal' | 'additive' | 'multiply'
```

## ParticleSystem2dRenderOptions (type alias)

How a 2D particle system is drawn, given to `IDisplayObject2dComponentFactory.createParticleSystem`
(merged there with the adapter's own `particleSystemExtraOpts`). Sprites are drawn as textured
quads of the particle's `size` in world units, rotated by its `rotation` (the 2D world's own
rotation sign, as for any display object), with the texture's alpha times the particle's opacity

- there is no per-texel alpha source or alpha test here, unlike in 3D.

**Signature**

```ts
export type ParticleSystem2dRenderOptions<Tex = unknown> = Omit<
  ParticleSystemRenderOptions<Tex>,
  'blending' | 'textureAlpha' | 'alphaTest'
> & {
  /** Default `'normal'`. */
  blending?: ParticleBlendMode2d
  /** Draw order among 2D display objects (see `IDisplayObject2dComponent.zIndex`). Default `0`. */
  zIndex?: number
}
```
