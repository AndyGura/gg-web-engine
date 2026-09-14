---
title: core/2d/entities/audio-source-2d.entity.ts
nav_order: 21
parent: Modules
---

## audio-source-2d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AudioSource2dEntity (class)](#audiosource2dentity-class)
    - [playOneShot (static method)](#playoneshot-static-method)
    - [play (method)](#play-method)
    - [pause (method)](#pause-method)
    - [stop (method)](#stop-method)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## AudioSource2dEntity (class)

2D counterpart of `AudioSource3dEntity` - see that class's doc for the three placement modes
(static/attached/transient). `rotation` is a plain angle (radians), same convention as
`Entity2d`.

**Signature**

```ts
export declare class AudioSource2dEntity<TypeDoc> {
  constructor(public readonly source: TypeDoc['aTypeDoc']['source'], private readonly attachTo?: IPositionable2d | null)
}
```

### playOneShot (static method)

Spawn a transient, self-disposing one-shot sound at a fixed position - see
`AudioSource3dEntity.playOneShot`'s doc for the full contract.

**Signature**

```ts
public static playOneShot<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo>(
    world: Gg2dWorld<TypeDoc>,
    descriptor: AudioSourceDescriptor<TypeDoc['aTypeDoc']['clip']>,
    position: Point2,
    rotation: number = 0,
  ): AudioSource2dEntity<TypeDoc>
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
