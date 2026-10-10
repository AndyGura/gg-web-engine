---
title: core/base/particles/particle.ts
nav_order: 173
parent: Modules
---

## particle overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MutableParticleVector (type alias)](#mutableparticlevector-type-alias)
  - [Particle (class)](#particle-class)
    - [kill (method)](#kill-method)
    - [alive (property)](#alive-property)
    - [serial (property)](#serial-property)
    - [drag (property)](#drag-property)
    - [age (property)](#age-property)
    - [lifetime (property)](#lifetime-property)
    - [steps (property)](#steps-property)
    - [opacity (property)](#opacity-property)
    - [rotation (property)](#rotation-property)
    - [angularVelocity (property)](#angularvelocity-property)
    - [tint (property)](#tint-property)
    - [frame (property)](#frame-property)
    - [frameSequence (property)](#framesequence-property)
    - [frameDuration (property)](#frameduration-property)
    - [frameLoop (property)](#frameloop-property)
    - [shaderData (property)](#shaderdata-property)
    - [data (property)](#data-property)
  - [copyParticleVector](#copyparticlevector)
  - [normalizedAge](#normalizedage)
  - [zeroParticleVector](#zeroparticlevector)

---

# utils

## MutableParticleVector (type alias)

The mutable vector type matching `D`: `MutablePoint3` for `Point3`, `MutablePoint2` for `Point2`.

**Signature**

```ts
export type MutableParticleVector<D extends Point2 | Point3> = D extends Point3 ? MutablePoint3 : MutablePoint2
```

## Particle (class)

One particle of a `ParticleSimulation`. Particles are pooled: the simulation creates `capacity` of
them up front and reuses them, so an init/update callback must never keep a reference to one past
its death (check {@link alive}, or compare {@link serial}).

Every duration is in seconds, every speed in world units per second. Vectors are live objects:
`p.position.z += 1` works, and assigning one (`p.position = somePoint`) copies its components, so
the assigned object can be reused by the caller freely.

What gets drawn each frame is the particle's own value multiplied by the system's curve over the
normalized age (`sizeOverLife`, `opacityOverLife`) when one is set. An app reproducing an effect
literally can leave the curves unset and drive every field from the update callback instead.

**Signature**

```ts
export declare class Particle<D, T> {
  constructor(
    /** The particle's slot in the simulation's pool, `0` to `capacity - 1`. Stable while it is alive. */
    public readonly index: number,
    dimensions: 2 | 3
  )
}
```

### kill (method)

Removes this particle; it is no longer drawn from the next render on.

**Signature**

```ts
public kill(): void
```

### alive (property)

Whether this particle is currently simulated and drawn.

**Signature**

```ts
alive: boolean
```

### serial (property)

Increases by one with every particle the simulation spawns: older particles have smaller values.
A reused pool slot gets a new serial, so `(particle, serial)` identifies one particle's life.

**Signature**

```ts
serial: number
```

### drag (property)

Linear drag per second: every step multiplies the velocity by `exp(-drag * dt)`. A per-step
factor `k` of an original running at fixed steps of `dt` seconds is `drag = -ln(k) / dt`.

**Signature**

```ts
drag: number
```

### age (property)

Seconds since spawn.

**Signature**

```ts
age: number
```

### lifetime (property)

Seconds this particle lives; it dies on the step its age reaches this. `Infinity`: until killed.

**Signature**

```ts
lifetime: number
```

### steps (property)

How many simulation steps this particle has been through - an exact tick counter for fixed-step logic.

**Signature**

```ts
steps: number
```

### opacity (property)

Opacity from `0` to `1`. Multiplied by the system's `opacityOverLife` curve when one is set.

**Signature**

```ts
opacity: number
```

### rotation (property)

Rotation of the sprite in its own plane, radians: counter-clockwise as seen by the viewer in a
3D system; in a 2D system the world's own rotation sign (as `rotation` of any 2D display object).

**Signature**

```ts
rotation: number
```

### angularVelocity (property)

Radians per second added to {@link rotation}.

**Signature**

```ts
angularVelocity: number
```

### tint (property)

RGB color as `0xRRGGBB`, multiplied with the texture (`0xffffff`: untinted).

**Signature**

```ts
tint: number
```

### frame (property)

Index into the system's `frames` (the atlas regions) to draw. Overwritten every step while
{@link frameSequence} is set; set it directly (e.g. from the update callback) otherwise.

**Signature**

```ts
frame: number
```

### frameSequence (property)

Frames to play over this particle's life, as indices into the system's `frames`. `null`: no
animation, {@link frame} is left alone.

**Signature**

```ts
frameSequence: readonly number[] | null
```

### frameDuration (property)

Seconds each frame of {@link frameSequence} is shown. `0`: the sequence is spread evenly over
the particle's lifetime.

**Signature**

```ts
frameDuration: number
```

### frameLoop (property)

Whether {@link frameSequence} starts over after its last frame, instead of holding it.

**Signature**

```ts
frameLoop: boolean
```

### shaderData (property)

Four free numbers copied to the render buffers' `extra` array (`instanceExtra` in the three.js
adapter), for a custom material/shader. The built-in materials ignore them.

**Signature**

```ts
readonly shaderData: [number, number, number, number]
```

### data (property)

The app's own per-particle state. Reset to `undefined` when the particle is spawned.

**Signature**

```ts
data: T | undefined
```

## copyParticleVector

Copies `source` into `target` in place: `x`/`y`, and `z` when `target` has one (a 3D vector).

**Signature**

```ts
export declare function copyParticleVector(target: MutablePoint2 | MutablePoint3, source: Point2 | Point3): void
```

## normalizedAge

**Signature**

```ts
export declare function normalizedAge(age: number, lifetime: number): number
```

## zeroParticleVector

A zero vector of the given dimension count.

**Signature**

```ts
export declare function zeroParticleVector<D extends Point2 | Point3>(dimensions: 2 | 3): MutableParticleVector<D>
```
