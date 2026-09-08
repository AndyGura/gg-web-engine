---
title: ammo/components/ammo-character-controller.component.ts
nav_order: 6
parent: Modules
---

## ammo-character-controller.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoCharacterControllerComponent (class)](#ammocharactercontrollercomponent-class)
    - [move (method)](#move-method)
    - [isWalkableNormal (method)](#iswalkablenormal-method)
    - [backOffFromObstacle (method)](#backofffromobstacle-method)
    - [moveHorizontalWithStepAndSlide (method)](#movehorizontalwithstepandslide-method)
    - [trySnapToGround (method)](#trysnaptoground-method)
    - [recoverFromPenetration (method)](#recoverfrompenetration-method)
    - [sweep (method)](#sweep-method)
    - [pushDynamicBody (method)](#pushdynamicbody-method)
    - [refreshCG (method)](#refreshcg-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [clone (method)](#clone-method)
    - [entity (property)](#entity-property)
    - [radius (property)](#radius-property)
    - [centersDistance (property)](#centersdistance-property)
    - [debugBodySettings (property)](#debugbodysettings-property)

---

# utils

## AmmoCharacterControllerComponent (class)

A capsule-shaped kinematic character controller implemented as a direct sweep-and-slide mover
against Bullet's collision world (`btCollisionWorld.convexSweepTest`), rather than via Bullet's
own `btKinematicCharacterController`.

**Why not `btKinematicCharacterController`**: it was the first approach tried here, but its
`setWalkDirection`/`preStep`/`playerStep` sequence - driven directly (never via `world.addAction`/
`stepSimulation`, to keep `move()` synchronous per this interface's contract) - never produced any
collision response at all in this package's pinned Ammo.js WASM build, for either horizontal or
vertical displacement (verified empirically: a capsule dropped straight through a static floor
and a wall alike, with `onGround()` reporting stale/incorrect state throughout). A parallel direct
`btCollisionWorld.convexSweepTest` call against the exact same shape/world/transforms, by
contrast, correctly detected both - confirming the collision world/broadphase/shape setup is
fine, and the bug is specific to `btKinematicCharacterController`'s own internal sweep in this
build (root cause not fully identified; plausibly a stale/never-populated
`btGhostObject`/overlapping-pairs cache that its internals depend on, since that cache stayed at
0 pairs throughout, or a build-specific miscompilation of that class - `convexSweepTest` itself
needs no such cache, doing a fresh broadphase query per call). Building movement directly on
`convexSweepTest` sidesteps the class entirely and is fully understood/controlled by this file.
A `btPairCachingGhostObject` is still used as the character's collision-object identity (added to
the collision world so other queries/debug views can see it, and so `AmmoBodyComponent`'s
position/rotation get/set work off its transform like any other body) - it just isn't driven by
`btKinematicCharacterController` any more.

Divergences from the interface's own options, documented here since Ammo/Bullet has no direct
equivalent for them:

- `minStepWidth` is not honored - this mover's step-up assist always attempts a step (up to
  `maxStepHeight`) with no separate "is there enough room on top" width check.
- `groundNormal` is the sweep-hit normal when grounded via the main vertical sweep, or `up` when
  grounded via the extra ground-snap ray; `null` while airborne.

**Signature**

```ts
export declare class AmmoCharacterControllerComponent {
  constructor(
    world: AmmoWorldComponent,
    options: CharacterController3dOptions,
    transform?: { position?: Point3; rotation?: Point4 }
  )
}
```

### move (method)

Moves the character by exactly `desiredTranslation`, resolved fully synchronously via a
sequence of `convexSweepTest` calls against the current collision world - see this class's doc
for why `btKinematicCharacterController` isn't used. Splits the desired displacement into a
horizontal part (swept with a single step-up assist and a single slide-along-the-surface bounce)
and a vertical part (swept straight, used to detect the ground), then falls back to a short
extra downward ray (mirroring `snapToGroundDistance`) when the vertical sweep alone didn't find
ground this tick (e.g. standing still, or walking off a slope with no explicit vertical input).

**Signature**

```ts
move(desiredTranslation: Point3, dt?: number): void
```

### isWalkableNormal (method)

**Signature**

```ts
private isWalkableNormal(normal: Point3, up: Point3): boolean
```

### backOffFromObstacle (method)

`convexSweepTest`'s `allowedCcdPenetration` (passed as `skin` to every `sweep()` call in this
class) lets a blocked sweep's returned `fraction` land the capsule up to that amount _inside_
whatever it hit, by design (see `sweep()`'s own doc). Most callers of `position` never notice
this - a resting height a hair lower than geometrically exact is invisible - but
`CharacterController3dEntity.tryStandUp`'s headroom raycast (core, shared across every backend)
starts its ray only a hair above the character's _current_ top, trusting that point to be
outside every body but the character's own. A landing position left embedded in a ceiling after
a blocked _upward_ sweep breaks that assumption: the "hair above" point ends up inside the
ceiling too, so the ray never registers an entry hit against it and the headroom check wrongly
reports "clear" - regression, found jumping while crouched under a ceiling too low to stand
under: the character reset to standing height and visibly clipped into it. Backing the landing
position off by `contactClearance` (comfortably more than the sweep's own `allowedCcdPenetration`
itself, not just enough to cancel it out) right here, at the source, keeps every consumer of
`position` (not just that one call site) from ever seeing an embedded result, rather than
patching each caller individually.

**Signature**

```ts
private backOffFromObstacle(pos: Point3, dir: Point3, travelled: number, amount: number): Point3
```

### moveHorizontalWithStepAndSlide (method)

Sweeps the horizontal delta; if blocked, attempts a single "step up by maxStepHeight, retry
horizontally, settle back down" pass (for small ledges/stairs), otherwise slides once along the
remaining blocked distance, projected onto the obstacle's surface plane.

**Signature**

```ts
private moveHorizontalWithStepAndSlide(
    start: Point3,
    horizontal: Point3,
    up: Point3,
    skin: number,
    dt: number | undefined,
  ): Point3
```

### trySnapToGround (method)

One extra downward ray beyond the main vertical sweep above - lets a still/near-ground
character (zero or near-zero vertical input this tick) register as grounded, and approximates
`snapToGroundDistance` for following a slope/staircase down without briefly going airborne each
step. The ray starts a hair below the capsule's actual bottom point (past its own outward
surface) so it can never register a hit against the character's own shape.

**Signature**

```ts
private trySnapToGround(pos: Point3, up: Point3, skin: number): { position: Point3; normal: Point3 } | null
```

### recoverFromPenetration (method)

Pushes the character out of any body it currently overlaps, iterating a few times since
resolving one contact can reveal/deepen another. Must run before any sweep this tick.

**Why this is needed**: `convexSweepTest` (used throughout this class - see this method's
sibling `sweep()`) is a conservative-advancement cast that can only compute a time-of-impact
when it _starts_ outside the target - a well-documented Bullet/GJK limitation. Once this
character's shape ends up even slightly embedded in another body, every subsequent
`convexSweepTest` against that body silently reports no hit at all, from any position, in any
direction - not a jitter or a one-tick glitch, a permanent blind spot to that specific body -
so the character walks straight through it, undetected, forever after. This is exactly how a
character could walk clean through a low overhead beam: approaching it slowed the character
down correctly (a legitimate, not-yet-penetrating sweep hit each tick), but the moment it got
close enough to end up a hair inside the beam - e.g. from `allowedPenetration`/`skin` tolerance
on a settle, or simply the discrete per-tick step distance overshooting the exact contact point

- the very next `move()` found nothing there at all (regression, found by walking under such a
  beam in the example scene). Bullet's own `btKinematicCharacterController` (not used here - see
  the class doc) avoids this with its own internal `recoverFromPenetration` step before every
  sweep; this is that same step, built on the one discrete-overlap query Ammo's embind bindings
  expose for it - `btCollisionWorld.contactTest`.

**Signature**

```ts
private recoverFromPenetration(pos: Point3): Point3
```

### sweep (method)

A single `convexSweepTest` of this character's capsule from `from` to `to`, filtered by this
component's own collision groups - see this class's doc for why this replaces
`btKinematicCharacterController` entirely.

Bug found empirically: `convexSweepTest` has no built-in "don't hit me" concept the way
`btKinematicCharacterController`'s own internal callback does (it excludes its ghost object by
identity, which the embind-exposed `ClosestConvexResultCallback` here has no hook to replicate
from JS) - so a sweep of this exact capsule shape, starting essentially at the ghost object's
own current position, was matching **the character's own collider** as the closest hit (fraction
≈ 0, a plausible-looking but bogus surface normal), on every call, regardless of direction or
whether anything else was even present in the scene. This capped ordinary walking to a small,
direction-dependent fraction of the intended speed (a resting capsule always overlaps its own
ghost object's collider by definition, and floating-point noise in exactly how much made some
directions look worse than others). Fixed by pulling the ghost object out of the collision world
for the duration of the sweep - cheap (a handful of sweeps per tick, not per physics step) and
fully correct, unlike trying to filter by collision group/mask (this character's own group
generally isn't exclusive to it - e.g. it shares the default group with ordinary static
geometry - so masking it out would also hide real obstacles, not just self).

**Signature**

```ts
private sweep(from: Point3, to: Point3, allowedPenetration: number): SweepResult
```

### pushDynamicBody (method)

Shoves a dynamic body the character bumped into this tick - kinematic character movement here
is a direct sweep-and-slide against the collision world (see this class's doc), not a real
rigid body integrated by the constraint solver, so nothing pushes a dynamic body out of the
way for free the way one rigid body pushes another; this is that push, added explicitly.

Models the contact as a simple inelastic collision against a virtual body of mass
`resolvedOptions.pushMass` moving at `characterSpeed` (recovered by the caller from this tick's
horizontal displacement and `dt` - real m/s, not a raw per-tick distance): the hit body's
velocity along the push direction is driven towards `characterSpeed * pushMass / (pushMass +
bodyMass)`, so a body much lighter than `pushMass` ends up shoved at close to the character's
own speed and a much heavier one barely moves - both proportional to the actual mass
difference, unlike Bullet's own ghost-vs-rigid-body contact response (this character is a
`btPairCachingGhostObject`, which `btRigidBody::upcast` can't resolve back to a rigid body -
the constraint solver would otherwise treat it as an immovable fixed body, so the _positional_
penetration-recovery correction it generates lands entirely on the other body regardless of
that body's own mass; `CF_NO_CONTACT_RESPONSE` on this character's ghost object, see this
class's own doc, suppresses that native response so this method is the sole source of any push
a dynamic body feels). Only sets linear velocity, never touches angular - a pushed sphere still
visibly rolls (rather than just sliding), but that now comes entirely from its own subsequent
floor-friction contacts converting slide into roll, same as it would for any other sliding
object; no per-shape special-casing needed here (see `AmmoFactory.createRigidBodyFromShape`'s
`m_rollingFriction` note for why that conversion didn't use to happen at all).

Only ever _adds_ forward velocity along the push direction (never removes any) - a body already
outrunning the character in that direction (e.g. one that was already flung away by an earlier,
harder push) is left alone rather than being slowed back down to `characterSpeed`'s pace.

**Signature**

```ts
private pushDynamicBody(hitObjectPtr: number, direction: Point3, characterSpeed: number): void
```

### refreshCG (method)

**Signature**

```ts
refreshCG(): void
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: AmmoGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: AmmoGgWorld, dispose?: boolean): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### clone (method)

**Signature**

```ts
clone(): AmmoCharacterControllerComponent
```

### entity (property)

**Signature**

```ts
entity: any
```

### radius (property)

**Signature**

```ts
readonly radius: number
```

### centersDistance (property)

**Signature**

```ts
readonly centersDistance: number
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: any
```
