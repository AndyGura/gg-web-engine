---
title: core/3d/entities/particle-system-3d.entity.ts
nav_order: 85
parent: Modules
---

## particle-system-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ParticleSystem3dEntity (class)](#particlesystem3dentity-class)
    - [attachTo (method)](#attachto-method)
    - [detach (method)](#detach-method)
    - [emit (method)](#emit-method)
    - [forEachParticle (method)](#foreachparticle-method)
    - [clear (method)](#clear-method)
    - [update (method)](#update-method)
    - [updateVisibility (method)](#updatevisibility-method)
    - [syncAttachment (method)](#syncattachment-method)
    - [applyLocalSpaceTransform (method)](#applylocalspacetransform-method)
    - [pointToSim (method)](#pointtosim-method)
    - [directionToSim (method)](#directiontosim-method)
    - [tickOrder (property)](#tickorder-property)
    - [simulation (property)](#simulation-property)
  - [ParticleSystem3dOptions (type alias)](#particlesystem3doptions-type-alias)

---

# utils

## ParticleSystem3dEntity (class)

A 3D particle system: sprites spawned by the app or by a rate/bursts, simulated in core
(`ParticleSimulation`, available as {@link simulation}) and drawn by the visual adapter's
`IParticleSystem3dComponent` in one draw call. Create one with `Gg3dWorld.addParticleSystem`, or
construct it around `visualScene.factory.createParticleSystem(...)` and add it to a world.

Runs on the world clock (it pauses with the world), once per world tick right before rendering,
or in fixed steps with `fixedTimeStep`. The emitter is this entity's `position`/`rotation`, or
follows another entity (`attachTo`) with a local `offset`; particles are spawned in world space
and stay there (or move with the emitter, with `space: 'local'`).

```ts
const smoke = world.addParticleSystem(
  { capacity: 200, texture, blending: 'normal' },
  { lifetime: [0.8, 1.2], opacityOverLife: [0.6, 0], sizeOverLife: [0.5, 2], gravity: { x: 0, y: 0, z: 0.4 } }
)
smoke.attachTo(car)
smoke.emit(1, (p, ctx) => {
  p.position = ctx.pointToSim(rearLeftWheel)
  p.size = { x: 0.75 * slide, y: 0.38 * slide }
})
```

**Signature**

```ts
export declare class ParticleSystem3dEntity<VTypeDoc, T> {
  constructor(public readonly particleSystem: VTypeDoc['particleSystem'], options: ParticleSystem3dOptions<T> = {})
}
```

### attachTo (method)

Makes the emitter follow `target` (an entity, or anything with a `position` and `rotation`), at
`offset` in the target's frame. Particles already spawned are not affected (in world space).

**Signature**

```ts
public attachTo(target: IPositionable3d, offset: Point3 = Pnt3.O): void
```

### detach (method)

Stops following the target; the emitter stays where it was.

**Signature**

```ts
public detach(): void
```

### emit (method)

Spawns up to `count` particles now (see `ParticleSimulation.emit`). Each starts at the emitter's
origin with the options' defaults; the options' `init`, then `init` given here, set it up. The
context's `pointToSim`/`directionToSim` map emitter-local points (relative to the attached
target, offset included) into the particles' space.

**Signature**

```ts
public emit(count: number, init?: ParticleInit<Point3, T>): number
```

### forEachParticle (method)

Calls `callback` for every live particle, oldest first.

**Signature**

```ts
public forEachParticle(callback: (particle: Particle<Point3, T>) => void): void
```

### clear (method)

Kills every particle.

**Signature**

```ts
public clear(): void
```

### update (method)

Advances the simulation by `delta` seconds and hands the result to the visual component. The
world calls it every tick; call it yourself only to drive a system outside of a world.

**Signature**

```ts
public update(delta: number): void
```

### updateVisibility (method)

**Signature**

```ts
public updateVisibility(): void
```

### syncAttachment (method)

**Signature**

```ts
private syncAttachment(): void
```

### applyLocalSpaceTransform (method)

**Signature**

```ts
private applyLocalSpaceTransform(): void
```

### pointToSim (method)

**Signature**

```ts
private pointToSim(local: Point3): MutablePoint3
```

### directionToSim (method)

**Signature**

```ts
private directionToSim(local: Point3): MutablePoint3
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
```

### simulation (property)

**Signature**

```ts
readonly simulation: ParticleSimulation<Readonly<MutablePoint3>, T>
```

## ParticleSystem3dOptions (type alias)

Settings of a `ParticleSystem3dEntity`: the simulation (see `ParticleSimulationOptions` - every
duration in seconds) plus where the emitter is.

**Signature**

```ts
export type ParticleSystem3dOptions<T = any> = ParticleSimulationOptions<Point3, T> & {
  /**
   * Something to follow (any entity, or anything with a `position` and `rotation`): the emitter sits
   * at `offset` in its frame, re-read on every tick and on every `emit()` call. Can be changed later
   * with `attachTo()`/`detach()`.
   */
  attachTo?: IPositionable3d | null
  /** The emitter's position in the frame of `attachTo`. Default: its origin. */
  offset?: Point3
}
```
