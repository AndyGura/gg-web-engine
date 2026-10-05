---
title: core/2d/entities/controllers/input/player-character-2d.controller.ts
nav_order: 29
parent: Modules
---

## player-character-2d.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PlayerCharacterController2d (class)](#playercharactercontroller2d-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [updateCamera (method)](#updatecamera-method)
    - [tickOrder (property)](#tickorder-property)
    - [options (property)](#options-property)
    - [directionsInput (property)](#directionsinput-property)
  - [PlayerCharacterController2dOptions (type alias)](#playercharactercontroller2doptions-type-alias)

---

# utils

## PlayerCharacterController2d (class)

The player's input+camera controller for a 2D platformer character: left/right/sprint/crouch/jump
keys driving a plain `CharacterController2dEntity` (which owns the actual movement/gravity/jump/
crouch physics), plus a simple side-scroller camera that follows the character's position with
exponential smoothing. Mirrors `PlayerCharacterController` (the 3D counterpart) in shape, without
mouse-look/view-mode switching - a 2D side view has no such concept (see
`CharacterController2dEntity`'s own doc for why `moveDirection` is a scalar, not a look-relative
vector).

**Signature**

```ts
export declare class PlayerCharacterController2d<TypeDoc> {
  constructor(
    protected readonly keyboard: KeyboardInput,
    /** The character this controller drives. May be swapped/set to `null` at any time. */
    public character: CharacterController2dEntity<TypeDoc> | null,
    protected readonly camera: Renderer2dEntity<TypeDoc['vTypeDoc']>,
    options: Partial<PlayerCharacterController2dOptions> = {}
  )
}
```

### onSpawned (method)

**Signature**

```ts
async onSpawned(world: Gg2dWorld<TypeDoc>): Promise<void>
```

### onRemoved (method)

**Signature**

```ts
async onRemoved(): Promise<void>
```

### updateCamera (method)

**Signature**

```ts
private updateCamera(dt: number): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.CONTROLLERS
```

### options (property)

**Signature**

```ts
readonly options: PlayerCharacterController2dOptions
```

### directionsInput (property)

**Signature**

```ts
readonly directionsInput: DirectionKeyboardInput
```

## PlayerCharacterController2dOptions (type alias)

Options for configuring a `PlayerCharacterController2d`.

**Signature**

```ts
export type PlayerCharacterController2dOptions = {
  /** Keymap for left/right movement. `'wasd+arrows'` by default (both layouts work at once). */
  keymap: DirectionKeyboardKeymap
  /** Key code that triggers `character.jump()`. `'Space'` by default. */
  jumpKey: string
  /** Key code that sets `character.isRunning`. `'ShiftLeft'` by default. */
  runKey: string
  /** Key code that drives `character.isCrouching`, per `character.options.crouchMode`. `'ControlLeft'` by default. */
  crouchKey: string
  /**
   * How far ahead of the character (along its `facing`) the camera's look target is offset, in
   * world units - a fixed lead so the player can see more of what's ahead than what's behind.
   * Default 0.
   */
  lookAheadDistance: number
  /** How quickly the camera catches up to its target position, as a fraction closed per second
   * (0..1 per tick, exponential smoothing - `1` snaps instantly). Default 0.1. */
  cameraSmoothing: number
}
```
