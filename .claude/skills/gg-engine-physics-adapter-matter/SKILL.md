---
name: gg-engine-physics-adapter-matter
description: Known, already-solved implementation pitfalls specific to packages/matter (the matter-js 2D physics adapter) - removeFromWorld/dispose semantics, @types/matter-js version-bump typing gotchas, flattening COMPOUND shapes into leaf Body.create({ parts }) entries, the from-scratch discrete-query character controller, a critical Body.setPosition/setAngle-vs-raw-field-write gotcha in MatterFactory, the hand-rolled segment-vs-polygon raycast() implementation, and MatterFactory.createRigidBody wiring ownCollisionGroups/interactWithCollisionGroups through to the component. Use when fixing or extending packages/matter itself, not when building a new physics adapter from scratch (see gg-engine-physics-adapter for the general contract every adapter implements).
---

# packages/matter implementation notes

This file is `matter-js`-specific history: real issues hit and fixed while building `packages/matter`,
kept here so nobody re-discovers them from scratch while touching that package again. Read
`gg-engine-physics-adapter` first for the general interface contract - everything below assumes that
contract.

## The `removeFromWorld(dispose)` contract, Matter specifics

`matter-js` is pure JS, GC-managed - it has no native/WASM handles at all, unlike Ammo or Rapier, so
`dispose()` never has to free anything native. `removeFromWorld` threads `dispose` through and calls
`this.dispose()` on both `MatterRigidBodyComponent` and `MatterTriggerComponent`.
`MatterRigidBodyComponent.dispose()` completes its own `onCollisionStart$`/`onCollisionEnd$` RxJS
subjects (the ones backing `onCollisionStart`/`onCollisionEnd`). `MatterTriggerComponent` overrides
`dispose()` to *additionally* complete its own `onEnter$`/`onLeft$` subjects before calling
`super.dispose()` to complete the inherited pair too.

Separately, `MatterRigidBodyComponent.removeFromWorld` also emits `onCollisionEnd(null)` on every
other body this one is still touching at the moment of removal (tracked via a `currentContacts`
`Set<MatterRigidBodyComponent>`, populated/drained by `notifyCollisionStart`/`notifyCollisionEnd` -
see the "Wiring `onCollisionStart`/`onCollisionEnd`" section below) - this is what backs
`onCollisionEnd`'s documented "`null` when the other body was removed from the world while still in
contact" case. This fires unconditionally on every `removeFromWorld` call (dispose or not), since it
reflects the body actually leaving the world, not memory cleanup.

## Wiring `onCollisionStart`/`onCollisionEnd`

`MatterRigidBodyComponent` owns the `onCollisionStart$`/`onCollisionEnd$` `Subject`s and exposes them
via the interface getters, but doesn't listen to matter-js itself - `MatterWorldComponent` registers a
single pair of `Matter.Events.on(engine, 'collisionStart'/'collisionEnd', ...)` listeners once (in
`init()`, mirroring how `simulate()`/`dispose()` already own the engine lifecycle), resolves each
`pair.bodyA`/`pair.bodyB` back to its owning component via the same `this.children.find(c =>
c.nativeBody === body)` lookup `MatterTriggerComponent` already used, and calls
`notifyCollisionStart`/`notifyCollisionEnd` on each side reciprocally. `pair.isSensor` (true whenever
either native body is a trigger's - triggers always set `isSensor = true` in their own constructor) is
skipped entirely in both listeners, so a trigger overlapping a rigid body only ever fires the
trigger's own `onEntityEntered`/`onEntityLeft`, never the rigid body's `onCollisionStart`/
`onCollisionEnd`.

Three real gotchas surfaced building this, all specific to this pinned `matter-js` 0.20.0 /
`@types/matter-js` 0.20.2:

- **No usable per-pair impulse is available at `collisionStart` time.** `Matter.Engine.update`'s
  actual event order is `collisionStart` → position solve → **velocity solve** → `collisionActive` →
  `collisionEnd`. The velocity solve (`Resolver.solveVelocity`) is what ever writes a nonzero
  `contact.normalImpulse`/`tangentImpulse` - and for a pair that's *just* starting to touch, its
  `Pair.create` always builds fresh contacts via `Contact.create()`, which hardcodes
  `normalImpulse: 0, tangentImpulse: 0`. So every pair reported by `collisionStart` has zero impulse
  data available, by construction, every single time - there is no version-specific field to dig
  for here, the data simply doesn't exist yet at that point in the frame. `impulse` is instead
  estimated as `|relativeVelocity| * min(bodyA.mass, bodyB.mass)` (a static body's `mass` is
  `Infinity`, so `min` naturally reduces to the dynamic side's mass when one side is static) - this
  is the fallback approach `gg-engine-physics-adapter`'s general task doc anticipated, not a last
  resort chosen after a better option didn't pan out.
- **`collision.supports` is a fixed-length-2 array with `null` in the unused slot(s), and
  `collision.supportCount` (the field that tells you how many are actually populated) is missing
  from `@types/matter-js` 0.20.2 entirely.** `Collision.create` initializes `supports: [null, null]`;
  narrow-phase collision fills in only the first `supportCount` entries (1 or 2) and leaves the rest
  `null` (or a stale leftover from a previous collision reusing the same record - never trust
  `.length`, it's always 2). Averaging `collision.supports` directly to get `CollisionEvent.position`
  crashes the moment a pair has only one real support point (`Pnt2.add` dereferencing the `null`
  slot). Fix: slice to `collision.supportCount` first - reading that field requires a narrow
  `as unknown as { supportCount: number }` cast since the type is absent from the `.d.ts`, not a
  wider `any` escape hatch. Re-check both this and the previous bullet after any future
  `@types/matter-js` bump in case a newer version's typings fill either gap in.
- **`collision.normal`'s actual direction is the *opposite* of what `Collision.js`'s own inline
  comment says**, and this one is worth verifying empirically rather than trusting the source
  comment if you ever touch this code again after a `matter-js` version bump. The comment claims
  "ensure normal is facing away from bodyA", but the code immediately below it
  (`delta = bodyB.position - bodyA.position; if (normal · delta >= 0) { negate normal }`)
  actually guarantees the *final* `normal · delta` is always `≤ 0` - i.e. the final normal is always
  oriented *opposite* the bodyA→bodyB direction, meaning it points **away from `bodyB`, towards
  `bodyA`** (confirmed empirically with a floor-and-falling-ball scenario of known relative
  position). Concretely: when building `CollisionEvent.normal` for each side of a pair (which must
  point away from *that* body towards the other, per the interface's own contract), `pair.bodyB`'s
  event gets `pair.collision.normal` as-is and `pair.bodyA`'s event gets its negation - backwards
  from what a literal reading of the upstream comment would suggest.

## Pitfall: a shared "native body options" object must be typed as the narrowest/most-derived type among all the call sites it's passed to

Hit bumping `@types/matter-js` 0.19.7 → 0.20.2: `Matter.Bodies.circle` still types its options as the
base `IBodyDefinition`, but `Matter.Bodies.rectangle` narrowed to `IChamferableBodyDefinition extends
IBodyDefinition` (which drops `null` from `chamfer`'s type). `MatterFactory.transformOptions()` builds
one options object shared across both calls - typing it as the base interface no longer satisfies the
narrower one under TS's stricter structural checking, even though the object literal never actually
sets the property causing the mismatch. Type the shared object as the most derived/narrow type instead
of the common base. Re-check this specifically after any future `@types/matter-js` bump - a type
package widening or narrowing one call's options independently of the others is exactly the kind of
change that only shows up as a compile error, not a runtime one.

## Sleeping-body writes: `position`/`rotation`/velocity setters preserve sleep state here, by design

`gg-engine-physics-adapter`'s general contract note describes the cross-adapter expectation that a
dynamic body's `position`/`rotation`/`linearVelocity`/`angularVelocity` setters wake a sleeping body
on write. This adapter is the one documented exception: `Body.setPosition`/`Body.setVelocity`/
`Body.setAngularVelocity` are plain field writes that never touch a body's `isSleeping` flag, so a
write to a sleeping body here takes effect (nothing is silently dropped) without waking it - a
caller that needs a write to *also* wake the body should call `wakeUp()` itself right after, and one
that must write state on a sleeping body *without* waking it (the scenario this asymmetry exists for)
can call `sleep()` again right after the write to force it back down regardless.

`MatterRigidBodyComponent.isSleeping`/`wakeUp()`/`sleep()` map onto `nativeBody.isSleeping`/
`Matter.Sleeping.set(nativeBody, false)`/`Matter.Sleeping.set(nativeBody, true)`, gated on
`!nativeBody.isStatic` - a `bodyType: 'kinematic_pos'`/`'kinematic_vel'` request also reports
`isStatic: true` under the hood (see this component's own `bodyType`/`bodyOptions` doc), so gating on
the native flag rather than `this.bodyType === 'static'` literally correctly treats both cases as
"never sleeps, both calls are no-ops" rather than just the genuinely-static one.

`Sleeping.set(body, true)` writes `body.isSleeping = true` directly, and `Engine.update`'s own
per-body integration loop skips any body with `isSleeping` true unconditionally - **not** gated
behind `engine.enableSleeping`, which only controls the *automatic*, inactivity-driven transition
into/out of sleep (`Sleeping.update`/`Sleeping.afterCollisions`, called from `Engine.update` only
when that flag is on). So `sleep()`/`wakeUp()` work correctly and take effect immediately regardless
of `enableSleeping` - confirmed by reading `Sleeping.js`/`Engine.js` directly, not assumed. What
`enableSleeping` actually gates (and what staying at its default `false` here means) is documented on
`MatterWorldComponent.init()`'s own doc comment: a body constructed through this adapter never falls
asleep *naturally* from prolonged inactivity, no matter how long it rests, only via an explicit
`sleep()` call. Re-check this doc comment (and the "still work uniformly" claim above) if a future
change ever turns `enableSleeping: true` on for this adapter.

## `bodyType: 'kinematic_pos'`/`'kinematic_vel'` and `ccd`: warn-once, fall back, never throw

matter-js has no kinematic body concept (only `isStatic`) and no continuous collision detection at
all - both genuine, long-standing upstream limitations (not a gap in this adapter package), see
`gg-engine-physics-adapter`'s own section on the general contract for why every adapter is still
expected to *accept* these `BodyOptions` fields regardless. `MatterFactory.transformOptions` is the
reference implementation of that "warn once, fall back, never throw" pattern other adapters facing an
unsupported feature should follow:

- `bodyType: 'kinematic_pos'`/`'kinematic_vel'` both fall back to `isStatic: true` - the closest
  matter-js has - with the exact same caveats as manually teleporting a `'static'` body's position by
  hand (`Body.setPosition` on a static body moves it, but doesn't push or wake anything resting on
  it the way a real kinematic body would).
- `ccd: true` is accepted and simply has no effect beyond the warning - a fast-moving or fast-driven
  body can still tunnel through thin geometry in one step.
- Both warn via `@gg-web-engine/core`'s `warnOnce(message)` (imported into `matter-factory.ts` and
  wrapped by a local `warnUnsupportedOnce` that just prefixes `[@gg-web-engine/matter]`) rather than
  `console.warn` directly at the call site - keyed on the *message*, so distinct warnings (kinematic
  vs ccd) each still get one appearance, but creating many bodies with the same unsupported request
  (e.g. spawning a dozen kinematic props) only logs once total, not once per body. Per-body/per-tick
  warnings here would be worse than no warning at all - they'd teach a developer to tune the console
  out rather than surface the one thing worth fixing. See `gg-engine-core-development` for `warnOnce`
  itself - it's a general-purpose helper, not matter-specific, and every adapter package should reach
  for it instead of hand-rolling a `Set<string>`/static-boolean dedup guard the way
  `packages/ammo`/`packages/rapier3d`'s character controllers used to for their own missing-`dt`
  warnings.

**Don't derive a body's debug-view label (`RIGID_STATIC`/`RIGID_DYNAMIC`/`RIGID_KINEMATIC`) from the
`bodyType` an app *asked for*.** An earlier version of `MatterRigidBodyComponent.debugBodySettings`
reported `RIGID_KINEMATIC` for any non-finite-mass body, on the theory that `kinematic_pos`/
`kinematic_vel` requests should show as kinematic in the debugger - but that mislabeled every genuine
`'static'` body as kinematic too (matter-js's `isStatic` can't distinguish "asked for static" from
"asked for kinematic, fell back to static" once the body actually exists, and this component doesn't
separately track the original request). Fixed by going back to deriving the label from what the body
*physically is* (`isFinite(mass) ? RIGID_DYNAMIC : RIGID_STATIC`) - the console warning at creation
time is what tells a developer their kinematic request wasn't honored; the debug view's job is to show
real physics state, not restate the app's original ask.

## `COMPOUND` shapes: flatten to leaf parts, don't nest composite bodies

`Body.create({ parts })` does **not** descend into a part that is itself a multi-part compound
body - `Body.setParts` just pushes each element of the `parts` array you pass it into the new
body's own `.parts`, verbatim; if one of those elements already has its own `.parts.length > 1`
(because it's itself the result of an earlier `Body.create({ parts })` call), the outer body ends
up with exactly one part that Matter's own narrowphase can't correctly treat as a compound shape.
Confirmed empirically: building a nested `COMPOUND` (a `COMPOUND` child whose own `shape` is
another `COMPOUND`) by recursively calling a single "build one full `Body`" helper and passing the
nested body straight into the parent's `parts` array produced a parent with only 3 parts where 5
leaf shapes were expected.

The fix (see `MatterFactory.createShapeParts`) is to make the recursive shape-building helper
return a **flat array of leaf part `Body`s** rather than one `Body`, with `COMPOUND` itself
recursing and flattening: for each child, recursively get its own flat leaf-part array, then
re-home every one of those parts by rotating its already-set local `position` by this level's
`rotation` and translating by this level's `position` (`Vector.add(Vector.rotate(part.position,
rotation), Vector.create(position))`), and incrementing its `angle` by this level's `rotation`.
Only the outermost call wraps the fully-flattened array in one `Body.create({ parts, ...options })`.
This mirrors what `packages/rapier2d`/`packages/rapier3d` already have to do for the same underlying
reason (their `ColliderDesc[]` has no native nesting either) - see `gg-engine-physics-adapter`'s own
`COMPOUND` note. Only Ammo/Bullet's `btCompoundShape` can nest a child compound shape directly
without flattening, because Bullet's narrowphase itself walks nested compound shapes recursively.

## Critical: `MatterFactory.createRigidBody`/`createTrigger` must move a freshly-built shape via `Body.setPosition`/`Body.setAngle`, never a raw `.position =`/`.angle =` field write

Every shape-building helper in `MatterFactory` (`Bodies.rectangle`/`Bodies.circle`/`Bodies.fromVertices`,
and the `COMPOUND` case's own `Body.create({ parts })`) is always called at local origin (`x=0, y=0`) -
the desired world transform is applied afterward. `Body.create`'s own internal `_initProperties` only
ever translates a fresh body's `.vertices`/`.bounds` to match `.position` **once, at that origin**, so a
following plain `nativeBody.position = Vector.create(x, y)` (or, worse, mutating `.position.x`/`.position
.y` in place, as `createTrigger` used to) changes what `.position` *reports* without moving the real
collision geometry at all - `.vertices`/`.bounds` stay wherever they were built, permanently desynced
from `.position` until something else corrects them. Confirmed empirically (see the worked example
below) and was one of two bugs behind this file's own `MatterTriggerComponent` test suite's
long-standing FIXME ("spawning objects on some coordinates seems to cause collisions with all the
objects that intersect the line between (0, 0) and desired position, sensors are flying away to the
infinity") - a body's vertices sitting at the origin while `.position` claims otherwise is exactly what
produces that symptom. This fix alone was only enough to unblock 3 of the suite's 5 `it.skip`s once
they were re-enabled - see the next section for the second, unrelated bug the other 2 needed.

```js
const b = Bodies.circle(0, 0, 1, {});
b.position = Vector.create(-5, 0);           // WRONG - .bounds stays at (-0.951..0.951, -1..1)
Body.setPosition(b, Vector.create(-5, 0));   // RIGHT - .bounds becomes (-5.951..-4.049, -1..1)
```

**Why this was so easy to miss**: any real per-frame game loop (or a test that calls `world.simulate()`
with a real nonzero delta many times) self-corrects within the very first step - `Body.update`'s Verlet
integration computes that step's implied velocity from `position - positionPrev`, and `positionPrev` is
still whatever it was at *creation* (the origin), so the first step applies one enormous one-time
"catch-up" jump that drags the real vertices to roughly match `.position`. This makes the bug **entirely
invisible** to any rigid-body/trigger test that simulates for a while before asserting anything, or to
any real app (which always steps the world before rendering/reading state back) - it only actually
manifests for a caller that queries collision geometry before any simulation step ever runs. That is
exactly `MatterCharacterControllerComponent`'s situation (see this file's own section below: its
`Query.collides` calls never go through `Engine.update` at all, by design), and it would bite on the very
first frame after a level loads a floor/wall at a non-origin position and spawns a character on the same
tick - `CharacterController2dEntity`'s tick order runs before `IPhysicsWorld2dComponent.simulate()` each
frame, so nothing would ever have "caught up" the obstacles' geometry yet. Fixed at the source
(`MatterFactory.createRigidBody`/`createTrigger`, both call sites) rather than worked around per-caller.

**Collateral effect on `test/components/matter-rigid-body-collision.spec.ts` worth knowing about**: two
resting-contact tests in that file were (unknowingly) tuned against the *buggy* trajectory - one used the
bug's own one-time "catch-up" jump to get an early, spurious contact; without the bug, a `CIRCLE` shape
resting under weak gravity with `frictionAir` zeroed out never actually settles in this engine at all
(confirmed by tracing it for 1000+ steps: it just takes longer to numerically drift/roll away instead of
settling, regardless of the position bug) - it's a real, pre-existing energy-accumulation characteristic
of an un-substepped, non-sleeping resolver, not something this fix introduced. Both tests were changed to
use a `BOX` (no rolling degree of freedom) and matter's own default `frictionAir` (not zeroed - some
velocity damping is what actually lets resting energy bleed off instead of slowly accumulating over
hundreds of steps), and one no longer hardcodes a "wait N steps, then knock it away" magic constant -
it reacts to the real `onCollisionStart` event instead, since the exact number of steps a fall of a given
distance/speed takes to make contact isn't what that test means to assert. If you ever need a
CIRCLE-on-floor resting scenario specifically, budget for this - it is not this engine's strong suit.

**The same rule applies to `MatterRigidBodyComponent`'s own `position`/`rotation` setters, used at
runtime on a body already in the world - not just to `MatterFactory`'s one-time initial placement
above - and for a different reason: velocity corruption, not permanent geometry desync.**
`MatterRigidBodyComponent.position`'s setter calls `Body.setPosition(this.nativeBody, ...)`, and
`rotation`'s setter calls `Body.setAngle(this.nativeBody, value)` (both with the library's default,
implicit `updateVelocity: false` - i.e. never passing `true`). Both native functions, called this way,
shift the body's internal `positionPrev`/`anglePrev` bookkeeping by the same delta as `position`/
`angle` itself, so the *next* `Engine.update` computes the same `linearVelocity`/`angularVelocity` it
would have without the write - exactly like teleporting a body by re-deriving its previous-position
history, not by injecting a velocity spike. A raw `nativeBody.position = ...`/`nativeBody.angle = ...`
field write, by contrast, moves the current value but leaves `positionPrev`/`anglePrev` stale at the
old value - `Body.update`'s Verlet integration reads that gap as one tick's worth of implied velocity
on the very next `simulate()` call, silently overwriting whatever real `linearVelocity`/
`angularVelocity` the body had a moment before with a large, spurious one derived from the jump. This
is the velocity-corruption counterpart to the geometry-desync bug documented above for
`MatterFactory`'s shape-placement call sites - both are instances of "never write `.position`/`.angle`
directly on a Matter body, always go through `Body.setPosition`/`Body.setAngle`", just surfacing
through different symptoms depending on whether the raw write happens before the body's first
simulation step (permanently stale vertices/bounds) or after (a one-tick velocity spike on the next
step). Pass `updateVelocity: true` explicitly only when a caller actually wants the write itself to
*become* the body's new velocity (inferred from the jump) rather than preserving whatever velocity it
already had - neither setter here does, matching how `linearVelocity`/`angularVelocity` are exposed as
their own independent settable properties on this component.

## `MatterTriggerComponent.currentOverlaps` must actually be populated, and a removed body must trigger an explicit exit

The other bug behind the same long-standing `MatterTriggerComponent` test suite FIXME (the position-write
bug above accounted for 3 of its 5 `it.skip`s; this one accounted for the remaining 2, both about
`removeFromWorld`): `currentOverlaps` was declared and cleared in `addToWorld`/`removeFromWorld`, but
`handleCollisionStart`/`handleCollisionEnd` never actually added or removed anything from it - they only
ever pushed straight onto `onEnter$`/`onLeft$` and left the set permanently empty. That made
`removeFromWorld`'s own "notify everyone still overlapping that this trigger is gone"
loop (`for (const body of this.currentOverlaps) { this.onLeft$.next(body); }`) a silent no-op. Fixed by
having `handleCollisionStart`/`handleCollisionEnd` add/delete `comp` from `currentOverlaps` themselves
(narrowed via `comp instanceof MatterRigidBodyComponent`, since `world.children.find(...)` returns the
wider `MatterWorldChild` union) right alongside firing `onEnter$`/`onLeft$`.

Separately, the reverse direction had no mechanism at all: `Composite.remove` (what a rigid body's own
`removeFromWorld` calls) never fires a native `collisionEnd` for the body being removed - matter-js just
stops considering that body's pairs on the *next* step, it doesn't retroactively report whatever was
active at the moment of removal. So a rigid body removed from the world while still overlapping a trigger
left that trigger's `currentOverlaps` (and, for a character, `currentCharacterOverlaps`) permanently
stale, and `onEntityLeft` never fired for it - this is a distinct gap from the sensor-pair skip in
`MatterWorldComponent`'s own `handleCollisionStart`/`handleCollisionEnd` (which back
`onCollisionStart`/`onCollisionEnd`, not a trigger's `onEntityEntered`/`onEntityLeft`, and were never in
play here). Fixed by having `MatterTriggerComponent.addToWorld` subscribe to
`world.physicsWorld.removed$` (already `.next()`'d by every component's own `removeFromWorld`, for any
component - rigid body, trigger, or character controller) and, on each removal, drop the removed
component from whichever overlap set actually contains it and fire `onLeft$` - skipping the case where
the removed component is the trigger itself (its own `removeFromWorld` already handles that directly).
The subscription is torn down in `removeFromWorld` alongside the existing `collisionStart`/`collisionEnd`
listener cleanup.

**That reaction drops the stale entry synchronously but emits `onLeft$` via `queueMicrotask`, never
inline.** `removed$` fires from inside whatever call stack performed the removal, and that stack can be
another component's own half-finished lifecycle operation: `CharacterController2dEntity.recreateCapsule()`
(every crouch/stand) calls `removeComponents([old], true)` on the *old* `MatterCharacterControllerComponent`
before assigning the new one, so an `onLeft$` subscriber running inline at that moment (app code behind
`Trigger2dEntity.onEntityLeft` - a kill volume resetting the character's `.position`, say) writes through
the old controller, i.e. `Body.setPosition` on a phantom body nothing will ever query again; the write is
silently lost and the replacement capsule spawns at the stale position. A microtask keeps the emission in
the same JS turn (well before the next `Engine.update`) but after every in-flight synchronous stack,
including the removal's own, has unwound. `matter-trigger.component.spec.ts` asserts the exact timing
(not observable synchronously after `removeFromWorld`, observable after one `await Promise.resolve()`,
no `simulate()`/`checkOverlaps()` in between). Any test that removes an overlapping body and then asserts
`onEntityLeft` fired needs that one microtask hop before the assertion. The trigger's *own*
`removeFromWorld` still emits `onLeft$` inline for everything it was overlapping - that's the trigger
leaving at a controlled point in its own lifecycle, not a reaction to someone else's removal.

## Character controller: a from-scratch discrete-query mover, no native sweep to lean on

`MatterCharacterControllerComponent` implements `ICharacterController2dComponent` as a capsule `Body`
(`Bodies.rectangle` with a `chamfer`, matching `MatterFactory.createRigidBody`'s own `CAPSULE` case) that
is **never added to `Composite`/`engine.world`** - it stays `isStatic: true` so `Engine.update` never
touches it, and every collision query `move()` needs is issued directly against it and an explicit list
of other bodies via `Matter.Query.collides`/`Collision.collides`, bypassing matter's own broadphase
entirely (see `gg-engine-physics-adapter`'s general section on this pattern - matter-js has no
`kinematic_pos` equivalent at all, so there is no "real" kinematic body to build this on top of).

- **No CCD means substep-marching real movement, not just a single test at the final position.**
  `Query.collides`/`Collision.collides` are purely discrete overlap tests at whatever transform a body
  currently has - there is no time-of-impact/swept query to call instead (unlike Rapier's
  `computeColliderMovement` or Bullet's `convexSweepTest`). A naive "move to the fully-displaced
  candidate, then test" would tunnel clean through anything thinner than the requested displacement (a
  large single-tick `move()` call is routine - e.g. the "slide to a stop against a wall" test moves 5
  units in one call against a 1-unit-thick wall). `marchMove` subdivides every requested delta into
  substeps no longer than `min(radius, 0.1)` and re-queries after each one, stopping at the first
  substep whose query finds a meaningfully-opposing obstacle - the direct 2D analog of what a sweep
  primitive gives other backends for free, and worth remembering for any other library in this position
  (a discrete-only collision query with no swept-cast equivalent).
- **A rejected substep must correct along the blocking contact's own normal by its exact `Collision
  .depth`, not simply revert the whole substep.** An early version reverted fully to the pre-substep
  position on any block, which is only ever as precise as the substep length itself (up to `maxSubstep`,
  i.e. ~0.1 units) short of the true surface - regression, found via a "step up onto a ledge" test
  landing at `y=-1.0` instead of the true `y=-0.9` resting height, exactly one substep short. Instead,
  `marchMove` pushes the *candidate* (which the query already proved is embedded) back out along
  `normalTowardCharacter(collision)` by `collision.depth + this.options.offset` (the same
  penetration-recovery technique `recoverFromPenetration` uses, plus the configured skin gap) - this
  lands at the true contact surface to within floating-point precision regardless of substep
  granularity, and the `+ offset` skin avoids landing at *exactly* zero-gap contact, one bad rounding
  away from spurious re-penetration on the very next tick's query.
- **`Matter.Collision`'s own `bodyA`/`bodyB` (and `parentA`/`parentB`) are reassigned by ascending
  `Body.id`, not by the order two bodies were passed into `Query.collides`/`Collision.collides`** - the
  same gotcha `MatterWorldComponent.handleCollisionStart` already documents for the engine-wide
  `collisionStart` event, but it applies identically here since it's the same underlying `Collision
  .collides` function. The final `collision.normal` always satisfies `dot(normal, bodyB.position -
  bodyA.position) <= 0` (verified empirically; `Collision.js`'s own inline comment claiming "away from
  bodyA" does not match its actual flip-check code), i.e. it points *towards* `parentA`/`bodyA`, away
  from `parentB`/`bodyB` - regardless of which side of the call this character's own body ended up on.
  `normalTowardCharacter` compares `collision.parentA` against `this.nativeBody` by reference (not
  argument position) to re-derive a consistent "away from the obstacle, towards this character"
  direction from that.
- **Collision-group filtering has to be done by hand, in `collectObstacles`, before ever calling
  `Query.collides`.** `Query.collides`/`Collision.collides` test raw geometry only and know nothing
  about `collisionFilter` - only matter's own `Detector.canCollide` (part of the broadphase pipeline
  this character's phantom body never goes through, since it's never added to `Composite`) applies
  that. `collectObstacles` replicates `Detector.canCollide`'s exact category/mask check
  (`(interactMask & other.category) !== 0 && (other.mask & ownMask) !== 0`) against
  `this._ownCGsMask`/`this._interactWithCGsMask` before any query, alongside excluding sensors and
  `ignoredBodies`.
- **`Trigger2dEntity`'s per-tick `checkOverlaps()` call is the natural (and only) hook for detecting
  this character walking through a trigger**, since matter's native `collisionStart`/`collisionEnd`
  engine events - what `MatterTriggerComponent` normally relies on for ordinary rigid bodies - can never
  fire for a body that was deliberately never added to `Composite`. `checkOverlaps()` used to be a pure
  no-op for matter-js (regular bodies are handled entirely by the native-event path); it now
  additionally polls every `MatterCharacterControllerComponent` currently in `world.children` via
  `Query.collides` each time it's called, diffed against its own `currentCharacterOverlaps` set to fire
  `onEntityEntered`/`onEntityLeft` on the real transitions - a second, independent mechanism living
  alongside the native-event path rather than replacing it, since ordinary rigid-body overlap detection
  already works and had no reason to change. This poll needs its own hand-rolled collision-group filter
  too, for the exact same reason `collectObstacles` does (`Query.collides` ignores `collisionFilter`
  entirely) - `checkOverlaps()` replicates the same bidirectional category/mask check against each
  candidate character's own `nativeBody.collisionFilter` before including it, so a character whose
  groups wouldn't ordinarily interact with this trigger isn't falsely reported entering it.
- **`MatterWorldComponent.children`/`added$`/`removed$`/`handleIdEntityMap` all had to widen to a
  three-way union** (`MatterRigidBodyComponent | MatterTriggerComponent |
  MatterCharacterControllerComponent`) even though the character's own phantom body is never in
  `Composite` - `children` is what the trigger polling above enumerates, and `handleIdEntityMap` is what
  `pushDynamicBodies` uses to resolve a native body it just bumped into back to its owning component
  (via `MatterRigidBodyComponent.linearVelocity`'s existing get/set, which already carries the
  `MATTER_VELOCITY_SCALE` conversion - reuse that rather than touching `Body.velocity` directly and
  re-deriving the scale factor). `MatterWorldComponent.findRigidBody` (used by the real
  `collisionStart`/`collisionEnd` listeners) needed an explicit `instanceof MatterRigidBodyComponent`
  narrow after this widening, since a character controller's phantom body can never actually be a
  reported pair's `bodyA`/`bodyB` but the map's value type no longer says so on its own.

## `MatterWorldComponent.raycast()`: hand-rolled segment-vs-polygon intersection, not `Matter.Query.ray`

matter-js has no native raycast query. `Matter.Query.ray` exists but is only a thin wrapper over
`Query.collides` - a full-geometry SAT overlap test between a synthetic, very thin rectangle body and
each candidate - which reports an approximate contact point from the collision manifold, not a true
"where does the segment first cross this body's boundary" point. This is precise enough for
`hasHit` alone but not for `hitPoint`/`hitDistance`: verified via this adapter's own regression suite
(`test/components/matter-world.component.spec.ts`'s `Raycast` block asserts a hit point at a known box
edge to within `0.1` precision) that the `Query.ray`/SAT-approximated version lands on the wrong edge
of a box entirely for a ray passing clean through it.

`raycast()` instead does true parametric segment-vs-polygon intersection by hand: for every candidate
body, `bodyPolygons(body)` returns each of its constituent polygons as a closed loop of world-space
vertices (`body` itself for a simple body, every part but the synthetic index-0 "container" part for a
compound one - mirrors `Query.collides`'s own `partsAStart = partsALength === 1 ? 0 : 1` convention; a
circle is walked via matter-js's own many-sided-polygon approximation, close enough for this purpose).
`segmentIntersection(p1, p2, p3, p4)` is the standard parametric line-segment intersection formula,
returning the closest crossing's fractional position `t` along the ray (always in `[0,1]`) and the
world-space point; the closest `t` across every edge of every candidate wins. `hitNormal` is derived
from the winning edge itself (rotated 90°, sign chosen so it points back towards `options.from`) rather
than from any matter-js collision object - this sidesteps `handleCollisionStart`'s own documented
`collision.normal` sign-convention pitfall entirely, since nothing here ever reads that field.

Candidates are pre-filtered by hand before the geometry test even runs, replicating
`Detector.canCollide`'s bidirectional category/mask check against `options.collisionFilterGroups`/
`collisionFilterMask` (packed the same way `MatterCharacterControllerComponent.collectObstacles` packs
its own masks) - `Query.collides`/`Collision.collides`/`Detector.canCollide` all test raw geometry only
and know nothing about `collisionFilter`, the same limitation `collectObstacles`'s own doc describes.
Sensor bodies (triggers) are excluded from candidates entirely for the same reason `collectObstacles`
excludes them - a trigger never physically blocks anything, so it shouldn't register as a raycast hit.
A winning candidate that turns out to be one part of a compound body resolves back to the parent via
`.parent` (self-referential for a non-compound body) before the `handleIdEntityMap` lookup, which is
keyed by the parent's `Body.id`, never a sub-part's.

`CharacterController2dEntity.tryStandUp`'s crouch/stand headroom check is this method's first real
caller and only reads `hasHit` - if a future caller needs precise `hitNormal`/`hitPoint` semantics to
match exactly what `Rapier2dWorldComponent.raycast` provides (a genuine closest-time-of-impact query,
not geometry reconstructed by hand), re-verify against this adapter's own raycast spec rather than
assuming parity by construction.

## `MatterFactory.createRigidBody` must apply `ownCollisionGroups`/`interactWithCollisionGroups` itself

`transformOptions(descriptor.body)` (used to build every shape's native `Bodies.rectangle`/`circle`/
`fromVertices` options) only ever reads `bodyType`/`mass`/`restitution`/`friction` - it has no notion of
collision groups at all. `MatterRigidBodyComponent`'s own `_ownCGsMask`/`_interactWithCGsMask` default
to "all groups" (`BitMask.full(16)`) at construction and are only ever changed by its
`ownCollisionGroups`/`interactWithCollisionGroups` *setters* (which also call `updateCollisionFilter()`
to push the new mask into `nativeBody.collisionFilter`). `createRigidBody` must therefore explicitly
assign `component.ownCollisionGroups = descriptor.body.ownCollisionGroups` (and the interact-with
counterpart) after constructing the component, whenever the descriptor actually specifies one - a body
created with an explicit `ownCollisionGroups`/`interactWithCollisionGroups` in its `Body2DOptions`
otherwise silently gets the "collides with everything" default instead, indistinguishable from a body
that never asked for group filtering at all. `MatterCharacterControllerComponent`'s own constructor
already did this correctly for a character (`this.ownCollisionGroups = this.options.ownCollisionGroups`
etc.) - `createRigidBody` needed the equivalent explicit pair of assignments for an ordinary rigid body.
`createTrigger` has no equivalent gap: `Shape2DDescriptor` (its own descriptor type) carries no body
options at all, so a trigger's collision groups are necessarily set after creation via the component's
own setters regardless, the same way an app would for any other post-creation config.

Found via this adapter's own pre-existing (previously `describe.skip`'d, since `raycast()` itself threw
until it was implemented - see above) collision-filtering raycast tests: a ray configured to only hit
one of two differently-grouped candidates hit both, because the "excluded" one's `collisionFilter` was
silently still the default "all groups" despite its `Body2DOptions` asking for a specific group.

## Keep this skill current

This file is read by future agents fixing/extending `packages/matter` specifically, not by end users of
the engine. If `matter-js`'s API fights the mapping described in `gg-engine-physics-adapter` in some new
way, or something written here turns out wrong/incomplete once you've actually worked with it, add a
short note (what went wrong, why, the fix) before finishing, folded into the relevant section rather
than left as a loose log entry.
