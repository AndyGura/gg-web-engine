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

`matter-js` is pure JS, GC-managed - it has no native/WASM handles at all, unlike Ammo or Rapier.
`removeFromWorld` threads `dispose` through and calls `this.dispose()`, but
`MatterRigidBodyComponent.dispose()` is intentionally a no-op (nothing to free).
`MatterTriggerComponent` is the one real fix: it now overrides `dispose()` to complete its
`onEnter$`/`onLeft$` RxJS subjects, which previously never happened on either path.

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

## Keep this skill current

This file is read by future agents fixing/extending `packages/matter` specifically, not by end users of
the engine. If `matter-js`'s API fights the mapping described in `gg-engine-physics-adapter` in some new
way, or something written here turns out wrong/incomplete once you've actually worked with it, add a
short note (what went wrong, why, the fix) before finishing, folded into the relevant section rather
than left as a loose log entry.
