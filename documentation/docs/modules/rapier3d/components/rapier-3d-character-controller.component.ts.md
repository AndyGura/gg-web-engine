---
title: rapier3d/components/rapier-3d-character-controller.component.ts
nav_order: 138
parent: Modules
---

## rapier-3d-character-controller.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dCharacterControllerComponent (class)](#rapier3dcharactercontrollercomponent-class)
    - [syncColliderTransform (method)](#synccollidertransform-method)
    - [move (method)](#move-method)
    - [pushDynamicBodies (method)](#pushdynamicbodies-method)
    - [computeGroundNormal (method)](#computegroundnormal-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [name (property)](#name-property)
    - [radius (property)](#radius-property)
    - [centersDistance (property)](#centersdistance-property)
    - [\_nativeBody (property)](#_nativebody-property)
    - [\_nativeCollider (property)](#_nativecollider-property)
    - [\_nativeController (property)](#_nativecontroller-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [collisionGroups (property)](#collisiongroups-property)

---

# utils

## Rapier3dCharacterControllerComponent (class)

A capsule-shaped kinematic character controller backed by Rapier's own `KinematicCharacterController`
(`world.createCharacterController`). `move()` is made fully synchronous (see
`ICharacterController3dComponent`'s doc for why this matters) by never relying on
`setNextKinematicTranslation` + a later `world.step()` to actually reposition the body - the plain
(non-"next") `RigidBody.setTranslation`/`setRotation` is used instead, immediately followed by
`World.propagateModifiedBodyPositionsToColliders` so the capsule's new position is visible to
Rapier's collider state (and thus to the _next_ `move()` call, or to any raycast) without needing a
simulation step in between. `setNextKinematicTranslation`/`setNextKinematicRotation` are
additionally set to the same target so that dynamic bodies pushed by the character still get a
reasonable velocity estimate on whatever `world.step()` happens to run afterwards - this is a
nice-to-have, not load-bearing for the synchronous contract.

Note: a collider only enters Rapier's broad-phase as part of a `World.step()` - a level's static
geometry (or this character itself) created and never stepped even once is invisible to `move()`'s
sweep test, exactly as it would be to `world.raycast()`. This is a pre-existing engine property, not
specific to this component; a normal per-frame game loop that calls `physicsWorld.simulate()`
every tick already satisfies it after the first tick.

Note: unlike `Rapier3dRigidBodyComponent`/`Rapier3dTriggerComponent`, this component's native body
handle is _not_ registered in `Rapier3dWorldComponent.handleIdEntityMap` - `world.raycast()` cannot
currently resolve a hit against a character controller back to this component (it will simply be
absent from `RaycastResult.hitBody`). Wiring that up would require widening the reverse-map's and
`raycast()`'s return-type generics repo-wide for a corner case outside this interface's contract;
left as a documented limitation rather than done speculatively.

**Signature**

```ts
export declare class Rapier3dCharacterControllerComponent {
  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected readonly options: Required<CharacterController3dOptions>,
    protected _bodyDescr: RigidBodyDesc
  )
}
```

### syncColliderTransform (method)

Makes any position/rotation change applied directly to `_nativeBody` (outside of `move()`, e.g.
via the `position`/`rotation` setters) immediately visible to Rapier's collider state, without
requiring a `world.step()` - see the class doc for why this matters. The pinned
`@dimforge/rapier3d-compat` build only exposes `propagateModifiedBodyPositionsToColliders()` for
this (no separate `QueryPipeline`/`updateSceneQueries` object to rebuild - the character
controller queries `World`'s live `broadPhase`/`narrowPhase` directly), so that's the only call
needed here.

**Signature**

```ts
private syncColliderTransform(): void
```

### move (method)

**Signature**

```ts
move(desiredTranslation: Point3, dt?: number): void
```

### pushDynamicBodies (method)

Shoves any dynamic body this tick's sweep bumped into - see `addToWorld`'s doc for why this is
hand-rolled rather than Rapier's own `setApplyImpulsesToDynamicBodies`. Mirrors
`AmmoCharacterControllerComponent.pushDynamicBody` exactly: models the contact as a simple
inelastic collision against a virtual body of mass `options.pushMass` moving at `characterSpeed`
(this tick's _horizontal_ displacement - vertical/jump motion never pushes anything sideways -
converted to a real m/s via `dt`, not a raw per-tick distance), driving the hit body's velocity
along the push direction towards `characterSpeed * pushMass / (pushMass + bodyMass)` and only
ever adding forward velocity, never removing any (so a body already outrunning the character in
that direction is left alone). `computedCollision()` already has everything needed - populated
by the `computeColliderMovement` call above regardless of this method's own logic, so no extra
sweep/query is needed to reach it.

**Signature**

```ts
private pushDynamicBodies(desiredTranslation: Point3, dt: number | undefined): void
```

### computeGroundNormal (method)

Rapier's character controller doesn't expose a single "ground normal" directly - only a list of
per-obstacle collisions (`computedCollision`) from the last `computeColliderMovement` call, each
with its own contact normal. Best-effort approach: scan those collisions and return whichever
normal points _most_ nearly along `up` (i.e. the most floor-like of the bunch, however steep it
actually is) - this deliberately does **not** discard a candidate merely for being steep (e.g.
balanced on the flank of a sphere/cylinder, far past `maxSlopeClimbAngleRad`): that judgment
belongs entirely to `CharacterController3dEntity.isWalkableGround` at the core level, which
needs the _real_ contact normal to make it, not a value already pre-filtered down here. An
earlier version discarded any candidate with `dot(normal, up) <= 0.1` and fell back to the plain
`up` vector when nothing cleared that bar - which silently reported perfectly-flat ground for a
character resting against a normal steep enough to fail that same threshold, defeating
`isWalkableGround` entirely (confirmed empirically: a character run-and-jumped onto the flank of
a static sphere, landing on a contact whose true outward normal was ~70° off `up` - well past the
default ~50° `maxSlopeClimbAngleRad` - permanently reported `groundNormal: {0,0,1}` instead, so
the core entity kept treating it as resting on flat ground and it never slid off, visibly stuck
balanced on a sliver of the sphere even with every input released).

`numComputedCollisions()` itself is frequently `0` on a call that is still genuinely grounded -
`computeColliderMovement` doesn't record an entry for a character caught by snap-to-ground alone
(no obstacle actually blocked the _desired_ movement that call), which in practice is most idle
ticks: a character standing still (`desiredTranslation` exactly `{0,0,0}`, e.g. player released
every key) has nothing for the sweep to hit, so it settles into being grounded via snap alone,
over and over, tick after tick, without ever producing a fresh collision entry again. Guessing
flat `up` on every such tick is exactly the bug above, just via a different, far more common
path than "no collision was ever recorded" suggests - it's not a rare edge case, it's what happens
the very first idle tick after any landing (including this one, right after the collision that
_did_ populate the true steep normal above). Fix: on a `0`-collision grounded call, reuse
whichever normal this same field already held **before** this call (the character's own contact
geometry hasn't changed just because this particular call didn't happen to re-sweep it) rather
than guessing - `move()` only overwrites `this._groundNormal` with this method's return value
_after_ calling it, so reading the field here still sees the previous call's result. Only when
there is no prior normal to reuse either (the very first grounded call ever, landing exactly via
snap with nothing recorded yet) does this fall back to the plain `up` vector. Returns `null` if
not grounded at all - `_groundNormal` naturally clears itself the moment the character goes
airborne, so a later landing never reuses a stale value from a previous, unrelated surface.

**Signature**

```ts
private computeGroundNormal(): Point3 | null
```

### clone (method)

**Signature**

```ts
clone(): Rapier3dCharacterControllerComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Rapier3dGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### entity (property)

**Signature**

```ts
entity: any
```

### name (property)

**Signature**

```ts
name: string
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

### \_nativeBody (property)

**Signature**

```ts
_nativeBody: any
```

### \_nativeCollider (property)

**Signature**

```ts
_nativeCollider: any
```

### \_nativeController (property)

**Signature**

```ts
_nativeController: any
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: any
```

### collisionGroups (property)

**Signature**

```ts
collisionGroups: any
```
