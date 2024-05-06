---
title: core/3d/entities/controllers/input/free-camera.controller.ts
nav_order: 39
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
    - [options (property)](#options-property)
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
    protected readonly camera: Renderer3dEntity,
    options: Partial<FreeCameraControllerOptions> = {}
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

### options (property)

**Signature**

```ts
readonly options: FreeCameraControllerOptions
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
   * Flag to ignore cursor movement if pointer was not locked. By default false
   */
  ignoreMouseUnlessPointerLocked: boolean
  /**
   * Flag to ignore keyboard events if pointer was not locked. By default false
   */
  ignoreKeyboardUnlessPointerLocked: boolean
  /**
   * Options for configuring mouse input.
   */
  mouseOptions: Partial<MouseInputOptions>
}
```
