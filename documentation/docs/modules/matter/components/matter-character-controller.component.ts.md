---
title: matter/components/matter-character-controller.component.ts
nav_order: 175
parent: Modules
---

## matter-character-controller.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterCharacterControllerComponent (class)](#mattercharactercontrollercomponent-class)
    - [updateCollisionFilter (method)](#updatecollisionfilter-method)
    - [collectObstacles (method)](#collectobstacles-method)
    - [canCollideWith (method)](#cancollidewith-method)
    - [normalTowardCharacter (method)](#normaltowardcharacter-method)
    - [otherParent (method)](#otherparent-method)
    - [isWalkable (method)](#iswalkable-method)
    - [recoverFromPenetration (method)](#recoverfrompenetration-method)
    - [marchMove (method)](#marchmove-method)
    - [probe (method)](#probe-method)
    - [applyStepAssist (method)](#applystepassist-method)
    - [pushDynamicBodies (method)](#pushdynamicbodies-method)
    - [move (method)](#move-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [name (property)](#name-property)
    - [radius (property)](#radius-property)
    - [centersDistance (property)](#centersdistance-property)
    - [nativeBody (property)](#nativebody-property)
    - [ignoredBodies (property)](#ignoredbodies-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
    - [\_ownCGsMask (property)](#_owncgsmask-property)
    - [\_interactWithCGsMask (property)](#_interactwithcgsmask-property)

---

# utils

## MatterCharacterControllerComponent (class)

A capsule-shaped kinematic character controller implemented as a direct discrete-query
sweep-and-slide mover, driven entirely by this class's own `move()` - the 2D counterpart of a
from-scratch native-engine character mover (see `gg-engine-physics-adapter`'s own section on this
general pattern).

**Why this isn't built on `createRigidBody`/a `kinematic_pos` body**: matter-js has no native
kinematic body concept at all (see `MatterFactory.transformOptions`'s doc) - a `kinematic_pos`/
`kinematic_vel` request there falls back to a plain `isStatic: true` body, which never moves and
never pushes/wakes anything. This component instead constructs its own `Matter.Body` directly (a
capsule via `Bodies.rectangle` with a `chamfer`, matching `MatterFactory.createRigidBody`'s own
`CAPSULE` case), marks it `isStatic: true` so matter's own `Engine.update` never touches it, and
**never adds it to `Composite`/`engine.world` at all** - there is no need to, since every query this
class issues (`Matter.Query.collides`) is run directly against this body and an explicit list of
other bodies, not through matter's own broadphase/`Engine.update` pipeline. This also means
matter-js's own per-engine `collisionFilter`-aware broadphase (`Detector.canCollide`) never runs for
this body either - `collectObstacles()` below replicates that exact category/mask check by hand
before ever calling `Query.collides`, since that function tests raw geometry with no collision-group
awareness of its own.

**Why movement is substep-marched rather than a single discrete overlap test at the final
position**: matter-js has no continuous collision detection at all (see `MatterFactory
.transformOptions`'s own `ccd` note) and `Matter.Query.collides`/`Collision.collides` are purely
discrete overlap tests at whatever transform a body currently has - matter-js exposes no
swept/time-of-impact query to call instead. A
single test-then-clamp at the fully-displaced candidate position would tunnel clean through any
obstacle thinner than the requested displacement (a large single-tick `move()` call, or a thin wall,
would simply never register contact at all). `marchMove` compensates by subdividing the requested
delta into substeps no longer than half its radius and re-querying after each one, stopping at the
first substep that would overlap something - a standard workaround for discrete-only collision
detection, and the direct 2D analog of what a sweep primitive gives other backends for free.

**Collision normal convention**: `Matter.Collision`'s own `collision.bodyA`/`collision.bodyB` (and
`parentA`/`parentB`) are reassigned by ascending `Body.id`, not by the order two bodies were passed
into `Collision.collides`/`Query.collides` - and the final `collision.normal` is oriented so that
`dot(normal, bodyB.position - bodyA.position) <= 0` always holds (verified empirically against
`Collision.js`'s own flip check; its inline comment claims the opposite, "facing away from bodyA",
which does not match the code - see `gg-engine-physics-adapter-matter`'s own note on this same
gotcha for the engine-wide `collisionStart`/`collisionEnd` event wiring). Concretely this means the
final normal always points _towards_ `collision.bodyA`/`parentA`, away from `bodyB`/`parentB`,
regardless of which side of the original `Query.collides(body, bodies)` call each one came from -
`normalTowardCharacter` below re-derives a consistent "points away from the obstacle, towards this
character" direction from that by comparing `parentA`/`parentB` against this character's own native
body, not by assuming a fixed argument order.

**Ground overlap for `Trigger2dEntity`**: since this character's phantom body is deliberately never
added to matter's own `Composite`, matter's native `collisionStart`/`collisionEnd` engine events
(what `MatterTriggerComponent`'s own enter/exit detection is normally driven by) can never fire for
it - there is no pair for the engine to ever notice. `MatterTriggerComponent.checkOverlaps()`
(already called once per tick by `Trigger2dEntity`, previously a no-op for matter-js since ordinary
rigid-body overlaps are handled by those native events instead) now _additionally_ polls every
`MatterCharacterControllerComponent` currently in the world via `Query.collides` each time it's
called, entirely independently of the native event path - this was the natural fit given
`checkOverlaps()` already existed as a per-tick hook with nothing else needing it for matter-js,
rather than inventing a second, differently-shaped mechanism.

**Colliding with other character controllers**: `collectObstacles()` below includes every other
`MatterCharacterControllerComponent` currently in the world (found via `this.world.children`, not
`Composite.allBodies`, for the same reason as the previous paragraph) alongside ordinary bodies -
two characters block each other's movement the same way any other obstacle does.

**Divergence from the interface's own options**: `minStepWidth` is accepted but not honored - see
`applyStepAssist`'s own doc for why.

**Signature**

```ts
export declare class MatterCharacterControllerComponent {
  constructor(
    protected readonly world: MatterWorldComponent,
    options: CharacterController2dOptions,
    transform?: { position?: Point2; rotation?: number }
  )
}
```

### updateCollisionFilter (method)

**Signature**

```ts
private updateCollisionFilter(): void
```

### collectObstacles (method)

Every other body currently in the world this character's own queries must consider - excludes
sensors (triggers never physically block anything, see `ITrigger2dComponent`), everything in
`ignoredBodies` (consulted fresh here, every call), and anything this character's own collision
groups wouldn't interact with anyway (`Query.collides`/`Collision.collides` test raw geometry
only and know nothing about `collisionFilter`, unlike matter's own `Detector` - so `canCollideWith`
calls `Detector.canCollide` directly against this character's own `nativeBody.collisionFilter`,
which the `ownCollisionGroups`/`interactWithCollisionGroups` setters keep in sync).

Also includes every _other_ `MatterCharacterControllerComponent` currently in the world, via its
own phantom `nativeBody` - without this, two character controllers could freely overlap and pass
straight through each other, since neither one's phantom body is ever added to
`Composite`/`engine.world` (see this class's own doc) and so neither is ever a candidate for the
other's queries through `Composite.allBodies` alone.

**Signature**

```ts
private collectObstacles(): Body[]
```

### canCollideWith (method)

**Signature**

```ts
private canCollideWith(other: Body): boolean
```

### normalTowardCharacter (method)

See this class's own doc for the sign convention this re-derives (`parentA`/`parentB`, not
calling-argument order). Returns a normal pointing away from the obstacle, towards this
character.

**Signature**

```ts
private normalTowardCharacter(collision: Collision): Point2
```

### otherParent (method)

**Signature**

```ts
private otherParent(collision: Collision): Body
```

### isWalkable (method)

**Signature**

```ts
private isWalkable(normal: Point2, up: Point2): boolean
```

### recoverFromPenetration (method)

Pushes this character's phantom body out of any obstacle it currently overlaps at `pos`, via
`Query.collides`, iterating a few times since resolving one contact can reveal/deepen another -
a discrete query like this one can start a tick already embedded (e.g. from a previous tick's
rounding/clamping). Must run before any marching this tick.

**Signature**

```ts
private recoverFromPenetration(pos: Point2, obstacles: Body[]): Point2
```

### marchMove (method)

Marches this character's phantom body from `start` towards `start + delta` in small substeps
(see this class's own doc for why substepping is needed at all, in place of a true sweep), moving
the native body via `Body.setPosition` after every accepted substep, and stopping at the first
substep whose query finds an obstacle with a meaningful component opposing the direction of
travel. `overlappingBodies` in the result always reflects the query at wherever this call
finished (the fully-displaced position if never blocked, or the last-accepted position if it
was) - used by `move()` to find dynamic bodies to push.

**Signature**

```ts
private marchMove(start: Point2, delta: Point2, obstacles: Body[]): AxisMoveResult
```

### probe (method)

Like `marchMove`, but always leaves the native body at `start` before returning - for a
speculative query (step-up assist, ground snap/landing checks) that must not commit any movement
unless the caller explicitly applies the returned position itself.

**Signature**

```ts
private probe(start: Point2, delta: Point2, obstacles: Body[]): AxisMoveResult
```

### applyStepAssist (method)

If the horizontal leg was blocked, tries lifting the phantom body up by up to `maxStepHeight`,
retrying the same horizontal move at that height, and probing back down - only accepting the step
if it both clears more horizontal distance than the unraised attempt _and_ actually lands on
walkable ground, not just a curved/vertical surface that happens to allow more clearance a hair
higher up (see the general `gg-engine-physics-adapter` skill's own caution on this exact
failure mode).

**`minStepWidth` is not honored** - a step is accepted purely on `maxStepHeight`/walkability,
with no separate check for how much free space sits on top of the ledge. An attempt at that
check (probing forward from the landing spot by `minStepWidth` and requiring the ledge to still
be walkable there) was tried and reverted: this mover's own step-up sequence routinely _accepts_
a landing spot that is itself only a marginal, partial advance still snug against the same
obstacle corner that blocked the original horizontal move (`marchMove`'s substep-and-slide
approach, see this class's own doc, naturally creeps forward across several ticks rather than
clearing a corner in one) - a width probe from a landing spot like that immediately re-hits the
same corner and rejects the step outright, which stalls the character completely instead of
letting it creep across a perfectly normal ledge over the next few ticks. `minStepWidth` is
still accepted into this class's own options (see `CharacterController2dOptions.minStepWidth`'s
own doc: "not every backend can honor this exactly").

**Signature**

```ts
private applyStepAssist(
    start: Point2,
    initial: AxisMoveResult,
    horizontal: Point2,
    up: Point2,
    obstacles: Body[],
  ): Point2
```

### pushDynamicBodies (method)

Shoves a dynamic body the horizontal leg bumped into this tick - see
`CharacterController2dOptions.pushMass`'s doc for the formula (an inelastic collision against a
virtual mass moving at the character's own speed), applied here through
`MatterRigidBodyComponent.linearVelocity`'s existing getter/setter (which already carries the
conversion between matter-js's internal per-step velocity units and this engine's public m/s
units - see `MATTER_VELOCITY_SCALE`'s own doc) rather than touching `Body.velocity` directly.

**Signature**

```ts
private pushDynamicBodies(bodies: Body[], direction: Point2, horizLen: number, dt: number | undefined): void
```

### move (method)

Resolves `desiredTranslation` fully synchronously (see the interface's own doc) via
`recoverFromPenetration` + two axis-separated `marchMove` legs (horizontal, then vertical) +
a ground-snap probe - see this class's own doc for the overall approach and why each piece is
needed.

**Signature**

```ts
move(desiredTranslation: Point2, dt?: number): void
```

### clone (method)

**Signature**

```ts
clone(): MatterCharacterControllerComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: MatterGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: MatterGgWorld, dispose: boolean = false): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### entity (property)

**Signature**

```ts
entity: IEntity<any, any, GgWorldTypeDocRepo<any, any>> | null
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

### nativeBody (property)

**Signature**

```ts
readonly nativeBody: Body
```

### ignoredBodies (property)

See `ICharacterController2dComponent.ignoredBodies`'s doc. Consulted fresh by `collectObstacles`
every `move()` call.

**Signature**

```ts
readonly ignoredBodies: Set<MatterRigidBodyComponent>
```

### debugBodySettings (property)

**Signature**

```ts
readonly debugBodySettings: DebugBody2DSettings
```

### \_ownCGsMask (property)

**Signature**

```ts
_ownCGsMask: number
```

### \_interactWithCGsMask (property)

**Signature**

```ts
_interactWithCGsMask: number
```
