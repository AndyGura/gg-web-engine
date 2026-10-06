---
title: core/3d/entities/controllers/input/car-handling.controller.ts
nav_order: 68
parent: Modules
---

## car-handling.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CarHandlingController (class)](#carhandlingcontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)
    - [directionsInput (property)](#directionsinput-property)
  - [CarHandlingControllerOptions (type alias)](#carhandlingcontrolleroptions-type-alias)
  - [CarHandlingOutput (type alias)](#carhandlingoutput-type-alias)

---

# utils

## CarHandlingController (class)

**Signature**

```ts
export declare class CarHandlingController {
  constructor(
    public readonly keyboard: KeyboardInput,
    public readonly options: CarHandlingControllerOptions = {
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
readonly directionsInput: DirectionInput
```

## CarHandlingControllerOptions (type alias)

**Signature**

```ts
export type CarHandlingControllerOptions = {
  readonly keymap: DirectionKeymap
  readonly maxSteerDeltaPerSecond: number
}
```

## CarHandlingOutput (type alias)

**Signature**

```ts
export type CarHandlingOutput = { upDown: number; leftRight: number }
```
