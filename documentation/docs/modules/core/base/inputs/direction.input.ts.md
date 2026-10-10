---
title: core/base/inputs/direction.input.ts
nav_order: 138
parent: Modules
---

## direction.input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AnalogDirection (type alias)](#analogdirection-type-alias)
  - [DirectionInput (class)](#directioninput-class)
    - [setAnalogDirection (method)](#setanalogdirection-method)
    - [updateDirection (method)](#updatedirection-method)
    - [startInternal (method)](#startinternal-method)
    - [stopInternal (method)](#stopinternal-method)
  - [DirectionKeyboardOutput (type alias)](#directionkeyboardoutput-type-alias)
  - [DirectionKeymap (type alias)](#directionkeymap-type-alias)

---

# utils

## AnalogDirection (type alias)

One analog contribution to a `DirectionInput`'s `direction$` - see
`DirectionInput.setAnalogDirection`. An omitted axis contributes nothing.

**Signature**

```ts
export type AnalogDirection = { x?: number; y?: number }
```

## DirectionInput (class)

An input for a direction, whatever device it comes from. `direction$` reports it as a vector,
combined from two kinds of sources:

- direction keys of a keyboard, in the two most popular layouts: WASD and arrows;
- analog contributions from anything else that can point in a direction (an on-screen stick, a
  tilt sensor, a gamepad), set through `setAnalogDirection`.

Created without a keyboard or a keymap it takes analog contributions only.

**Signature**

```ts
export declare class DirectionInput {
  constructor(
    protected readonly keyboard: KeyboardInput | null = null,
    protected readonly keymap: DirectionKeymap | null = 'wasd+arrows'
  )
}
```

### setAnalogDirection (method)

Sets (or, with `null`, withdraws) one source's analog contribution to `direction$`. `source` is
any value identifying the caller, typically the object doing the call: every source has one
contribution, replaced by its next call. Ignored while the input is not running; stopping the
input withdraws every contribution.

**Signature**

```ts
public setAnalogDirection(source: unknown, value: AnalogDirection | null): void
```

### updateDirection (method)

**Signature**

```ts
private updateDirection(): void
```

### startInternal (method)

Called when the input handling should start.

**Signature**

```ts
protected startInternal()
```

### stopInternal (method)

**Signature**

```ts
protected stopInternal()
```

## DirectionKeyboardOutput (type alias)

The value of `DirectionInput.output$`: which way the direction keys point. An axis is `undefined`
while neither (or both) of its keys is held; `upDown` is `true` for up, `leftRight` for left

**Signature**

```ts
export type DirectionKeyboardOutput = { upDown?: boolean; leftRight?: boolean }
```

## DirectionKeymap (type alias)

Which keys a `DirectionInput` reads

**Signature**

```ts
export type DirectionKeymap = 'arrows' | 'wasd' | 'wasd+arrows'
```
