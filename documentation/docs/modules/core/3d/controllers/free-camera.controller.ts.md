---
title: core/3d/controllers/free-camera.controller.ts
nav_order: 20
parent: Modules
---

## free-camera.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [FreeCameraController (class)](#freecameracontroller-class)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)
    - [mController (property)](#mcontroller-property)
    - [stop$ (property)](#stop-property)
  - [FreeCameraControllerOptions (type alias)](#freecameracontrolleroptions-type-alias)

---

# utils

## FreeCameraController (class)

**Signature**

```ts
export declare class FreeCameraController {
  constructor(
    protected readonly keyboardController: KeyboardController,
    protected readonly camera: Gg3dCameraEntity,
    protected readonly options: FreeCameraControllerOptions = {
      keymap: 'wasd',
      movementOptions: { speed: 0.5 },
      mouseOptions: {},
    }
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
async stop(unlockPointer: boolean = true): Promise<void>
```

### mController (property)

**Signature**

```ts
readonly mController: MouseController
```

### stop$ (property)

**Signature**

```ts
readonly stop$: any
```

## FreeCameraControllerOptions (type alias)

**Signature**

```ts
export type FreeCameraControllerOptions = {
  keymap: DirectionKeymap
  movementOptions: {
    speed: number
  }
  mouseOptions: MouseControllerOptions
}
```
