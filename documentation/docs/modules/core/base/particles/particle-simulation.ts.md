---
title: core/base/particles/particle-simulation.ts
nav_order: 172
parent: Modules
---

## particle-simulation overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ParticleBurst (type alias)](#particleburst-type-alias)
  - [ParticleEmitContext (interface)](#particleemitcontext-interface)
  - [ParticleEmitterTransform (interface)](#particleemittertransform-interface)
  - [ParticleInit (type alias)](#particleinit-type-alias)
  - [ParticleSimulation (class)](#particlesimulation-class)
    - [forEachParticle (method)](#foreachparticle-method)
    - [emit (method)](#emit-method)
    - [advance (method)](#advance-method)
    - [step (method)](#step-method)
    - [writeRenderBuffers (method)](#writerenderbuffers-method)
    - [clear (method)](#clear-method)
    - [restart (method)](#restart-method)
    - [resetBursts (method)](#resetbursts-method)
    - [copyOf (method)](#copyof-method)
    - [acquire (method)](#acquire-method)
    - [spawn (method)](#spawn-method)
    - [sequenceFrame (method)](#sequenceframe-method)
    - [compact (method)](#compact-method)
    - [buffers (property)](#buffers-property)
    - [time (property)](#time-property)
    - [timeScale (property)](#timescale-property)
    - [emitting (property)](#emitting-property)
    - [transform (property)](#transform-property)
  - [ParticleSimulationOptions (type alias)](#particlesimulationoptions-type-alias)
  - [ParticleUpdate (type alias)](#particleupdate-type-alias)

---

# utils

## ParticleBurst (type alias)

A repeated burst: `count` particles at `time` seconds of simulation time, then every `interval`
seconds, `cycles` times in all.

**Signature**

```ts
export type ParticleBurst = {
  readonly time: number
  readonly count: number
  /** Seconds between cycles. Default `0`: the cycles all fire at once (an infinite burst then fires once). */
  readonly interval?: number
  /** How many times the burst fires. Default `1`; `Infinity` repeats forever (with a positive `interval`). */
  readonly cycles?: number
}
```

## ParticleEmitContext (interface)

What an init callback gets besides the particle.

**Signature**

```ts
export interface ParticleEmitContext<D extends Point2 | Point3> {
  /** This particle's number within the current emission, `0` to `count - 1`. */
  readonly index: number
  /** How many particles the current emission asked for. */
  readonly count: number
  /** The emitter's origin in simulation space - also where the particle was placed before the callback. */
  readonly origin: D
  /** The simulation's time in seconds (see `ParticleSimulation.time`). */
  readonly time: number
  /** An emitter-local point in simulation space, e.g. a wheel's offset on a car the emitter is attached to. */
  pointToSim(local: D): MutableParticleVector<D>
  /** An emitter-local direction in simulation space, e.g. "backwards" on that car. */
  directionToSim(local: D): MutableParticleVector<D>
  /** The simulation's random source, a number in `[0, 1)`. */
  random(): number
  /** A random number in `[min, max)`. */
  range(min: number, max: number): number
}
```

## ParticleEmitterTransform (interface)

Where particles spawn: maps points and directions given in the emitter's own frame into the space
the particles live in. The entity owning a simulation provides it (from its position, rotation,
and the entity it is attached to).

**Signature**

```ts
export interface ParticleEmitterTransform<D extends Point2 | Point3> {
  /** An emitter-local point in simulation space. */
  pointToSim(local: D): MutableParticleVector<D>
  /** An emitter-local direction in simulation space (rotated, not moved). */
  directionToSim(local: D): MutableParticleVector<D>
}
```

## ParticleInit (type alias)

Sets up a spawned particle: position, velocity, size, lifetime, user data, ...

**Signature**

```ts
export type ParticleInit<D extends Point2 | Point3 = Point3, T = any> = (
  particle: Particle<D, T>,
  context: ParticleEmitContext<D>
) => void
```

## ParticleSimulation (class)

The dimension-agnostic particle simulation behind a particle system entity: a pool of `capacity`
particles, emission (manual, continuous, bursts), motion, aging, frame animation, curves, an
optional fixed step with interpolation, and writing the result into `ParticleRenderBuffers` for a
rendering adapter. It runs entirely in core, so a system behaves the same with every adapter.

Order within one step: live particles age (a particle whose age reaches its lifetime dies), move
(`velocity += (gravity + acceleration) * dt`, `velocity *= exp(-drag * dt)`,
`position += velocity * dt`, `rotation += angularVelocity * dt`), advance their frame sequence and
run the `update` callback; then `onStep` runs and `rate`/`bursts` spawn. A particle spawned during
a step, or by `emit()` between steps, is drawn first in its initial state and first moves in the
next step.

**Signature**

```ts
export declare class ParticleSimulation<D, T> {
  constructor(
    public readonly capacity: number,
    public readonly dimensions: 2 | 3,
    public readonly options: ParticleSimulationOptions<D, T> = {}
  )
}
```

### forEachParticle (method)

Calls `callback` for every live particle, oldest first.

**Signature**

```ts
public forEachParticle(callback: (particle: Particle<D, T>) => void): void
```

### emit (method)

Spawns up to `count` particles now. Each gets the defaults from the options, then the options'
`init`, then `init` given here.

**Signature**

```ts
public emit(count: number, init?: ParticleInit<D, T>): number
```

### advance (method)

Advances the simulation by `delta` seconds of world time (scaled by `timeScale`): one step of
that length, or as many `fixedTimeStep` steps as fit, carrying the rest over.

**Signature**

```ts
public advance(delta: number): number
```

### step (method)

Runs exactly one simulation step of `dt` seconds (see the class doc for what happens in it).

**Signature**

```ts
public step(dt: number): void
```

### writeRenderBuffers (method)

Writes the live particles, interpolated per `interpolationAlpha`, into {@link buffers} in spawn
order and returns them.

**Signature**

```ts
public writeRenderBuffers(): ParticleRenderBuffers
```

### clear (method)

Kills every particle.

**Signature**

```ts
public clear(): void
```

### restart (method)

Resets the simulation time to `0` and re-arms the bursts. With `clear`, kills every particle as well.

**Signature**

```ts
public restart(clear: boolean = false): void
```

### resetBursts (method)

**Signature**

```ts
private resetBursts(): void
```

### copyOf (method)

**Signature**

```ts
private copyOf(v: D): MutableParticleVector<D>
```

### acquire (method)

**Signature**

```ts
private acquire(): Particle<D, T> | null
```

### spawn (method)

**Signature**

```ts
private spawn(p: Particle<D, T>, origin: D): void
```

### sequenceFrame (method)

**Signature**

```ts
private sequenceFrame(p: Particle<D, T>): number
```

### compact (method)

drops dead particles from the live list, keeping spawn order, and returns them to the pool

**Signature**

```ts
private compact(): void
```

### buffers (property)

**Signature**

```ts
readonly buffers: ParticleRenderBuffers
```

### time (property)

Simulated seconds since creation or the last `restart()`. Burst times count from here.

**Signature**

```ts
time: number
```

### timeScale (property)

Multiplies the time `advance` is given: `0.5` is slow motion, `0` freezes the particles.

**Signature**

```ts
timeScale: number
```

### emitting (property)

Whether `rate` and `bursts` spawn particles.

**Signature**

```ts
emitting: boolean
```

### transform (property)

Maps emitter-local points/directions into simulation space; set by the entity owning the
simulation. Default: identity (the emitter at the origin).

**Signature**

```ts
transform: ParticleEmitterTransform<D>
```

## ParticleSimulationOptions (type alias)

What a particle system simulates and how. Every duration is in seconds and every speed in world
units per second (unlike the world's own `fixedPhysicsStep`, which is in milliseconds). Fields
marked "live" are read on every step, so changing them on `simulation.options` takes effect at
once; the others apply to particles spawned afterwards.

**Signature**

```ts
export type ParticleSimulationOptions<D extends Point2 | Point3 = Point3, T = any> = {
  /**
   * What happens when a particle is spawned while `capacity` are alive: `'replace-oldest'` (default)
   * reuses the oldest live particle, `'drop'` spawns nothing.
   */
  overflow?: 'replace-oldest' | 'drop'
  /**
   * `'world'` (default): particles live in world space, so they stay where they were emitted when the
   * emitter moves on - smoke left behind a car. `'local'`: positions, velocities and gravity are in
   * the emitter's own frame and the whole system moves and turns with it - a flame stuck to a car.
   */
  space?: 'world' | 'local'
  /** Live. Acceleration applied to every particle, units per second². Default none. */
  gravity?: D
  /** Default `Particle.drag` of a spawned particle. Default `0`. */
  drag?: number
  /** Default lifetime of a spawned particle in seconds: a number, or `[min, max]` for a random one. Default `1`. */
  lifetime?: number | readonly [number, number]
  /** Default size of a spawned particle in world units: a number for a square, or `{ x: width, y: height }`. Default `1`. */
  size?: number | Point2
  /** Default opacity of a spawned particle. Default `1`. */
  opacity?: number
  /** Default tint of a spawned particle, `0xRRGGBB`. Default `0xffffff`. */
  tint?: number
  /** Live. The regions of the texture particles can show, indexed by `Particle.frame`. Default: the whole texture. */
  frames?: readonly ParticleFrame[]
  /** Default `Particle.frameSequence`. */
  frameSequence?: readonly number[] | null
  /** Default `Particle.frameDuration`. */
  frameDuration?: number
  /** Default `Particle.frameLoop`. */
  frameLoop?: boolean
  /** Live. Multiplies the drawn size over the normalized age: one curve for both axes, or one per axis. */
  sizeOverLife?: ParticleCurve | { readonly x: ParticleCurve; readonly y: ParticleCurve }
  /** Live. Multiplies the drawn opacity over the normalized age. */
  opacityOverLife?: ParticleCurve
  /**
   * Live. Runs for every spawned particle - continuous, burst, and `emit()` ones - after the
   * defaults above are applied and before the init passed to `emit()`.
   */
  init?: ParticleInit<D, T>
  /** Live. Per-particle custom behaviour, see `ParticleUpdate`. */
  update?: ParticleUpdate<D, T>
  /** Live. Particles spawned per second while `emitting`. Default `0`. */
  rate?: number
  /** Bursts while `emitting`, timed by simulation time (see `ParticleSimulation.restart`). */
  bursts?: readonly ParticleBurst[]
  /** Whether `rate` and `bursts` spawn particles. Default `true`. `emit()` always works. */
  emitting?: boolean
  /**
   * Live. Runs once per simulation step, after the live particles have moved, with the step in
   * seconds: emit here to spawn particles in lockstep with the simulation (with `fixedTimeStep`,
   * exactly like an original game's tick did).
   */
  onStep?: (dt: number, simulation: ParticleSimulation<D, T>) => void
  /**
   * Simulate in fixed steps of this many seconds (e.g. `1 / 30` to mirror a 30 Hz original) instead
   * of one step per world tick. Leftover time carries over to the next tick. Default: off.
   */
  fixedTimeStep?: number
  /** With `fixedTimeStep`: most steps per tick; time beyond them is dropped. Default `8`. */
  maxStepsPerTick?: number
  /**
   * With `fixedTimeStep`: draw particles between their last two steps (position, size, opacity,
   * rotation and the curves' age), so a 30 Hz simulation moves smoothly on a faster display. `false`
   * shows each step's state as is, stepping like the original. Default `true`. Frames and tint are
   * never interpolated.
   */
  interpolate?: boolean
  /** Random source in `[0, 1)` for every random choice of the simulation. Default `Math.random`. */
  random?: () => number
}
```

## ParticleUpdate (type alias)

Runs for every live particle on every simulation step, after the built-in motion, aging and frame
animation. May change any field, or `kill()` the particle. `dt` is the step in seconds.

**Signature**

```ts
export type ParticleUpdate<D extends Point2 | Point3 = Point3, T = any> = (
  particle: Particle<D, T>,
  dt: number,
  simulation: ParticleSimulation<D, T>
) => void
```
