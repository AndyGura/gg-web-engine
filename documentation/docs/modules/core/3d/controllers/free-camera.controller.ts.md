---
title: core/3d/controllers/free-camera.controller.ts
nav_order: 19
parent: Modules
---

## free-camera.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [FreeCameraController (class)](#freecameracontroller-class)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)

---

# utils

## FreeCameraController (class)

**Signature**

```ts
export declare class FreeCameraController {
  constructor(
    private readonly keyboardController: KeyboardController,
    private readonly camera: Gg3dCameraEntity,
    private readonly options: FreeCameraControllerOptions = {
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
