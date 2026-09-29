---
title: core/2d/entities/character-controller-2d.entity.ts
nav_order: 25
parent: Modules
---

## character-controller-2d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CharacterController2dEntity (class)](#charactercontroller2dentity-class)
    - [updateVisibility (method)](#updatevisibility-method)
    - [onSpawned (method)](#onspawned-method)
    - [jump (method)](#jump-method)
    - [updateMovement (method)](#updatemovement-method)
    - [tryStandUp (method)](#trystandup-method)
    - [recreateCapsule (method)](#recreatecapsule-method)
    - [tickOrder (property)](#tickorder-property)
    - [options (property)](#options-property)
    - [moveDirection (property)](#movedirection-property)
    - [isRunning (property)](#isrunning-property)
    - [object2D (property)](#object2d-property)
    - [characterController (property)](#charactercontroller-property)
  - [CharacterController2dEntityOptions (type alias)](#charactercontroller2dentityoptions-type-alias)

---

# utils

## CharacterController2dEntity (class)

A capsule-bodied, physics-driven character entity: walk/run/crouch/jump gameplay logic that works
identically on top of any physics backend implementing `ICharacterController2dComponent` (see
that interface's doc for why - all of gravity/jump/speed/crouch integration happens here, not in
the backend-specific component). Reusable for the player (see a `PlayerCharacterController2d`
input driver) or for an NPC driven by AI logic instead. Mirrors `CharacterController3dEntity`
closely - see that class's own doc for the full reasoning behind the momentum-tracking/
ceiling-block/ground-walkability/crouch-capsule-swap logic below, which is identical here just
projected into 2D.

`moveDirection` is a single signed scalar (not a vector): this engine's 2D world is always a
side-view/platformer ground plane (gravity pulls along `up`, see `Gg2dWorldTypeDocRepo`'s own
`gravity` console command default of `{x:0,y:9.82}`) rather than a top-down one, so the only
horizontal choice a character ever has is "which way along the ground plane's side axis" - there
is no separate forward/strafe axis the way a free-look 3D character has. Positive moves along
`Pnt2.rot(up, Math.PI/2)` (world `+X` for the default `up: {x:0,y:-1}`), negative the opposite way;
magnitude beyond `1` is not clamped (an analog input source is free to send a fractional/scaled
value, exactly like `walkSpeed * moveDirection` would suggest).

**Signature**

```ts
export declare class CharacterController2dEntity<TypeDoc> {
  constructor(
    options: Partial<CharacterController2dEntityOptions> &
      Pick<CharacterController2dEntityOptions, 'radius' | 'centersDistance'>,
    object2D: TypeDoc['vTypeDoc']['displayObject'] | null,
    characterController: TypeDoc['pTypeDoc']['characterController']
  )
}
```

### updateVisibility (method)

**Signature**

```ts
public updateVisibility(): void
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg2dWorld<TypeDoc>)
```

### jump (method)

Triggers a jump (a takeoff velocity away from the ground, opposing gravity) only while stably
grounded - see `CharacterController3dEntity.jump()`'s doc for the full rationale (identical
here, just in 2D).

**Signature**

```ts
public jump(): void
```

### updateMovement (method)

**Signature**

```ts
private updateMovement(deltaMs: number): void
```

### tryStandUp (method)

Raycasts straight up (along `up`) from the current (crouched) capsule's top by the extra height
standing would need - see `CharacterController3dEntity.tryStandUp`'s doc for the full rationale
behind the ray's placement/only-while-grounded restriction (identical here, just in 2D).

**Signature**

```ts
private tryStandUp(): void
```

### recreateCapsule (method)

Swaps the underlying `characterController` component for a freshly-created one at a different
`centersDistance`, keeping the character's feet planted in place - see
`CharacterController3dEntity.recreateCapsule`'s doc for the full rationale (identical here, just
in 2D).

**Signature**

```ts
private recreateCapsule(newCentersDistance: number): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
```

### options (property)

**Signature**

```ts
readonly options: Required<CharacterController2dEntityOptions>
```

### moveDirection (property)

Desired horizontal move direction/speed fraction - see this class's own doc. Set by an input
driver.

**Signature**

```ts
moveDirection: number
```

### isRunning (property)

Whether to move at `walkSpeed * runSpeedMultiplier`.

**Signature**

```ts
isRunning: boolean
```

### object2D (property)

**Signature**

```ts
object2D: TypeDoc['vTypeDoc']['displayObject'] | null
```

### characterController (property)

**Signature**

```ts
characterController: TypeDoc['pTypeDoc']['characterController']
```

## CharacterController2dEntityOptions (type alias)

Options for a `CharacterController2dEntity`: the capsule shape/mover tuning from
`CharacterController2dOptions`, plus the gameplay tuning (speed, jump, crouch, gravity) this
entity owns itself so behavior stays identical across physics backends - see the class doc.
Mirrors `CharacterController3dEntityOptions` field-for-field.

**Signature**

```ts
export type CharacterController2dEntityOptions = CharacterController2dOptions & {
  /** Walking speed, in world units/s. Default 4. */
  walkSpeed: number
  /** Multiplier applied to `walkSpeed` while `isRunning`. Default 1.8. */
  runSpeedMultiplier: number
  /** Multiplier applied to `walkSpeed` while `isCrouching`. Default 0.5. */
  crouchSpeedMultiplier: number
  /** Capsule `centersDistance` used while `isCrouching`. Must be smaller than `centersDistance`. */
  crouchCentersDistance: number
  /**
   * Not consumed by this class - carried here purely so an input driver (e.g.
   * `PlayerCharacterController2d`) can read the crouch key behavior from the same options object
   * used to configure the character itself. `'hold'`: crouch while the key is held, stand up on
   * release (subject to the headroom check above). `'toggle'`: each press flips `isCrouching`.
   * Default `'hold'`.
   */
  crouchMode: 'hold' | 'toggle'
  /** Takeoff vertical speed applied by `jump()`, opposing gravity along `up`. Default 5. */
  jumpSpeed: number
  /**
   * Downward acceleration integrated while airborne, along `up`, **overriding** the world's own
   * `physicsWorld.gravity` for this character. Leave `undefined` (the default) to instead track
   * `physicsWorld.gravity` live every tick, full vector - direction and magnitude - exactly like it
   * would affect a dynamic rigid body. See `CharacterController3dEntityOptions.gravity`'s doc for
   * the full rationale (identical here, just in 2D).
   */
  gravity: number | undefined
  /**
   * How fast horizontal movement can be *steered* while airborne, as a fraction of the current
   * walk/run speed applied per second of acceleration (0..1) - see
   * `CharacterController3dEntityOptions.airControlFactor`'s doc. Default 0.3.
   */
  airControlFactor: number
}
```
