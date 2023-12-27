---
title: core/3d/entities/controllers/input/car-keyboard-handling.controller.ts
nav_order: 39
parent: Modules
---

## car-keyboard-handling.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CarHandlingOutput (type alias)](#carhandlingoutput-type-alias)
  - [CarKeyboardControllerOptions (type alias)](#carkeyboardcontrolleroptions-type-alias)
  - [CarKeyboardHandlingController (class)](#carkeyboardhandlingcontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)
    - [directionsInput (property)](#directionsinput-property)

---

# utils

## CarHandlingOutput (type alias)

**Signature**

```ts
export type CarHandlingOutput = { upDown: number; leftRight: number }
```

## CarKeyboardControllerOptions (type alias)

**Signature**

```ts
export type CarKeyboardControllerOptions = {
  readonly keymap: DirectionKeyboardKeymap
  readonly maxSteerDeltaPerSecond: number
}
```

## CarKeyboardHandlingController (class)

**Signature**

```ts
export declare class CarKeyboardHandlingController {
  constructor(
    protected readonly keyboard: KeyboardInput,
    protected readonly options: CarKeyboardControllerOptions = {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
    }
  )
}
```

### onSpawned (method)

**Signature**

```ts
async onSpawned(world: GgWorld<any, any>): Promise<void>
```

### onRemoved (method)

**Signature**

```ts
async onRemoved(): Promise<void>
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.INPUT_CONTROLLERS
```

### directionsInput (property)

**Signature**

```ts
readonly directionsInput: DirectionKeyboardInput
```
