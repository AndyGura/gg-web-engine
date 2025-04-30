---
title: core/base/inputs/direction.keyboard.input.ts
nav_order: 80
parent: Modules
---

## direction.keyboard.input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [DirectionKeyboardInput (class)](#directionkeyboardinput-class)
    - [startInternal (method)](#startinternal-method)
  - [DirectionKeyboardKeymap (type alias)](#directionkeyboardkeymap-type-alias)
  - [DirectionKeyboardOutput (type alias)](#directionkeyboardoutput-type-alias)

---

# utils

## DirectionKeyboardInput (class)

An input class, responsible for handling direction keys and providing simple current direction observable.
Supports two the most popular keyboard layouts: WASD and arrows.

**Signature**

```ts
export declare class DirectionKeyboardInput {
  constructor(protected readonly keyboard: KeyboardInput, protected readonly keymap: DirectionKeyboardKeymap)
}
```

### startInternal (method)

Called when the input handling should start.

**Signature**

```ts
protected startInternal()
```

## DirectionKeyboardKeymap (type alias)

The type representing desired keymap for DirectionKeyboardInput

**Signature**

```ts
export type DirectionKeyboardKeymap = 'arrows' | 'wasd' | 'wasd+arrows'
```

## DirectionKeyboardOutput (type alias)

The type of DirectionKeyboardInput output value

**Signature**

```ts
export type DirectionKeyboardOutput = { upDown?: boolean; leftRight?: boolean }
```
