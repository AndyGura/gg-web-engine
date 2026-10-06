---
title: core/2d/entities/controllers/character-animation-2d.controller.ts
nav_order: 28
parent: Modules
---

## character-animation-2d.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CharacterAnimation2dClipMap (type alias)](#characteranimation2dclipmap-type-alias)
  - [CharacterAnimation2dController (class)](#characteranimation2dcontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [resolveState (method)](#resolvestate-method)
    - [updateGroundedDebounce (method)](#updategroundeddebounce-method)
    - [update (method)](#update-method)
    - [dispose (method)](#dispose-method)
    - [tickOrder (property)](#tickorder-property)
    - [options (property)](#options-property)
  - [CharacterAnimation2dControllerOptions (type alias)](#characteranimation2dcontrolleroptions-type-alias)
  - [CharacterAnimation2dState (type alias)](#characteranimation2dstate-type-alias)

---

# utils

## CharacterAnimation2dClipMap (type alias)

Maps a {@link CharacterAnimation2dState} to the animation clip name inside the character's own
atlas that should play for it. A state missing from the map (or whose resolved name isn't
actually one of the sprite's `animationNames`) is simply never switched into - the controller
keeps whatever was last playing rather than switching to nothing.

**Signature**

```ts
export type CharacterAnimation2dClipMap = Partial<Record<CharacterAnimation2dState, string>>
```

## CharacterAnimation2dController (class)

Drives a `CharacterController2dEntity`'s animated sprite (see `IAnimatedDisplayObject2dComponent`)
by picking a {@link CharacterAnimation2dState} from the character's own public movement state each
tick - `isGrounded`, `isCrouching`, `isRunning`, `moveDirection` - and calling `playAnimation`
whenever that state changes, plus `updateAnimations` every tick regardless (to advance the
underlying clip's frame timer). A no-op entity (still ticks, does nothing) if `character.object2D`
isn't an animated display object at the time of the check. Mirrors `CharacterAnimationController`
(the 3D counterpart) closely - see that class's own doc for the full grounded-debounce rationale,
which applies identically here.

Ticks at `TickOrder.ANIMATION_MIXERS`, deliberately _after_ `character`'s own tick (`TickOrder
.PHYSICS_SIMULATION - 5`, pre-physics) and after `Entity2d`'s `OBJECTS_BINDING` sprite-position
sync (400) - both physics simulation and this frame's position sync have already happened by
then.

**Signature**

```ts
export declare class CharacterAnimation2dController<TypeDoc> {
  constructor(
    protected readonly character: CharacterController2dEntity<TypeDoc>,
    options: Partial<CharacterAnimation2dControllerOptions> = {}
  )
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg2dWorld<TypeDoc>): void
```

### resolveState (method)

Resolves the character's current movement state to one of the built-in
{@link CharacterAnimation2dState}s. Airborne takes priority over crouching (a character can't be
both at once anyway, since `CharacterController2dEntity.tryStandUp` only runs while grounded),
which takes priority over walking/running, which takes priority over idle. Reads
`_debouncedGrounded`, not `character.isGrounded` directly - see this class's own doc for why.

**Signature**

```ts
protected resolveState(): CharacterAnimation2dState
```

### updateGroundedDebounce (method)

**Signature**

```ts
private updateGroundedDebounce(deltaSeconds: number): void
```

### update (method)

**Signature**

```ts
private update(deltaSeconds: number): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.ANIMATION_MIXERS
```

### options (property)

**Signature**

```ts
readonly options: CharacterAnimation2dControllerOptions
```

## CharacterAnimation2dControllerOptions (type alias)

**Signature**

```ts
export type CharacterAnimation2dControllerOptions = {
  /** Overrides `DEFAULT_CLIP_MAP` per state - see {@link CharacterAnimation2dClipMap}. */
  clipMap: CharacterAnimation2dClipMap
  /** Minimum `Math.abs(character.moveDirection)` that counts as "trying to move" (vs. idle).
   * Default 0.01. */
  movementEpsilon: number
  /**
   * Minimum time (seconds) `character.isGrounded`'s *raw* reading must hold steady at a new value
   * before the animation state machine actually trusts it - see `CharacterAnimationController`'s
   * own doc for why this exists at all (identical rationale, just in 2D). `0` disables debouncing
   * entirely. Default 0.15.
   */
  groundedTransitionDelay: number
  /**
   * Whether to flip the sprite horizontally (`object2D.scale.x`'s sign, via
   * `IDisplayObject2dComponent`) to match `character.facing`. Default `true`. Set `false` if the
   * atlas already draws separate left/right-facing frames (or the app wants to control facing
   * itself).
   */
  flipSpriteToFacing: boolean
}
```

## CharacterAnimation2dState (type alias)

Built-in movement states a `CharacterAnimation2dController` distinguishes - the atlas-clip
counterpart of `CharacterAnimationState`.

**Signature**

```ts
export type CharacterAnimation2dState = 'idle' | 'walk' | 'run' | 'crouch' | 'jump'
```
