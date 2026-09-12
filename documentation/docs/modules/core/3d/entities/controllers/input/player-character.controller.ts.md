---
title: core/3d/entities/controllers/input/player-character.controller.ts
nav_order: 50
parent: Modules
---

## player-character.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PlayerCharacterController (class)](#playercharactercontroller-class)
    - [toggleViewMode (method)](#toggleviewmode-method)
    - [reset (method)](#reset-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [updateCamera (method)](#updatecamera-method)
    - [tickOrder (property)](#tickorder-property)
    - [options (property)](#options-property)
    - [mouseInput (property)](#mouseinput-property)
    - [directionsInput (property)](#directionsinput-property)
  - [PlayerCharacterControllerOptions (type alias)](#playercharactercontrolleroptions-type-alias)
  - [PlayerCharacterControllerViewMode (type alias)](#playercharactercontrollerviewmode-type-alias)

---

# utils

## PlayerCharacterController (class)

The player's input+camera controller: WASD/arrows/both movement, sprint, crouch and jump keys,
and mouse-look driving a first- or third-person camera - all layered on top of a plain
`CharacterController3dEntity`, which owns the actual movement/gravity/jump physics. Mirrors
`GgCarKeyboardHandlingController` (input entity driving a separate physics entity) crossed with
`FreeCameraController` (mouse-look + pointer lock via the same `MouseInput`/`DirectionKeyboardInput`
primitives).

The character's yaw always follows the camera's yaw (mouse-look), in both view modes - `WASD`
movement is relative to that facing.

**Signature**

```ts
export declare class PlayerCharacterController<TypeDoc> {
  constructor(
    protected readonly keyboard: KeyboardInput,
    /** The character this controller drives. May be swapped/set to `null` at any time. */
    public character: CharacterController3dEntity<TypeDoc> | null,
    protected readonly camera: Renderer3dEntity<TypeDoc['vTypeDoc']>,
    options: Partial<PlayerCharacterControllerOptions> = {}
  )
}
```

### toggleViewMode (method)

**Signature**

```ts
public toggleViewMode(): void
```

### reset (method)

**Signature**

```ts
public reset(): void
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

### updateCamera (method)

**Signature**

```ts
private updateCamera(): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.CONTROLLERS
```

### options (property)

**Signature**

```ts
readonly options: PlayerCharacterControllerOptions
```

### mouseInput (property)

**Signature**

```ts
readonly mouseInput: MouseInput
```

### directionsInput (property)

**Signature**

```ts
readonly directionsInput: DirectionKeyboardInput
```

## PlayerCharacterControllerOptions (type alias)

Options for configuring a `PlayerCharacterController`.

**Signature**

```ts
export type PlayerCharacterControllerOptions = {
  /** Keymap for walk/strafe direction. 'wasd+arrows' by default (both layouts work at once). */
  keymap: DirectionKeyboardKeymap
  /** Key code that triggers `character.jump()`. 'Space' by default. */
  jumpKey: string
  /** Key code that sets `character.isRunning`. 'ShiftLeft' by default. */
  runKey: string
  /** Key code that drives `character.isCrouching`, per `character.options.crouchMode`. 'ControlLeft' by default. */
  crouchKey: string
  /** Key code that calls `toggleViewMode()`. 'KeyV' by default; `null` disables the toggle. */
  toggleViewKey: string | null
  /** Initial view mode. 'first-person' by default. */
  viewMode: PlayerCharacterControllerViewMode
  /** First-person camera height above the capsule's center, along `up`. Default 0.7. */
  eyeHeight: number
  /** Third-person camera distance behind the look target. Default 4. */
  thirdPersonDistance: number
  /** Height of the third-person look target above the capsule's center, along `up`. Default 0.6. */
  thirdPersonHeight: number
  /** Mouse-look sensitivity, in radians per 1000px of mouse movement. Default 1. */
  mouseSensitivity: number
  /** Minimum look pitch (radians, negative = down). Default ~-89°. */
  minPitch: number
  /** Maximum look pitch (radians, positive = up). Default ~89°. */
  maxPitch: number
  /**
   * Whether the third-person camera raycasts from the look target towards its desired position
   * and pulls in when something obstructs it, to avoid clipping through geometry. Default true.
   */
  cameraCollision: boolean
  /** Gap kept between the camera and an obstruction it was pulled in against. Default 0.2. */
  cameraCollisionMargin: number
  /**
   * Flag to ignore cursor movement if pointer was not locked. `false` by default. Set this to
   * `true` (matching `mouseOptions: { pointerLock: true }`, the default) to stop stray mouse
   * movement over the page from spinning the view before the canvas has actually been clicked to
   * lock the pointer. Always ignored on a touch device (touch has no pointer-lock concept, and
   * `mouseInput.isPointerLocked` never becomes `true` there), mirroring
   * `FreeCameraControllerOptions`'s identically-named option.
   */
  ignoreMouseUnlessPointerLocked: boolean
  /** Options for the underlying `MouseInput` (e.g. `canvas` for pointer lock). `pointerLock: true` by default. */
  mouseOptions: Partial<MouseInputOptions>
}
```

## PlayerCharacterControllerViewMode (type alias)

**Signature**

```ts
export type PlayerCharacterControllerViewMode = 'first-person' | 'third-person'
```
