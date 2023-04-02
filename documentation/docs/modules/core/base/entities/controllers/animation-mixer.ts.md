---
title: core/base/entities/controllers/animation-mixer.ts
nav_order: 44
parent: Modules
---

## animation-mixer overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AnimationFunction (type alias)](#animationfunction-type-alias)
  - [AnimationMixer (class)](#animationmixer-class)
    - [transitFromStaticState (method)](#transitfromstaticstate-method)
    - [transitAnimationFunction (method)](#transitanimationfunction-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tick$ (property)](#tick-property)
    - [tickOrder (property)](#tickorder-property)
    - [\_value$ (property)](#_value-property)
    - [removed$ (property)](#removed-property)

---

# utils

## AnimationFunction (type alias)

**Signature**

```ts
export type AnimationFunction<T> = (elapsed: number, delta: number) => T
```

## AnimationMixer (class)

A class that performs property animations for a specific type `T` by using provided animation function.
Supports smooth transition between animation function by interpolating between values over time.
The current value of the animation can be subscribed to using the `subscribeToValue` property.
The animation function can be changed with `transitAnimationFunction` or `transitFromStaticState`.

**Signature**

```ts
export declare class AnimationMixer<T> {
  constructor(
    protected _animationFunction: AnimationFunction<T>,
    protected _lerp: (a: T, b: T, t: number) => T = (a, b, t) => b
  )
}
```

### transitFromStaticState (method)

Set output to static value and smoothly transit to new control function

**Signature**

```ts
transitFromStaticState(
    state: T,
    newFunc: AnimationFunction<T>,
    transitionDuration: number,
    easing: (t: number) => number = x => x,
  )
```

### transitAnimationFunction (method)

Smoothly transit to new control function

**Signature**

```ts
transitAnimationFunction(
    newFunc: AnimationFunction<T>,
    transitionDuration: number,
    easing: (t: number) => number = x => x,
  )
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: GgWorld<any, any>)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### tick$ (property)

**Signature**

```ts
readonly tick$: any
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
```

### \_value$ (property)

A subject that emits the current value of the animation on every tick.

**Signature**

```ts
readonly _value$: any
```

### removed$ (property)

A subject that emits when the animator has been removed from the world.

**Signature**

```ts
readonly removed$: any
```
