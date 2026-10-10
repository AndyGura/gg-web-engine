---
title: core/2d/entities/particle-system-2d.entity.ts
nav_order: 36
parent: Modules
---

## particle-system-2d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ParticleSystem2dEntity (class)](#particlesystem2dentity-class)
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
  - [ParticleSystem2dOptions (type alias)](#particlesystem2doptions-type-alias)

---

# utils

## ParticleSystem2dEntity (class)

A 2D particle system: sprites spawned by the app or by a rate/bursts, simulated in core
(`ParticleSimulation`, available as {@link simulation}) and drawn by the visual adapter's
`IParticleSystem2dComponent`. Create one with `Gg2dWorld.addParticleSystem`, or construct it
around `visualScene.factory.createParticleSystem(...)` and add it to a world.

Runs on the world clock (it pauses with the world), once per world tick right before rendering,
or in fixed steps with `fixedTimeStep`. The emitter is this entity's `position`/`rotation`, or
follows another entity (`attachTo`) with a local `offset`; particles are spawned in world space
and stay there (or move with the emitter, with `space: 'local'`). Sizes and speeds are in world
units, and a particle's `rotation` uses the 2D world's own rotation sign.

```ts
const sparks = world.addParticleSystem(
  { capacity: 100, texture, blending: 'additive', zIndex: 5 },
  { lifetime: [0.3, 0.6], size: 6, gravity: { x: 0, y: 600 }, opacityOverLife: [1, 0] }
)
sparks.emit(12, (p, ctx) => {
  p.position = coin.position
  p.velocity = Pnt2.rot({ x: ctx.range(100, 200), y: 0 }, ctx.random() * Math.PI * 2)
})
```

**Signature**

```ts
export declare class ParticleSystem2dEntity<VTypeDoc, T> {
  constructor(public readonly particleSystem: VTypeDoc['particleSystem'], options: ParticleSystem2dOptions<T> = {})
}
```

### attachTo (method)

Makes the emitter follow `target` (an entity, or anything with a `position` and `rotation`), at
`offset` in the target's frame. Particles already spawned are not affected (in world space).

**Signature**

```ts
public attachTo(target: IPositionable2d, offset: Point2 = Pnt2.O): void
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
public emit(count: number, init?: ParticleInit<Point2, T>): number
```

### forEachParticle (method)

Calls `callback` for every live particle, oldest first.

**Signature**

```ts
public forEachParticle(callback: (particle: Particle<Point2, T>) => void): void
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
private pointToSim(local: Point2): MutablePoint2
```

### directionToSim (method)

**Signature**

```ts
private directionToSim(local: Point2): MutablePoint2
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
```

### simulation (property)

**Signature**

```ts
readonly simulation: ParticleSimulation<Readonly<MutablePoint2>, T>
```

## ParticleSystem2dOptions (type alias)

Settings of a `ParticleSystem2dEntity`: the simulation (see `ParticleSimulationOptions` - every
duration in seconds) plus where the emitter is.

**Signature**

```ts
export type ParticleSystem2dOptions<T = any> = ParticleSimulationOptions<Point2, T> & {
  /**
   * Something to follow (any entity, or anything with a `position` and `rotation`): the emitter sits
   * at `offset` in its frame, re-read on every tick and on every `emit()` call. Can be changed later
   * with `attachTo()`/`detach()`.
   */
  attachTo?: IPositionable2d | null
  /** The emitter's position in the frame of `attachTo`. Default: its origin. */
  offset?: Point2
}
```
