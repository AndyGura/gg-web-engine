---
title: core/3d/components/rendering/i-particle-system-3d.component.ts
nav_order: 62
parent: Modules
---

## i-particle-system-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IParticleSystem3dComponent (interface)](#iparticlesystem3dcomponent-interface)
  - [ParticleSystem3dRenderOptions (type alias)](#particlesystem3drenderoptions-type-alias)

---

# utils

## IParticleSystem3dComponent (interface)

The drawing half of a 3D particle system, created by `IDisplayObject3dComponentFactory
.createParticleSystem` and driven by `ParticleSystem3dEntity` (which owns the simulation, in core,
so every adapter draws exactly the same particles). One draw call per system: an adapter renders
every particle as a textured, camera-facing quad (see `ParticleSystem3dRenderOptions.billboard`),
reading `ParticleRenderBuffers` - sprite center, width and height, rotation, tint and opacity,
atlas region. The quads never cast or receive shadows.

As a display object it has a position and rotation: particle positions are relative to them.
`ParticleSystem3dEntity` keeps them at the origin for a world-space system and moves them with the
emitter for a local-space one. Render layers apply as to any display object.

**Signature**

```ts
export interface IParticleSystem3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IDisplayObject3dComponent<VTypeDoc> {
  /** Most particles drawn at once (`renderOptions.capacity`). */
  readonly capacity: number

  /** The options this system was created with (`texture` reflects later changes). */
  readonly renderOptions: Readonly<ParticleSystem3dRenderOptions<VTypeDoc['texture']>>

  /** The sprite texture or atlas; `null` draws plain tinted quads. Can be swapped at any time. */
  texture: VTypeDoc['texture'] | null

  /**
   * Draws the first `buffers.count` particles of `buffers` from now on. `ParticleSystem3dEntity`
   * calls it once per world tick, after simulating; the arrays are reused from tick to tick, so an
   * adapter may keep the reference and read them whenever it draws (e.g. to sort for each camera).
   * `buffers.capacity` must not exceed {@link capacity}.
   */
  setParticles(buffers: ParticleRenderBuffers): void

  /** A new, empty system with the same render options (sharing the texture), not added to any world. */
  clone(): IParticleSystem3dComponent<VTypeDoc>
}
```

## ParticleSystem3dRenderOptions (type alias)

How a 3D particle system is drawn, given to `IDisplayObject3dComponentFactory.createParticleSystem`
(merged there with the adapter's own `particleSystemExtraOpts`, e.g. a custom material).

**Signature**

```ts
export type ParticleSystem3dRenderOptions<Tex = unknown> = ParticleSystemRenderOptions<Tex> & {
  /**
   * `'camera'` (default): every sprite faces the camera, parallel to the screen. `'vertical'`: sprites
   * turn only around the world's vertical (`Z`) axis to face the camera, and stay upright - smoke
   * columns, flames, trees.
   */
  billboard?: 'camera' | 'vertical'
  /** Whether sprites are hidden behind nearer geometry. Default `true`. */
  depthTest?: boolean
  /** Whether sprites write depth, hiding what is drawn after them. Default `false`. */
  depthWrite?: boolean
  /**
   * Whether the system's particles are drawn back to front from each camera's point of view, which
   * `'normal'` blending needs to look right. Order-independent modes (`'additive'`) can turn it off
   * to save the sort. Default `true`. Separate systems are ordered by the renderer, not by this.
   */
  sort?: boolean
  /** Whether scene fog applies to the sprites. Default `true`. */
  fog?: boolean
  /** Draw order among transparent objects: higher is drawn later (on top). Default `0`. */
  renderOrder?: number
}
```
