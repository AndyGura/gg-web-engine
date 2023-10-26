---
title: core/3d/entities/controllers/input/car-keyboard-handling.controller.ts
nav_order: 37
parent: Modules
---

## car-keyboard-handling.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CarKeyboardControllerOptions (type alias)](#carkeyboardcontrolleroptions-type-alias)
  - [CarKeyboardHandlingController (class)](#carkeyboardhandlingcontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)
    - [directionsInput (property)](#directionsinput-property)
    - [x$ (property)](#x-property)
    - [y$ (property)](#y-property)
    - [lastX (property)](#lastx-property)
    - [switchingGearsEnabled (property)](#switchinggearsenabled-property)
    - [pairTickerPipe (property)](#pairtickerpipe-property)

---

# utils

## CarKeyboardControllerOptions (type alias)

**Signature**

```ts
export type CarKeyboardControllerOptions = {
  keymap: DirectionKeyboardKeymap
  gearUpDownKeys: [string, string]
  handbrakeKey: string
}
```

## CarKeyboardHandlingController (class)

**Signature**

```ts
export declare class CarKeyboardHandlingController {
  constructor(
    protected readonly keyboard: KeyboardInput,
    public car: RaycastVehicle3dEntity | null,
    protected readonly options: CarKeyboardControllerOptions = {
      keymap: 'arrows',
      gearUpDownKeys: ['KeyA', 'KeyZ'],
      handbrakeKey: 'Space',
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

### x$ (property)

**Signature**

```ts
readonly x$: any
```

### y$ (property)

**Signature**

```ts
readonly y$: any
```

### lastX (property)

**Signature**

```ts
lastX: number
```

### switchingGearsEnabled (property)

**Signature**

```ts
switchingGearsEnabled: boolean
```

### pairTickerPipe (property)

**Signature**

```ts
pairTickerPipe: any
```
