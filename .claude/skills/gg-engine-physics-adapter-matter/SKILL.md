---
name: gg-engine-physics-adapter-matter
description: Known, already-solved implementation pitfalls specific to packages/matter (the matter-js 2D physics adapter) - removeFromWorld/dispose semantics, @types/matter-js version-bump typing gotchas. Use when fixing or extending packages/matter itself, not when building a new physics adapter from scratch (see gg-engine-physics-adapter for the general contract every adapter implements).
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

## Sleeping-body writes: checked, not currently a problem here

`gg-engine-physics-adapter`'s general contract note describes a cross-adapter bug where a sleeping
body silently ignores a programmatic `position`/`rotation`/velocity write (confirmed and fixed in
`packages/ammo` and both `packages/rapier2d`/`rapier3d`). Checked empirically here too (a body left
at rest with zero gravity for 12 simulated seconds, then given a velocity write): it never actually
went to sleep in the first place, because `MatterWorldComponent`'s `Engine.create({...})` never sets
`enableSleeping` and `matter-js` itself defaults that to `false`. Nothing to fix currently - but if a
future change ever turns `enableSleeping: true` on for this adapter (e.g. for the CPU-cost benefit at
scale), re-run this exact check before assuming `Body.setPosition`/`setVelocity`/`setAngularVelocity`
still work uniformly regardless of sleep state, and wake the body explicitly if not (matter-js
exposes `Sleeping.set(body, false)` for this).

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

## Keep this skill current

This file is read by future agents fixing/extending `packages/matter` specifically, not by end users of
the engine. If `matter-js`'s API fights the mapping described in `gg-engine-physics-adapter` in some new
way, or something written here turns out wrong/incomplete once you've actually worked with it, add a
short note (what went wrong, why, the fix) before finishing, folded into the relevant section rather
than left as a loose log entry.
