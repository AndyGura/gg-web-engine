---
title: core/3d/entities/controllers/character-animation.controller.ts
nav_order: 60
parent: Modules
---

## character-animation.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CharacterAnimationClipMap (type alias)](#characteranimationclipmap-type-alias)
  - [CharacterAnimationController (class)](#characteranimationcontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [resolveState (method)](#resolvestate-method)
    - [updateGroundedDebounce (method)](#updategroundeddebounce-method)
    - [update (method)](#update-method)
    - [dispose (method)](#dispose-method)
    - [tickOrder (property)](#tickorder-property)
    - [options (property)](#options-property)
  - [CharacterAnimationControllerOptions (type alias)](#characteranimationcontrolleroptions-type-alias)
  - [CharacterAnimationState (type alias)](#characteranimationstate-type-alias)

---

# utils

## CharacterAnimationClipMap (type alias)

Maps a {@link CharacterAnimationState} to the animation clip name inside the character's own
model that should play for it. A state missing from the map (or whose resolved name isn't
actually one of the model's `animationNames`) is simply never switched into - the controller
keeps whatever was last playing rather than switching to nothing.

**Signature**

```ts
export type CharacterAnimationClipMap = Partial<Record<CharacterAnimationState, string>>
```

## CharacterAnimationController (class)

Drives a `CharacterController3dEntity`'s animated model (see `IAnimatedDisplayObject3dComponent`)
by picking a {@link CharacterAnimationState} from the character's own public movement state each
tick - `isGrounded`, `isCrouching`, `isRunning`, `moveDirection` - and calling `playAnimation`
whenever that state changes, plus `updateAnimations` every tick regardless (to advance the
underlying clip time). A no-op entity (still ticks, does nothing) if `character.object3D` isn't
an animated display object at the time of the check - e.g. a physics-only/invisible character, or
one using the auto-generated capsule mesh instead of a loaded model - so it's always safe to
attach one speculatively rather than checking first.

Ticks at `TickOrder.ANIMATION_MIXERS`, deliberately _after_ `character`'s own tick (`TickOrder
.PHYSICS_SIMULATION - 5`, pre-physics) and after `Entity3d`'s `OBJECTS_BINDING` mesh-position sync
(400) - both physics simulation and this frame's position/rotation sync have already happened by
then, so `character.isGrounded` and friends reflect this frame's actual result rather than last
frame's, and the model's own transform is already in its final place for whatever rendering does
next. Mirrors `PlayerCharacterController` driving `CharacterController3dEntity`, and
`ObjectGrabController` driving `Grabbable3dEntity`, in shape - a separate controller entity
reading/reacting to another entity's state, rather than folding this into
`CharacterController3dEntity` itself (which ticks pre-physics and has no notion of animation) -
see `gg-engine-core-development`'s `tickOrder` section for why this split is the established
pattern here.

Not tied to level JSON: construct and `world.addEntity`/`character.addChildren` one directly for
a programmatically-built character too. The built-in `"Player"` level class does exactly this
itself (see `Player3DSettings.display.model`) whenever a model with animations is configured, so
a level-JSON player gets this wiring for free with no app code needed.

`character.isGrounded` is a raw per-tick physics reading, not a stable/hysteresis-free signal -
standing right at the edge of a platform (or any other borderline-contact position) can make an
adapter's own sweep/overlap check flip it true/false tick to tick with no actual movement
involved, which would otherwise make `resolveState()` flicker the animation between `'jump'` and
whatever grounded state applies (`'idle'`/`'walk'`/`'run'`/`'crouch'`) every single tick - visibly
distracting, and not something any adapter-level fix can resolve (it's inherent to sampling a
boundary condition every tick, not a bug in one particular adapter's sweep). This class debounces
that raw signal itself (see `groundedTransitionDelay`) before `resolveState()` ever sees it,
rather than debouncing the resolved animation state - debouncing the state instead would equally
suppress a _deliberate_ rapid state change (e.g. running straight off a ledge into open air,
which should read as airborne the instant it happens, not `groundedTransitionDelay` later) purely
because grounded-ness happened to be involved, which isn't the actual problem being solved.

**Signature**

```ts
export declare class CharacterAnimationController<TypeDoc> {
  constructor(
    protected readonly character: CharacterController3dEntity<TypeDoc>,
    options: Partial<CharacterAnimationControllerOptions> = {}
  )
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld<TypeDoc>): void
```

### resolveState (method)

Resolves the character's current movement state to one of the built-in
{@link CharacterAnimationState}s. Airborne takes priority over crouching (a character can't be
both at once anyway, since `CharacterController3dEntity.tryStandUp` only runs while grounded),
which takes priority over walking/running, which takes priority over idle. Reads
`_debouncedGrounded`, not `character.isGrounded` directly - see this class's own doc for why.

**Signature**

```ts
protected resolveState(): CharacterAnimationState
```

### updateGroundedDebounce (method)

Updates {@link \_debouncedGrounded} from `character.isGrounded`'s raw reading this tick. The
first call ever always adopts the raw value immediately (there's no prior committed state to
protect yet - the "just spawned already mid-air" case shouldn't wait out the debounce window
before showing an airborne pose). After that, a raw value that disagrees with the currently
committed one only replaces it once it's held steady for `groundedTransitionDelay` seconds
straight - a flip back to the committed value at any point before then restarts the timer from
`0` rather than carrying over partial progress, so a rapid back-and-forth (the flicker this
exists to suppress) never accumulates enough steady time to commit either value.

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
readonly options: CharacterAnimationControllerOptions
```

## CharacterAnimationControllerOptions (type alias)

**Signature**

```ts
export type CharacterAnimationControllerOptions = {
  /** Overrides `DEFAULT_CLIP_MAP` per state - see {@link CharacterAnimationClipMap}. */
  clipMap: CharacterAnimationClipMap
  /** Crossfade duration (seconds) applied on every state switch. Default 0.2. */
  fadeDuration: number
  /** Minimum `Pnt3.len(character.moveDirection)` that counts as "trying to move" (vs. idle).
   * Default 0.01 - just above float noise, since `moveDirection` is normally either exactly zero
   * or a unit-ish vector from an input driver, never a small nonzero value by accident. */
  movementEpsilon: number
  /**
   * Minimum time (seconds) `character.isGrounded`'s *raw* reading must hold steady at a new value
   * before the animation state machine actually trusts it - see this class's own doc for why this
   * exists at all. `0` disables debouncing entirely (every raw flip is trusted immediately, the
   * pre-debounce behavior). Default 0.15.
   */
  groundedTransitionDelay: number
}
```

## CharacterAnimationState (type alias)

Built-in movement states a `CharacterAnimationController` distinguishes. Covers the animation
set called out for a player character - idle/walking/running/crouching/airborne - not an
open-ended state machine; an app wanting more states (e.g. a distinct landing pose, strafing)
drives `IAnimatedDisplayObject3dComponent.playAnimation` directly instead of going through this
controller.

**Signature**

```ts
export type CharacterAnimationState = 'idle' | 'walk' | 'run' | 'crouch' | 'jump'
```
