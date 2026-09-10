---
title: core/3d/entities/controllers/input/object-grab.controller.ts
nav_order: 48
parent: Modules
---

## object-grab.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ObjectGrabController (class)](#objectgrabcontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [holdPoint (method)](#holdpoint-method)
    - [holderClearance (method)](#holderclearance-method)
    - [clampAwayFromHolder (method)](#clampawayfromholder-method)
    - [tryGrab (method)](#trygrab-method)
    - [ignoreForHolder (method)](#ignoreforholder-method)
    - [unignoreForHolder (method)](#unignoreforholder-method)
    - [throwHeld (method)](#throwheld-method)
    - [dropHeld (method)](#dropheld-method)
    - [tickOrder (property)](#tickorder-property)
    - [options (property)](#options-property)
  - [ObjectGrabControllerOptions (type alias)](#objectgrabcontrolleroptions-type-alias)

---

# utils

## ObjectGrabController (class)

HL2/Portal-style "use key carries a physics prop" input controller: raycasts from `camera`'s
current position/forward direction to find a `Grabbable3dEntity` within `maxGrabDistance`,
`grabKey` picks it up (and drops it again if already holding one - a second `grabKey` press is
equivalent to the right mouse button), left mouse button throws it forward (`throwSpeed`), right
mouse button drops it in place. Mirrors `PlayerCharacterController` in shape (an input-only entity driving a
separate physics entity, reading `camera` for aim rather than owning it) - pair the two by
passing the same `keyboard`/`mouseInput`/`camera` instances to both, rather than constructing a
second `MouseInput`/`KeyboardInput` here, so pointer-lock/focus behavior stays single-sourced.

Held-object collision with the rest of the world (other dynamic bodies, static geometry) is
intentionally left enabled while carried - see `Grabbable3dEntity`'s own doc for why carrying is a
velocity spring rather than a rigid attachment. This means a carried prop can be nudged out of
position by something it bumps into, or pin against geometry it's pushed into, matching the feel
of Source's own physgun rather than a perfectly rigid hold.

**Collision with `holder` specifically is excluded outright**, not left to the physics engine's
ordinary group/mask filtering: whenever a `holder` is given, `tryGrab()` adds the held object's
`objectBody` to `holder.characterController.ignoredBodies` (removed again by whichever of
`throwHeld`/`dropHeld`/the tick loop's self-release handling ends the hold), making the object
genuinely invisible to the holder's own collision queries for as long as it's held - see
`ICharacterController3dComponent.ignoredBodies`'s doc for why a real per-pair exclusion like this,
rather than collision groups, is what the job actually needs: group/mask filtering is incapable of
excluding just this one pair while both the holder and the object still need to collide with the
rest of the world (almost always true), no matter how the groups are arranged - there used to be a
`holderCollisionGroups` option here built on exactly that approach; it never actually worked for
that reason and was removed once `ignoredBodies` shipped as the real fix. `Grabbable3dEntity.grab()`
still takes its own `ignoreCollisionGroups` parameter directly, for whatever unrelated group
exclusion an app might still want while a prop is held - just not as a way to exclude `holder`.

**The hold point is additionally clamped away from `holder`'s own capsule** (see
`clampAwayFromHolder`) when a `holder` is given, purely to keep a resting/thrown-and-recaught prop
from visibly sitting _inside_ the holder's own model at the moment it's picked up, before the
spring has had a chance to move it - `ignoredBodies` above is what actually keeps the holder's
movement from being blocked by (or resonating with) a held prop; this clamp is a cosmetic
finishing touch on top of that, not a second line of defense against it.

`holder` is `null` for a holder with no capsule to exclude in the first place - e.g. this
controller paired with a `FreeCameraController` (a free-flying spectator/debug camera, not a
`CharacterController3dEntity`) rather than `PlayerCharacterController`. `ignoredBodies` and the
clamp are simply skipped in that case - there's no kinematic capsule for a held prop to block or
resonate with in the first place, and nothing here needs the holder to be a physics body at all
when it isn't one.

**Signature**

```ts
export declare class ObjectGrabController<TypeDoc> {
  constructor(
    protected readonly keyboard: KeyboardInput,
    protected readonly mouseInput: MouseInput,
    protected readonly camera: Renderer3dEntity<TypeDoc['vTypeDoc']>,
    /** The character whose capsule the hold point is kept clear of - see this class's own doc. Pass
     * the same character driven by the paired `PlayerCharacterController`, or `null` if there's no
     * capsule to exclude (e.g. paired with a `FreeCameraController` instead). */
    protected readonly holder: CharacterController3dEntity<TypeDoc> | null,
    options: Partial<ObjectGrabControllerOptions> = {}
  )
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld<TypeDoc>): void
```

### onRemoved (method)

**Signature**

```ts
onRemoved(): void
```

### holdPoint (method)

**Signature**

```ts
private holdPoint(): Point3
```

### holderClearance (method)

Radius of a sphere around `holder` guaranteed to clear its capsule in any direction. Assumes
`holder` is set. Used both by `clampAwayFromHolder` (the hold point's own exclusion radius) and
by `tryGrab()` (as an upper-bound heuristic for "this first hit was probably my own capsule,
not a real obstacle" - see that method's own doc).

**Signature**

```ts
private holderClearance(): number
```

### clampAwayFromHolder (method)

**Signature**

```ts
private clampAwayFromHolder(target: Point3): Point3
```

### tryGrab (method)

A first-person camera sits inside (or right at the surface of) `holder`'s own capsule, so the
very first thing a raycast from `camera.position` finds along almost any forward direction is
that capsule itself, not whatever's actually being aimed at - `holder.characterController`
isn't reliably resolvable back to `holder` from a `RaycastResult` on every adapter either (e.g.
`Rapier3dCharacterControllerComponent`'s own doc - its collider is never registered for that),
so this can't be told apart from "some other real obstacle" by identity.

**This used to be dodged by starting the ray a fixed `holderClearance()` distance in front of
the camera instead of at it - a worst-case guess at how big `holder`'s own capsule can possibly
be, not where it actually ends along _this_ particular ray.** That guess overshoots dramatically
for a camera pitched steeply down at something close and small (the common case for a resting
prop, which sits well below eye height) - real, reproduced bug: standing close enough to a small
grabbable prop resting on a pedestal, the fixed skip flew straight past the prop _and_ landed
inside the pedestal underneath it, so the ray reported a legitimate hit on the (non-grabbable)
pedestal instead of ever reaching the prop, silently blocking the pick-up.

**Fixed with a real two-pass cast instead of a guessed skip distance**: cast once from the
actual `camera.position` first. If that hit is already a `Grabbable3dEntity`, done - grab it,
no retry needed (handles a prop close enough to be found before any self-hit would even occur).
Otherwise, only if the hit is closer than `holderClearance()` could ever put a _different_
object (given the camera sits on/within the capsule's own axis, nothing external can
legitimately be that close without already overlapping the holder, an already-broken physics
state this doesn't need to handle) - retry from exactly where that first hit exits (plus
`SELF_HIT_SKIN`, a small fixed clearance for ordinary surface float tolerance, not a guess at
anything holder-sized) rather than from an arbitrary fixed distance. A hit farther than
`holderClearance()` away is trusted as a real obstacle and left blocking the grab, same as
before - this only changes what happens for a hit close enough to plausibly be the holder's own
capsule, never lets the ray skip through genuinely distant geometry.

**Signature**

```ts
private tryGrab(): void
```

### ignoreForHolder (method)

Adds `obj.objectBody` to `holder.characterController.ignoredBodies` (see that property's own
doc) so the holder's own collision queries never treat the object it's currently carrying as an
obstacle - a no-op if there's no `holder`, or `obj` has no `objectBody` (impossible in practice -
`Grabbable3dEntity`'s constructor requires one - but `objectBody`'s own type is nullable, see
`Entity3d`). Always paired with `unignoreForHolder` on the same object before it stops being
held, from every path that can end a hold (`throwHeld`/`dropHeld`, and the tick loop's own
handling of `updateHold`'s self-release) - not just this class's own drop/throw methods, since
leaving a stale entry in `ignoredBodies` would keep a since-dropped, no-longer-special object
permanently invisible to the holder's own collision queries.

**Signature**

```ts
private ignoreForHolder(obj: Grabbable3dEntity<TypeDoc>): void
```

### unignoreForHolder (method)

Undoes `ignoreForHolder` - see its own doc.

**Signature**

```ts
private unignoreForHolder(obj: Grabbable3dEntity<TypeDoc>): void
```

### throwHeld (method)

**Signature**

```ts
private throwHeld(): void
```

### dropHeld (method)

**Signature**

```ts
private dropHeld(): void
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
```

### options (property)

**Signature**

```ts
readonly options: ObjectGrabControllerOptions
```

## ObjectGrabControllerOptions (type alias)

Options for an `ObjectGrabController`.

**Signature**

```ts
export type ObjectGrabControllerOptions = {
  /**
   * Key code that toggles carrying: while empty-handed, picks up whatever `Grabbable3dEntity` the
   * camera is looking at within `maxGrabDistance`; while already holding something, drops it (same
   * as the right mouse button - see `dropHeld`). Default 'KeyE'.
   */
  grabKey: string
  /** Max raycast distance from the camera that counts as "in reach" to pick something up, in meters. Default 3. */
  maxGrabDistance: number
  /** Distance in front of the camera the held object is carried at, in meters. Default 1.5. */
  holdDistance: number
  /** Speed imparted to a thrown object along the camera's forward direction, in m/s. Default 12. */
  throwSpeed: number
  /**
   * Extra clearance kept, in meters, beyond `holder`'s own capsule (radius and half-height alike)
   * when clamping the hold point away from it - see this class's own doc for why the hold point is
   * clamped there at all. `0` lets the target land right on the holder's surface (the carried object
   * still visibly touches the holder at that point); the default leaves a small visible gap instead.
   * Default 0.3.
   */
  holderExclusionMargin: number
}
```
