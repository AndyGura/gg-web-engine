---
title: core/base/entities/gg-positionable-entity.ts
nav_order: 44
parent: Modules
---

## gg-positionable-entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgPositionableEntity (class)](#ggpositionableentity-class)
    - [getDefaultPosition (method)](#getdefaultposition-method)
    - [getDefaultRotation (method)](#getdefaultrotation-method)
    - [getDefaultScale (method)](#getdefaultscale-method)
    - [onSpawned (method)](#onspawned-method)
    - [\_position$ (property)](#_position-property)
    - [\_rotation$ (property)](#_rotation-property)
    - [\_scale$ (property)](#_scale-property)

---

# utils

## GgPositionableEntity (class)

**Signature**

```ts
export declare class GgPositionableEntity<D, R> {
  protected constructor()
}
```

### getDefaultPosition (method)

**Signature**

```ts
abstract getDefaultPosition(): D;
```

### getDefaultRotation (method)

**Signature**

```ts
abstract getDefaultRotation(): R;
```

### getDefaultScale (method)

**Signature**

```ts
abstract getDefaultScale(): D;
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: GgWorld<D, R>)
```

### \_position$ (property)

**Signature**

```ts
readonly _position$: any
```

### \_rotation$ (property)

**Signature**

```ts
readonly _rotation$: any
```

### \_scale$ (property)

**Signature**

```ts
readonly _scale$: any
```
