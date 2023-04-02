---
title: core/3d/controllers/car-keyboard.controller.ts
nav_order: 19
parent: Modules
---

## car-keyboard.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CarKeyboardController (class)](#carkeyboardcontroller-class)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)
    - [x$ (property)](#x-property)
    - [y$ (property)](#y-property)
    - [lastX (property)](#lastx-property)
    - [stop$ (property)](#stop-property)
    - [car$ (property)](#car-property)
    - [switchingGearsEnabled (property)](#switchinggearsenabled-property)
    - [pairTickerPipe (property)](#pairtickerpipe-property)
  - [CarKeyboardControllerOptions (type alias)](#carkeyboardcontrolleroptions-type-alias)

---

# utils

## CarKeyboardController (class)

**Signature**

```ts
export declare class CarKeyboardController {
  constructor(
    protected readonly keyboardController: KeyboardController,
    car: Gg3dRaycastVehicleEntity,
    protected readonly options: CarKeyboardControllerOptions = { keymap: 'arrows', gearUpDownKeys: ['KeyA', 'KeyZ'] }
  )
}
```

### start (method)

**Signature**

```ts
async start(): Promise<void>
```

### stop (method)

**Signature**

```ts
async stop(): Promise<void>
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

### stop$ (property)

**Signature**

```ts
readonly stop$: any
```

### car$ (property)

**Signature**

```ts
readonly car$: any
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

## CarKeyboardControllerOptions (type alias)

**Signature**

```ts
export type CarKeyboardControllerOptions = {
  keymap: DirectionKeymap
  gearUpDownKeys: [string, string]
}
```
