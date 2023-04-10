---
title: core/3d/entities/controllers/input/free-camera.controller.ts
nav_order: 22
parent: Modules
---

## free-camera.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [FreeCameraController (class)](#freecameracontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)
    - [mouseInput (property)](#mouseinput-property)
    - [directionsInput (property)](#directionsinput-property)
  - [FreeCameraControllerOptions (type alias)](#freecameracontrolleroptions-type-alias)

---

# utils

## FreeCameraController (class)

A controller for a free-moving camera.

**Signature**

```ts
export declare class FreeCameraController {
  constructor(
    protected readonly keyboard: KeyboardInput,
    protected readonly camera: Gg3dCameraEntity,
    protected readonly options: FreeCameraControllerOptions = {
      keymap: 'wasd',
      movementOptions: { speed: 0.5 },
      mouseOptions: {},
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
readonly tickOrder: GGTickOrder.INPUT_CONTROLLERS
```

### mouseInput (property)

The mouse input controller used for camera rotation.

**Signature**

```ts
readonly mouseInput: MouseInput
```

### directionsInput (property)

The keyboard input controller used for camera movement.

**Signature**

```ts
readonly directionsInput: DirectionKeyboardInput
```

## FreeCameraControllerOptions (type alias)

Options for configuring a FreeCameraInput controller.

**Signature**

```ts
export type FreeCameraControllerOptions = {
  /**
   * A keymap for controlling camera movement, where each key corresponds to a movement direction.
   */
  keymap: DirectionKeyboardKeymap
  /**
   * Options for configuring camera movement.
   */
  movementOptions: {
    /**
     * The speed of camera movement.
     */
    speed: number
  }
  /**
   * Options for configuring mouse input.
   */
  mouseOptions: MouseInputOptions
}
```
