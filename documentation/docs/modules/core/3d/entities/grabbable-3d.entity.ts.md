---
title: core/3d/entities/grabbable-3d.entity.ts
nav_order: 60
parent: Modules
---

## grabbable-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Grabbable3dEntity (class)](#grabbable3dentity-class)
    - [grab (method)](#grab-method)
    - [release (method)](#release-method)
    - [throw (method)](#throw-method)
    - [updateHold (method)](#updatehold-method)
    - [onRemoved (method)](#onremoved-method)
    - [grabOptions (property)](#graboptions-property)
  - [Grabbable3dEntityOptions (type alias)](#grabbable3dentityoptions-type-alias)

---

# utils

## Grabbable3dEntity (class)

A dynamic-body prop that can be picked up and carried, HL2/Portal-`+use`-key style - pair with
`ObjectGrabController` for the input side (raycasting to find one in reach, binding grab/throw/
drop to keys/mouse buttons), or drive it manually by calling `grab()`/`updateHold()`/`release()`/
`throw()` yourself.

Carrying is implemented as a velocity spring, **not** a position teleport: `updateHold()` sets
`objectBody.linearVelocity` towards the target hold point every tick rather than overwriting
`position` directly, so the physics engine's own collision resolution still applies while
carried (the object gets stopped/deflected by geometry in the way, instead of tunnelling through
it and then exploding back out from deep penetration the instant it's released or bumps
something - the classic failure mode of teleport-style carrying). This does mean a carried
object can visibly lag behind the target hold point when pressed against an obstruction, and can
still be knocked around by other dynamic bodies while held (both deliberate - see
`ObjectGrabController`'s doc for why that's the desired feel, matching Source's own physgun
rather than a rigid attachment).

There is deliberately no core-level "disable gravity for this body" primitive backing this
class (no physics adapter exposes one) - `updateHold()` instead compensates for gravity
algebraically, by subtracting one frame's worth of the world's gravity vector from the velocity
it sets. This only approximately cancels out: the physics engine's own `simulate()` call may run
several native substeps internally for one `updateHold()` call (this entity only gets to set
velocity once per frame, before `simulate()` runs), each re-integrating gravity on top of
whatever velocity was set, so a held object can sag very slightly between updates at high
substep counts - imperceptible in practice, and no worse an approximation than
`CharacterController3dEntity`'s own per-tick gravity integration.

**`objectBody` should be created with `ccd: true`.** The hold spring can drive a body at up to
`maxFollowSpeed` (20 m/s by default) directly at whatever the camera is aimed through, including
thin static geometry - exactly the fast-moving-dynamic-body scenario `BodyOptions.ccd` exists
for (see its own doc), and without it a hard enough push can cross a wall's thickness within a
single physics step. A high `restitution` on `objectBody` is also worth avoiding for the same
underlying reason from the other direction: pinned against geometry it can't get through, the
spring re-asserts full into-the-obstacle velocity every tick regardless of what the solver did
the tick before, so a bouncy restitution fights that every contact tick and reads as a visible
jitter (how pronounced this looks is adapter-dependent - some engines' discrete collision
detection resolves the resulting shallow penetration into a visible bounce loop every tick,
where `ccd` alone doesn't help since the body was never moving fast enough per step to actually
tunnel) rather than the object settling flush against the surface.

**Signature**

```ts
export declare class Grabbable3dEntity<TypeDoc> {
  constructor(
    options: {
      object3D?: TypeDoc['vTypeDoc']['displayObject'] | null
      objectBody?: TypeDoc['pTypeDoc']['rigidBody'] | null
    },
    grabOptions: Partial<Grabbable3dEntityOptions> = {}
  )
}
```

### grab (method)

Starts carrying this object: temporarily removes `ignoreCollisionGroups` from
`objectBody.interactWithCollisionGroups` (restored by `release()`/`throw()`), and zeroes the
object's current velocity so `updateHold()`'s spring starts clean instead of fighting whatever
motion it had the instant before being grabbed. A no-op if already held.

`ignoreCollisionGroups` is a generic, low-level knob - whatever groups it names are simply
removed from this object's own mask for as long as it's held, for any reason an app might want
that. It is **not** how to stop this object from colliding with whoever is holding it: excluding
a specific holder this way only works if the object and the holder don't otherwise share a group
both need for ordinary world collision, which in practice they almost always do (both usually
need to keep colliding with the level's static geometry) - see
`ICharacterController3dComponent.ignoredBodies`'s doc for the actual mechanism that handles that
case (already wired up automatically by `ObjectGrabController` when constructed with a `holder`).
Passing every group the intended holder's own `ownCollisionGroups` happens to report (e.g. a
character controller left at its default `ownCollisionGroups: 'all'`, which reports _every_
registered group, not just "this character's own") filters all of them out of
`interactWithCollisionGroups`, leaving this object colliding with nothing at all - not just the
intended target - for as long as it's held.

**Signature**

```ts
grab(ignoreCollisionGroups: ReadonlyArray<CollisionGroup> = []): void
```

### release (method)

Stops carrying this object, restoring the collision groups `grab()` removed. Leaves whatever
velocity `updateHold()` last set on it (a gentle "let go in place") - use `throw()` instead to
impart a deliberate outward velocity on release. A no-op if not currently held.

**Signature**

```ts
release(): void
```

### throw (method)

Stops carrying this object (same bookkeeping as `release()`) and immediately imparts
`velocity` to it - used for a forward "punt" instead of a gentle drop.

**Signature**

```ts
throw(velocity: Point3): void
```

### updateHold (method)

Drives the held object towards `targetPosition` this tick via a velocity spring (see this
class's own doc for why a velocity, not a position teleport) and damps its angular velocity
per `grabOptions.angularDamping`. Force-`release()`s instead if `targetPosition` is currently
farther than `grabOptions.maxHoldDistance` from the object - see that option's doc.

**Never slows the object down below whatever speed it already has towards `targetPosition`** -
only ever raises its speed in that direction up to the spring's own value, never lowers it (the
spring's _perpendicular_ component is still applied as normal, correcting sideways drift).
Mirrors `AmmoCharacterControllerComponent.pushDynamicBody`'s own "only ever adds, never removes"
rule: a body already moving _towards_ the hold point faster than the spring would carry it - e.g.
bumped or shoved there by something else entirely (another dynamic body, not the holder - the
holder's own movement never contests a held object's position in the first place, see
`ObjectGrabController`'s `ignoredBodies` doc) - is left alone instead of having that speed
immediately overwritten with the spring's own, smaller one purely because the object happens to
already be close to `targetPosition`. It keeps that speed (redirected exactly at
`targetPosition`, not left along whatever direction it was originally pushed in) until it either
arrives or drifts past the target, at which point ordinary spring behavior resumes from the other
side.

**Once `UNBLOCK_STREAK` consecutive ticks pass without the previous tick's commanded velocity
actually being achieved, this tick's commanded velocity is rate-limited to
`grabOptions.maxAcceleration`** - see that constant's and that option's own doc for why this is
conditional (an _unconditional_ cap makes ordinary fast turns feel sluggish), why it's a streak
and not a single-tick check (a lone noisy "achieved" tick while still genuinely pinned against a
wall re-arms a full-power push right when the object is already close to it - worse than either
an always-on or a naive single-tick-gated cap), and why it exists at all (a real, reproduced
tunneling/jitter bug otherwise: a blocked object gets its full-speed into-the-obstacle command
re-issued outright every single tick regardless of what the solver did the tick before). Applied
last, after both the `maxFollowSpeed` clamp and the "never slows down" rule above.

Must be called once per tick, **before** `IPhysicsWorld3dComponent.simulate()` runs that same
tick - i.e. from a driver with `tickOrder < TickOrder.PHYSICS_SIMULATION` (e.g.
`ObjectGrabController`, or your own equivalent) - for the velocity set here to actually be
integrated this frame. Deliberately **not** called from this entity's own `tick$`:
`Entity3d`'s inherited `tickOrder` (`OBJECTS_BINDING`) runs _after_ physics simulation, to sync
the mesh from the just-simulated body - the opposite direction from what the hold spring
needs - so this class does not add a second, earlier `tick$` subscription of its own. A no-op
if not currently held, or if this entity hasn't been spawned into a world with a physics
world yet.

**Signature**

```ts
updateHold(targetPosition: Point3, dt: number): void
```

### onRemoved (method)

**Signature**

```ts
onRemoved(): void
```

### grabOptions (property)

**Signature**

```ts
readonly grabOptions: Grabbable3dEntityOptions
```

## Grabbable3dEntityOptions (type alias)

Tuning for a `Grabbable3dEntity`'s hold behavior - how it's driven towards the carrier's hold
point while held, and when it gives up rather than fighting geometry it got squeezed into.

**Signature**

```ts
export type Grabbable3dEntityOptions = {
  /**
   * How strongly (per second) the held object's velocity is driven towards the target hold
   * point - effectively a spring constant. Higher snaps to the hold point faster/stiffer, lower
   * feels heavier/springier. Default 12.
   */
  followStrength: number
  /** Hard cap on the linear speed used to chase the hold point, in m/s. Default 20. */
  maxFollowSpeed: number
  /**
   * Cap on how fast the held object's *commanded* velocity is allowed to change per second, in
   * m/s² - but **only while `updateHold()` detects the previous tick's commanded velocity wasn't
   * actually achieved** (see this class's own doc for why: pushed hard against a wall, the object's
   * actual velocity gets stopped/bounced back by the solver each tick, but with no cap the very next
   * tick immediately re-commands the *same* full-speed push straight back into the wall, over and
   * over - depending on the physics engine this either reads as visible jitter or, worse, eventually
   * breaks through entirely once repeated small residual penetrations add up enough that most
   * engines' CCD/TOI sweep can no longer find a valid time-of-impact from an already-overlapping
   * start).
   *
   * Applying this cap *unconditionally* (every tick, blocked or not) was tried first and reverted -
   * a real, reported regression, not a hypothetical: an unobstructed carry needs to swing its
   * commanded velocity by up to `2 × maxFollowSpeed` in a single tick on an ordinary fast turn (the
   * target point can reverse direction almost outright - see `maxHoldDistance`'s own doc on how far
   * it can jump), and an unconditional cap throttles that exactly as hard as it throttles a genuinely
   * blocked push, adding a sluggish, unintended "inertia" to every turn instead of just the
   * once-in-a-while wall-pinned case. Gating the cap on "was last tick's command actually achieved"
   * tells these two cases apart: a free turn's new command gets achieved essentially in full the very
   * next tick (nothing resists it), so the cap never engages; a wall-pinned push keeps failing to be
   * achieved tick after tick, so the cap stays engaged for as long as that persists. Default 60 -
   * only needs to be low enough to stop the creep once blocked is actually detected (confirmed safe
   * well below the ~700-800 m/s² point where a standalone wall-push repro at this class's own
   * default spring constants started tunnelling again), not to feel snappy on its own, since once
   * blocked is detected it's no longer trying to feel snappy - it's trying to stop.
   */
  maxAcceleration: number
  /**
   * How strongly the held object's own angular velocity is damped back towards zero each tick -
   * `0` leaves it entirely alone (spins freely off whatever momentum it had when grabbed), `1`
   * zeroes it outright every tick (rigid, non-spinning while carried, closest to Source's
   * physcannon feel). Default 1.
   */
  angularDamping: number
  /**
   * If the hold target ever ends up farther than this from the object's actual position (e.g. it
   * got squeezed into a wall/corner it can't be dragged through), it is force-`release()`d instead
   * of being fought back out with an ever-growing spring velocity. In meters. Default 8.
   *
   * Set this comfortably larger than twice whatever `holdDistance` the driving controller uses
   * (e.g. `ObjectGrabController.holdDistance`) - the hold point itself can jump by up to `2 ×
   * holdDistance` from an ordinary, deliberate fast look-around alone (the camera spinning in
   * place, not moving), even with nothing wrong or stuck: a target hold point directly in front of
   * the camera traces a sphere of that radius around the camera position as it turns, so a ~180°
   * flick moves the target by that full diameter in one or two ticks. `maxHoldDistance` set too
   * close to `2 × holdDistance` (e.g. equal to it) force-releases the object on an ordinary fast
   * turn, not just when it's genuinely stuck - reserve this threshold for the latter.
   */
  maxHoldDistance: number
}
```
