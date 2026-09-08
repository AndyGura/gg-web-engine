---
title: core/3d/entities/character-controller-3d.entity.ts
nav_order: 42
parent: Modules
---

## character-controller-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CharacterController3dEntity (class)](#charactercontroller3dentity-class)
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
    - [object3D (property)](#object3d-property)
    - [characterController (property)](#charactercontroller-property)
  - [CharacterController3dEntityOptions (type alias)](#charactercontroller3dentityoptions-type-alias)

---

# utils

## CharacterController3dEntity (class)

A capsule-bodied, physics-driven character entity: walk/run/crouch/jump gameplay logic that
works identically on top of any physics backend implementing `ICharacterController3dComponent`
(see that interface's doc for why - all of gravity/jump/speed integration happens here, not in
the backend-specific component). Reusable for the player (see `PlayerCharacterController`, which
adds keyboard/mouse input and a camera on top of this) or for an NPC driven by AI logic instead.

Gravity is integrated as a full 3D vector (`gravityVector`/`_fallVelocity`), not just its
component along `up`: a tilted `physicsWorld.gravity` drags the character sideways while airborne,
and standing on a surface steeper than `maxSlopeClimbAngleRad` (re-checked here every tick via
`isWalkableGround`, regardless of what an adapter's own `isGrounded` reports) is treated as not
stably grounded, so the character slides/falls down it under gravity instead of clinging to it -
see `updateMovement`'s doc for the exact resting-vs-falling rule. Getting blocked from above while
ascending (e.g. jumping into a ceiling) is handled the same way as landing: `updateMovement`
compares the actual post-`move()` displacement against the desired one along `up` and, if capped,
immediately cancels `_fallVelocity`'s upward component - otherwise it would keep decelerating on
gravity's own time schedule regardless of the character's actual (blocked) position, making the
character look glued to the ceiling for as long as an unobstructed jump's rise phase would have
taken.

Horizontal movement is direct/instantaneous while resting on the ground (no momentum - snappy,
input-follows-exactly control), but becomes velocity-based the instant the character leaves the
ground: whatever horizontal ground speed was in effect at takeoff (walk or run) is captured into
`_airHorizontalVelocity` and persists through the whole arc unless the input driver changes
`moveDirection`/`isRunning`, in which case `airControlFactor` caps how fast the resulting steering
can redirect it (see `updateMovement`'s doc) - so a running jump travels exactly as far
horizontally as the run speed implies, instead of the speed silently collapsing to a fraction of
it the instant the character leaves the ground.

`moveDirection` is local-space (rotated by `this.rotation` internally): local +Y is "forward" at
zero yaw, local +X is "right" at zero yaw, local Z is unused (always ignored - vertical motion is
handled separately, see above) - the same right=X/forward=Y/up=Z axis paradigm
`RaycastVehicle3dEntity`/`GgCarEntity` use (see e.g. `AmmoRaycastVehicleComponent`'s
`setCoordinateSystem(0, 2, 1)`), **not** the camera/`FreeCameraController` convention (local -Z
forward, local Y up) - that convention matches a camera's rest orientation (forward down local
-Z), whereas this entity's rest/identity orientation stands with its capsule's long axis along
local Z (`up`), so `this.rotation` must only ever be a plain rotation around `up` (e.g.
`Qtrn.fromAngle(up, yaw)`) for the capsule to stay upright - never a camera-style look-at basis
change. A driver (e.g. `PlayerCharacterController`) must map input to `moveDirection` and compute
`this.rotation` using this same convention (note `Pnt3.toSpherical`/`fromSpherical`'s own `theta`
is measured from +X, not +Y - converting a look-direction angle into this entity's yaw needs a
-90° offset, see `PlayerCharacterController.updateCamera`'s comment for the derivation).

**Signature**

```ts
export declare class CharacterController3dEntity<TypeDoc> {
  constructor(
    options: Partial<CharacterController3dEntityOptions> &
      Pick<CharacterController3dEntityOptions, 'radius' | 'centersDistance'>,
    object3D: TypeDoc['vTypeDoc']['displayObject'] | null,
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
onSpawned(world: Gg3dWorld<TypeDoc>)
```

### jump (method)

Triggers a jump (a takeoff velocity away from the ground, opposing gravity) only while stably
grounded - the same `isGrounded && isWalkableGround` condition `updateMovement` uses to decide
resting-vs-falling (see its doc), not just the adapter's raw `isGrounded` alone. Otherwise a
character balanced on a too-steep surface (`isGrounded === true` but sliding, per
`isWalkableGround`) could jump off it as if it were stable footing. A no-op mid-air, and a
no-op while grounded on an unwalkably steep surface.

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

Raycasts straight up from the current (crouched) capsule's top by the extra height standing
would need. The ray starts a hair above that top point along `up` - the capsule's own outward
surface normal at that exact point - so it originates just outside the character's own shape
and can never register a self-hit, with no collision-group bookkeeping required.

Only ever called while `isGrounded` (see the `updateMovement` call site) - **not** merely as an
optimization. A thin ray probe like this one needs _some_ endpoint to start from a point known
to be outside every other body, and the only such point this class can derive without a real
shape-overlap query (which `IPhysicsWorld3dComponent` doesn't expose) is "just outside my own
capsule" - which only actually holds when the capsule is at rest. While actively rising through
a jump, the capsule's own top can end up, on some single tick, closer to a low ceiling than that
same tiny margin - not yet blocked by `move()`'s own sweep (which stops it correctly the very
next tick), but _already_ close enough that this ray's start point lands inside the ceiling
anyway, and a ray beginning inside a shape never registers an entry hit against it (the same
false-negative failure mode as `AmmoCharacterControllerComponent`'s embedded-landing-position
pitfall - see `gg-engine-physics-adapter-ammo` - except this version needs no collision at all,
just a close enough natural approach on a single tick, so it isn't fixed by keeping landing
positions clean). Regression, found jumping while crouched under a ceiling too low to stand
under: on the one tick the rising capsule's top passed within this margin of the ceiling but
hadn't yet been blocked by it, the headroom check read "clear" and stood the character up,
permanently (nothing re-checks once `_isCrouching` is already `false`), clipping the now-tall
capsule into the ceiling for the rest of the jump. Swapping the ray's own two endpoints doesn't
generally fix this either - a sufficiently thick ceiling can just as easily embed _that_ end
instead (confirmed empirically) - so the fix is to never run this check against a position that
might still be mid-flight in the first place.

**Signature**

```ts
private tryStandUp(): void
```

### recreateCapsule (method)

Swaps the underlying `characterController` component for a freshly-created one at a different
`centersDistance`, keeping the character's feet planted in place. Used for crouch/stand
transitions instead of resizing a component in place - see `ICharacterController3dComponent`'s
doc for why.

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
readonly options: Required<CharacterController3dEntityOptions>
```

### moveDirection (property)

Local-space desired move direction (XY plane, "+Y forward / +X right", Z unused); set by an input driver - see this class's doc.

**Signature**

```ts
moveDirection: Readonly<MutablePoint3>
```

### isRunning (property)

Whether to move at `walkSpeed * runSpeedMultiplier`. Ignored while `isCrouching`.

**Signature**

```ts
isRunning: boolean
```

### object3D (property)

**Signature**

```ts
object3D: TypeDoc['vTypeDoc']['displayObject'] | null
```

### characterController (property)

**Signature**

```ts
characterController: TypeDoc['pTypeDoc']['characterController']
```

## CharacterController3dEntityOptions (type alias)

Options for a `CharacterController3dEntity`: the capsule shape/mover tuning from
`CharacterController3dOptions`, plus the gameplay tuning (speed, jump, gravity) this entity owns
itself so behavior stays identical across physics backends - see the class doc.

**Signature**

```ts
export type CharacterController3dEntityOptions = CharacterController3dOptions & {
  /** Walking speed, in m/s. Default 4. */
  walkSpeed: number
  /** Multiplier applied to `walkSpeed` while `isRunning`. Default 1.8. */
  runSpeedMultiplier: number
  /** Multiplier applied to `walkSpeed` while `isCrouching`. Default 0.5. */
  crouchSpeedMultiplier: number
  /** Capsule `centersDistance` used while `isCrouching`. Must be smaller than `centersDistance`. */
  crouchCentersDistance: number
  /**
   * Not consumed by this class - carried here purely so an input driver (e.g.
   * `PlayerCharacterController`) can read the crouch key behavior from the same options object
   * used to configure the character itself. `'hold'`: crouch while the key is held, stand up on
   * release (subject to the headroom check above). `'toggle'`: each press flips `isCrouching`.
   * Default `'hold'`.
   */
  crouchMode: 'hold' | 'toggle'
  /** Takeoff vertical speed applied by `jump()`, in m/s, launched along `up` opposing gravity. Default 5. */
  jumpSpeed: number
  /**
   * Downward acceleration integrated while airborne, in m/s², straight along `up` (no horizontal
   * component), **overriding** the world's own `physicsWorld.gravity` for this character. Leave
   * `undefined` (the default) to instead track `physicsWorld.gravity` live every tick, full vector
   * - direction, magnitude, *and* any horizontal component - exactly like it would affect a dynamic
   * rigid body (including live changes via the `gravity` dev-console command). A tilted/non-vertical
   * `physicsWorld.gravity` therefore drags this character sideways while airborne or sliding down a
   * too-steep surface, not just downward - see `CharacterController3dEntity`'s class doc. This
   * character's underlying `characterController` is always a kinematic mover unaffected by the
   * physics engine's own gravity integration (see `ICharacterController3dComponent`'s doc), which is
   * why this entity must read and apply gravity itself rather than relying on the backend to do it -
   * only set this to a number when a character deliberately needs a gravity scale different from the
   * rest of the world (e.g. floatier low-gravity player); a numeric override is always straight down
   * along `up`, with no horizontal drag.
   */
  gravity: number | undefined
  /**
   * How fast horizontal movement can be *steered* while airborne, as a fraction of the current
   * walk/run speed applied per second of acceleration (0..1) - **not** a flat multiplier on speed
   * itself. The horizontal velocity in effect at the moment of leaving the ground (walk or run) is
   * carried through the whole jump/fall arc unchanged as long as `moveDirection`/`isRunning` don't
   * change; this only caps how quickly that carried velocity can be redirected towards a *new*
   * desired direction/speed once airborne (see `updateMovement`'s doc). Default 0.3.
   */
  airControlFactor: number
}
```
