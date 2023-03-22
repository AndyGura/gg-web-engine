---
title: core/3d/controllers/car-keyboard.controller.ts
nav_order: 18
parent: Modules
---

## car-keyboard.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CarKeyboardController (class)](#carkeyboardcontroller-class)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)
    - [car$ (property)](#car-property)
    - [pairTickerPipe (property)](#pairtickerpipe-property)

---

# utils

## CarKeyboardController (class)

**Signature**

```ts
export declare class CarKeyboardController {
  constructor(
    private readonly keyboardController: KeyboardController,
    car: Gg3dRaycastVehicleEntity,
    private readonly options: CarKeyboardControllerOptions = { keymap: 'arrows', gearUpDownKeys: ['KeyA', 'KeyZ'] }
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

### car$ (property)

**Signature**

```ts
readonly car$: any
```

### pairTickerPipe (property)

**Signature**

```ts
pairTickerPipe: any
```
