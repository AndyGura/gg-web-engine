---
title: ammo/components/ammo-world.component.ts
nav_order: 10
parent: Modules
---

## ammo-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoWorldComponent (class)](#ammoworldcomponent-class)
    - [registerKinematicVelBody (method)](#registerkinematicvelbody-method)
    - [unregisterKinematicVelBody (method)](#unregisterkinematicvelbody-method)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [processCollisionEvents (method)](#processcollisionevents-method)
    - [emitCollisionStart (method)](#emitcollisionstart-method)
    - [registerCollisionGroup (method)](#registercollisiongroup-method)
    - [deregisterCollisionGroup (method)](#deregistercollisiongroup-method)
    - [detachTriggers (method)](#detachtriggers-method)
    - [reattachTriggers (method)](#reattachtriggers-method)
    - [raycast (method)](#raycast-method)
    - [closestNonTriggerHit (method)](#closestnontriggerhit-method)
    - [solidRayFallback (method)](#solidrayfallback-method)
    - [dispose (method)](#dispose-method)
    - [afterTick$ (property)](#aftertick-property)
    - [added$ (property)](#added-property)
    - [removed$ (property)](#removed-property)
    - [children (property)](#children-property)
    - [kinematicVelBodies (property)](#kinematicvelbodies-property)
    - [mainCollisionGroup (property)](#maincollisiongroup-property)
    - [maxSubSteps (property)](#maxsubsteps-property)
    - [fixedTimeStep (property)](#fixedtimestep-property)
    - [enableCollisionEvents (property)](#enablecollisionevents-property)
    - [\_dynamicAmmoWorld (property)](#_dynamicammoworld-property)
    - [lockedCollisionGroups (property)](#lockedcollisiongroups-property)

---

# utils

## AmmoWorldComponent (class)

**Signature**

```ts
export declare class AmmoWorldComponent {
  constructor()
}
```

### registerKinematicVelBody (method)

**Signature**

```ts
registerKinematicVelBody(body: AmmoRigidBodyComponent): void
```

### unregisterKinematicVelBody (method)

**Signature**

```ts
unregisterKinematicVelBody(body: AmmoRigidBodyComponent): void
```

### init (method)

**Signature**

```ts
async init(): Promise<void>
```

### simulate (method)

**Signature**

```ts
simulate(delta: number): void
```

### processCollisionEvents (method)

Derives `onCollisionStart`/`onCollisionEnd` for every `AmmoRigidBodyComponent` in this world,
once per `simulate()` call, from Bullet's own post-`stepSimulation` contact manifolds - Ammo/
Bullet has no native "collision started/ended" callback usable from this embind build (see
`gg-engine-physics-adapter-ammo`), so this is the standard `dispatcher.getNumManifolds()`
polling technique instead.

A manifold existing is not the same as two bodies actually touching - Bullet keeps a manifold
alive for a broad-phase AABB overlap even with zero narrow-phase contact points, so only a
manifold with `getNumContacts() > 0` counts. Both `AmmoTriggerComponent` (a
`CF_NO_CONTACT_RESPONSE` ghost object) and `AmmoCharacterControllerComponent` (also a ghost
object) still generate ordinary manifolds/contact points against anything they overlap - that
flag only suppresses the _solver_'s contact response, not narrow-phase manifold generation - so
this only proceeds when **both** sides of a manifold resolve to an actual
`AmmoRigidBodyComponent` via the shared `AmmoBodyComponent.nativeBodyReverseMap`; that one
`instanceof` check is what keeps triggers/character controllers out of collision events
entirely, without needing to inspect collision flags directly.

**Signature**

```ts
private processCollisionEvents(): void
```

### emitCollisionStart (method)

Builds and emits one body's own `CollisionEvent` for a just-started contact - `selfIsBody0`
says which side of the manifold `self` is on (Bullet decides this internally per pair, not by
creation/call order), which is what `position`/`normal` need to be expressed correctly in
`self`'s own frame.

**Signature**

```ts
private emitCollisionStart(
    self: AmmoRigidBodyComponent,
    other: AmmoRigidBodyComponent,
    cp: Ammo.btManifoldPoint,
    impulse: number,
    selfIsBody0: boolean,
  ): void
```

### registerCollisionGroup (method)

**Signature**

```ts
registerCollisionGroup(): CollisionGroup
```

### deregisterCollisionGroup (method)

**Signature**

```ts
deregisterCollisionGroup(group: CollisionGroup): void
```

### detachTriggers (method)

Temporarily removes every currently-in-world trigger from the broadphase, for the duration of a
query that must never resolve a hit against one - mirrors
`AmmoTriggerComponent.detachFromBroadphaseTemporarily()`/`reattachToBroadphase()`'s own doc:
a `Trigger` is a sensor with no collision response by definition (`ITrigger3dComponent`), so it
was never meant to be a solid obstacle to _any_ query, character-owned or not.

Neither `raycast()` nor `solidRayFallback()` uses this (both exclude triggers with a JS-side
post-filter instead - see `raycast()`'s own doc for why), and neither does
`AmmoCharacterControllerComponent.recoverFromPenetration()`/`trySnapToGround()` (the former
JS-filters its own `contactTest` results the same way `solidRayFallback` does; the latter calls
`raycast()` itself, which already excludes triggers on its own). Only
`AmmoCharacterControllerComponent.sweep()` still calls this: its `convexSweepTest` is driven by
`Ammo.ClosestConvexResultCallback`, which this Ammo.js build never exposes an overridable
`addSingleResult` on (unlike `ConcreteContactResultCallback`, used by the JS-filtered paths
above) - there is no JS-side hook to reject a trigger candidate mid-query for a convex sweep, so
physically excluding every trigger from the broadphase for the sweep's duration is the only
option available. Call `reattachTriggers()` with the returned array once the query is done, in a
`finally` so a throwing query still reattaches them.

**Signature**

```ts
detachTriggers(): AmmoTriggerComponent[]
```

### reattachTriggers (method)

Undoes `detachTriggers()` for exactly the triggers it returned.

**Signature**

```ts
reattachTriggers(detached: AmmoTriggerComponent[]): void
```

### raycast (method)

Never resolves a hit against a `Trigger`: a raycast is a query like any other, and a trigger
is a sensor with no collision response by definition (`ITrigger3dComponent`), so it was never
meant to obstruct one.

Uses `Ammo.AllHitsRayResultCallback` (every hit along the ray, unsorted) rather than
`ClosestRayResultCallback`, and picks the closest hit whose resolved body is _not_ an
`AmmoTriggerComponent` itself, entirely in JS (`m_hitFractions` - smaller is closer) -
deliberately **not** `detachTriggers()`/`reattachTriggers()` - neither does `solidRayFallback()`
just below it (its own `ConcreteContactResultCallback` JS-filters out a trigger candidate the
same way this method does), nor `AmmoCharacterControllerComponent.recoverFromPenetration()`/
`trySnapToGround()` (the latter calls this method directly, so it excludes triggers for free).
An earlier version of this fix used the detach/reattach pair every call, mirroring
`AmmoCharacterControllerComponent`'s own sweeps - correct, but a real, measured regression: this
world-enclosing example's own map-bounds trigger (`Trigger3dEntity` around the whole playable
area) forced Bullet to regenerate that trigger's broadphase pairs - and re-run narrow-phase
collision detection against every one of the hundreds of real (non-box, triangle-mesh) static
bodies it overlaps - on every single reinsertion, not just an O(1) broadphase bookkeeping cost.
With `PlayerCharacterController`'s third-person camera-collision raycast calling `raycast()`
every tick, this repeated full pair regeneration measured at 300+ ms per simulated frame once a
player character existed - confirmed via isolated timing around `stepSimulation` itself, and
confirmed _not_ proportional to detach/reattach call count against a synthetic scene of simple
box shapes (only real, complex mesh geometry reproduces it) - i.e. an inherent cost of repeatedly
reinserting a huge AABB against many real triangle-mesh bodies, not a bug in the detach/reattach
bookkeeping itself. The same reinsertion cost, paid many times per tick by every character's own
`recoverFromPenetration()`/`trySnapToGround()` calls (regardless of whether the camera raycast
above ever runs), is what made this worth fixing at every calling layer rather than just here -
see `detachTriggers()`'s own doc for the one remaining caller (`sweep()`) that still has to pay
it, for lack of a JS-filterable convex-sweep callback in this Ammo.js build. The post-filter
approach here touches the broadphase not at all, at the cost of Bullet reporting every hit along
the ray instead of just the closest (negligible - a ray typically crosses only a handful of
shapes).

**Signature**

```ts
raycast(options: RaycastOptions<Point3>): RaycastResult<Point3, AmmoRigidBodyComponent | AmmoTriggerComponent>
```

### closestNonTriggerHit (method)

Scans an `AllHitsRayResultCallback`'s collected hits (unsorted) for the closest one whose
resolved body is not an `AmmoTriggerComponent` - see `raycast()`'s own doc for why this replaces
a broadphase-level trigger exclusion. `m_hitFractions` is the ray parameter `t` (0 at `from`, 1
at `to`) for each parallel entry in `m_collisionObjects`/`m_hitPointWorld`/`m_hitNormalWorld` -
smaller is closer, and comparing fractions instead of recomputing distance per candidate avoids
doing that work for hits that turn out not to be the closest anyway.

**Signature**

```ts
private closestNonTriggerHit(
    rayCallback: Ammo.AllHitsRayResultCallback,
    from: Point3,
  ): RaycastResult<Point3, AmmoRigidBodyComponent | AmmoTriggerComponent>
```

### solidRayFallback (method)

Bullet's own `rayTest` (used above) can only compute an entry point when the ray _starts_
outside its target - once `options.from` is already inside (or has passed all the way through)
a convex shape, it finds nothing for that shape at all, from any distance further along the
same direction, not just while still inside it (verified empirically: a box shape stops being
hittable the instant `from` crosses into it, and stays unhittable for every `from` further past
it too). `Rapier3dWorldComponent.raycast` doesn't have this gap - it calls `castRay` with
`solid: true`, Rapier's own explicit "report a hit at zero distance on whatever contains the
ray's origin" mode - so the exact same query silently behaves differently depending on which
physics adapter a world is built with.

This came up as a real, reproducible gameplay bug: `ObjectGrabController.tryGrab()` (see its
own doc) deliberately starts its pick-up ray a fixed distance in front of the holder's camera
to dodge a self-hit on the holder's own capsule - but that same fixed offset can just as easily
land _inside_ a small grabbable prop sitting closer than that offset, which then became
silently ungrabbable on Ammo specifically (working fine on Rapier) the moment the player stood
close enough to it - exactly this gap.

Fixed by mirroring Rapier's `solid` behavior here too: whenever the plain `rayTest` above found
nothing, run one discrete point-overlap probe (`btCollisionWorld.contactTest`, the same
discrete-overlap primitive `AmmoCharacterControllerComponent.recoverFromPenetration` already
uses for an unrelated reason - see its doc) against a throwaway zero-size collision object
placed exactly at `options.from`, and report whatever it overlaps as a hit at distance 0.

**`options.collisionFilterGroups`/`collisionFilterMask` are only ever honored here as an
_extra_ narrowing on top of Bullet's own default pair filtering, never as a way to widen it** -
verified empirically, not by reading Bullet's C++ source: `ContactResultCallback`'s own
`m_collisionFilterGroup`/`m_collisionFilterMask` fields (which is what its internal
`needsCollision` actually checks a candidate's real broadphase proxy against) have no exposed
setter on `ConcreteContactResultCallback` in this Ammo.js build - `set_m_collisionFilterGroup`/
`set_m_collisionFilterMask` are simply `undefined` on a constructed instance, unlike the same
two setters on `ClosestRayResultCallback` (used by the plain `rayTest` above) which do exist.
Registering the probe itself with matching group/mask bits via `addCollisionObject` doesn't
help either (tried and measured no effect) - only the _candidate's_ proxy is ever consulted,
against the callback's own fixed default fields (`DefaultFilter`/`AllFilter` in stock Bullet).
Net effect: a candidate whose own `interactWithCollisionGroups` excludes this world's
default/main group (`mainCollisionGroup`, always group `0`) never reaches this fallback at all,
no matter what `options` asks for - an unusual configuration in practice (most bodies keep
interacting with the default group even after adding custom ones), and not one the reported
bug (`ObjectGrabController.tryGrab()`, which passes no filter at all, against a body left at
its own engine-wide default `ownCollisionGroups`/`interactWithCollisionGroups: 'all'`) ever hits

- so the manual check below still meaningfully narrows _down_ from whatever Bullet's own coarse
  default let through, it just can't rescue a candidate Bullet's fixed default already excluded
  before this callback ever ran.

**Signature**

```ts
private solidRayFallback(
    options: RaycastOptions<Point3>,
  ): RaycastResult<Point3, AmmoRigidBodyComponent | AmmoTriggerComponent> | null
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### afterTick$ (property)

**Signature**

```ts
readonly afterTick$: any
```

### added$ (property)

**Signature**

```ts
readonly added$: any
```

### removed$ (property)

**Signature**

```ts
readonly removed$: any
```

### children (property)

**Signature**

```ts
readonly children: (AmmoRigidBodyComponent | AmmoTriggerComponent)[]
```

### kinematicVelBodies (property)

Every currently-in-world `kinematic_vel` body - see `simulate()`'s own integration step.
Bullet has no native velocity-driven kinematic body (unlike Rapier's
`kinematicVelocityBased`): a `CF_KINEMATIC_OBJECT` body's transform is only ever read from
this adapter's own `position`/`rotation` writes, never integrated from `linearVelocity`/
`angularVelocity` by the dynamics solver the way a `dynamic` body's is. Maintained by
`AmmoRigidBodyComponent.addToWorld`/`removeFromWorld` - not meant to be written to directly.

**Signature**

```ts
readonly kinematicVelBodies: Set<AmmoRigidBodyComponent>
```

### mainCollisionGroup (property)

**Signature**

```ts
readonly mainCollisionGroup: number
```

### maxSubSteps (property)

Hard ceiling on how many substeps `simulate()` will ever run for one call, regardless of how
large `delta` is - protects against a single huge catch-up call (a dropped/backgrounded tab)
grinding substep-by-substep through an enormous amount of simulated time. Below this cap,
`simulate()` always runs however many substeps keep each one no longer than `fixedTimeStep` -
see that field's own doc for why a _dynamically computed_ substep count/size, not Bullet's own
built-in accumulator, is what actually gets used. `0`/`undefined` (default `100`) means no cap
at all - the cap only ever trades simulation _accuracy_ (larger-than-`fixedTimeStep` substeps)
for guaranteeing `delta` is always fully consumed in one call, never deferred.

**Signature**

```ts
maxSubSteps: number | undefined
```

### fixedTimeStep (property)

The largest a single internal substep is allowed to be, in seconds - smaller keeps the solver
(suspension springs, fast/thin shapes, etc.) accurate and stable, at the cost of more substeps
per call. Default `0.01` (10ms).

**Not passed straight through to `stepSimulation` as its own `fixedTimeStep` argument** - that
argument drives Bullet's built-in _accumulator_ (`m_localTime`), which carries whatever doesn't
divide evenly into `fixedTimeStep` over into the _next_ call. That accumulator is invisible and
harmless for a body at rest, but for anything moving it means the amount of physics time
actually simulated in a given `simulate()` call silently drifts above and below that call's own
`delta` from tick to tick, depending on the accumulator's leftover phase - since nothing else in
this engine's tick loop goes through that same accumulator (a camera driven directly off
`CharacterController3dEntity.move()`'s own un-quantized per-tick `dt`, for one), that drift shows
up as the camera and a physics-driven body disagreeing by a small, sign-flipping amount every
other frame - real, reported, reproduced symptom: back-and-forth position jitter on a
`Grabbable3dEntity` held in front of a moving/turning camera (worse the faster the camera
moves - the drift is a fixed few milliseconds' worth of position error, so it scales with
speed), and the same mechanism behind a fixed camera flickering relative to a moving raycast
vehicle, or a chase camera's target flickering relative to its spinning chassis. `Rapier3dWorldComponent.simulate`
never has this problem in the first place - it just sets its own `timestep` to `delta` and steps
once, so simulated time always exactly equals real elapsed time.

Fixed here without giving up bounded substep size at all: `simulate()` computes its own substep
count `n = ceil(delta / fixedTimeStep)` (clamped by `maxSubSteps`) and calls `stepSimulation`
with substeps of exactly `delta / n` each - always summing to exactly `delta`, every call, with
nothing ever carried over. For any `delta` that already divides evenly by `fixedTimeStep` (every
existing synthetic test in this package uses one) this reproduces Bullet's own accumulator
result exactly; for a real variable render `delta` (never an exact multiple of `0.01`) it's what
actually removes the drift, while every substep is still no larger than `fixedTimeStep` (unless
`maxSubSteps` itself has to trade accuracy for guaranteeing `delta` is fully consumed - see its
own doc). A first attempt at this fix (`maxSubSteps: 0`, Bullet's own single-step "variable
timestep" mode, mirroring `Rapier3dWorldComponent.simulate` literally) removed the drift too,
but at the cost of _all_ substepping, not just the accumulator - confirmed as a real regression,
not a hypothetical one, by this package's own test suite: a raycast vehicle's suspension
(`ammo-raycast-vehicle.component.spec.ts`) stopped settling correctly and a trigger's exit event
(`ammo-trigger.component.spec.ts`) stopped firing, from nothing more exotic than the existing
tests' own ordinary `world.simulate(60)`-per-frame loops - well short of a huge catch-up frame.
Substep chunking earns its keep for solver accuracy on every call, not just huge ones, so it's
kept unconditionally rather than only above some `delta` threshold.

**Signature**

```ts
fixedTimeStep: number | undefined
```

### enableCollisionEvents (property)

Whether `simulate()` derives `IRigidBodyComponent.onCollisionStart`/`onCollisionEnd` at all.
Defaults to `true`. Set to `false` for an app that never subscribes to either - Ammo/Bullet has
no native "collision started/stopped" callback reachable from this embind build (unlike
Rapier/matter-js, whose adapters are driven by the native engine's own edge-triggered event
queue/callback and pay nothing for a continuing contact in the first place - see
`gg-engine-physics-adapter-ammo`), so this package derives them by walking every broad-phase
contact manifold in `processCollisionEvents()`, once per `simulate()` call, unconditionally.
That walk is cheap per manifold (no per-contact-point/impulse extraction happens for a pair
already known to be touching - see that method's own doc) but still scales with the total
number of touching pairs in the world every single tick, whether or not anything is listening -
for a scene with a very large number of simultaneously-resting bodies (a big debris field, a
dense physics playground) and an app that has no use for these events at all, skipping the walk
entirely removes that cost completely. Only `IRigidBody3dComponent.onCollisionStart`/
`onCollisionEnd` are affected - `ITrigger3dComponent.onEntityEntered`/`onEntityLeft` (a
different, already-existing mechanism, driven by each `AmmoTriggerComponent`'s own
`checkOverlaps()`) keep working regardless of this setting. No other physics adapter in this
engine needs an equivalent setting: Rapier2d/3d and matter-js all derive these same events from
a native start/stop event rather than polling, so they have no comparable always-on cost to opt
out of.

**Signature**

```ts
enableCollisionEvents: boolean
```

### \_dynamicAmmoWorld (property)

**Signature**

```ts
_dynamicAmmoWorld: Ammo.btDiscreteDynamicsWorld | undefined
```

### lockedCollisionGroups (property)

**Signature**

```ts
lockedCollisionGroups: number[]
```
