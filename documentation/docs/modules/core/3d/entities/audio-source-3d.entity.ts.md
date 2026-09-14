---
title: core/3d/entities/audio-source-3d.entity.ts
nav_order: 46
parent: Modules
---

## audio-source-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AudioSource3dEntity (class)](#audiosource3dentity-class)
    - [playOneShot (static method)](#playoneshot-static-method)
    - [play (method)](#play-method)
    - [pause (method)](#pause-method)
    - [stop (method)](#stop-method)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## AudioSource3dEntity (class)

Wraps one `IAudioSource3dComponent` as a world entity - the audio analogue of `Entity3d`. Three
placement modes, all built from the same class:

- **Static**: construct with no `attachTo`. Position/rotation are whatever `source` already has
  (or whatever's set on the returned entity afterwards) - never touched again.
- **Attached**: construct with `attachTo` (any `IPositionable3d` - typically another entity).
  Position/rotation are copied from it every tick, so the sound rides that target around (a car
  engine, machinery hum).
- **Transient**: {@link playOneShot} - plays once and removes+disposes itself from the world the
  moment playback ends. The app never has to hold a reference past the call.

**Signature**

```ts
export declare class AudioSource3dEntity<TypeDoc> {
  constructor(public readonly source: TypeDoc['aTypeDoc']['source'], private readonly attachTo?: IPositionable3d | null)
}
```

### playOneShot (static method)

Spawn a transient, self-disposing one-shot sound at a fixed position: creates the source,
adds a new `AudioSource3dEntity` to `world`, plays it, and removes+disposes it the moment
playback ends. The returned entity is only useful for advanced cases (e.g. stopping it early)

- normally nothing needs to hold onto it.

**Signature**

```ts
public static playOneShot<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo>(
    world: Gg3dWorld<TypeDoc>,
    descriptor: AudioSourceDescriptor<TypeDoc['aTypeDoc']['clip']>,
    position: Point3,
    rotation: Point4 = Qtrn.O,
  ): AudioSource3dEntity<TypeDoc>
```

### play (method)

**Signature**

```ts
public play(): void
```

### pause (method)

**Signature**

```ts
public pause(): void
```

### stop (method)

**Signature**

```ts
public stop(): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
```
