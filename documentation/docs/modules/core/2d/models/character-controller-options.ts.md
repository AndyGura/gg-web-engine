---
title: core/2d/models/character-controller-options.ts
nav_order: 44
parent: Modules
---

## character-controller-options overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CharacterController2dOptions (type alias)](#charactercontroller2doptions-type-alias)

---

# utils

## CharacterController2dOptions (type alias)

Settings for a capsule-shaped kinematic character controller (see
`ICharacterController2dComponent`). Radius/centersDistance describe the capsule the same way the
`CAPSULE` primitive shape does (`Shape2DDescriptor`): `centersDistance` is the distance between
the two hemisphere centers (i.e. the height of the cylindrical middle section), `position` is
the capsule's geometric center. Mirrors `CharacterController3dOptions` field-for-field - see
that type's own doc for anything not called out again here.

**Signature**

```ts
export type CharacterController2dOptions = {
  /** Capsule radius. */
  radius: number
  /** Distance between the two capsule hemisphere centers (the cylindrical section's height). */
  centersDistance: number
  /**
   * A small gap to preserve between the character and its surroundings, to keep the underlying
   * sweep test numerically stable. Should not be zero, but also shouldn't be so large that it
   * causes visible floating. Default ~0.01.
   */
  offset?: number
  /** The maximum height of a ledge the character can automatically step onto. Default 0.3. */
  maxStepHeight?: number
  /**
   * The minimum width of free space required on top of a ledge for the character to be allowed to
   * step onto it. Default 0.2. Not every backend can honor this exactly (see the adapter's own
   * docs); treat it as a best-effort hint.
   */
  minStepWidth?: number
  /**
   * The maximum angle (radians) between the ground's normal and `up` that the character can walk
   * up without sliding back down. Default ~50° (`(50 * Math.PI) / 180`).
   */
  maxSlopeClimbAngleRad?: number
  /**
   * The maximum distance below the capsule's feet the character will snap down to stay glued to
   * the ground (e.g. walking down stairs/slopes without falling/bouncing). `0` disables snapping.
   * Default 0.3.
   */
  snapToGroundDistance?: number
  /** World "up" direction, used to tell the floor from walls/ceilings. Default `{x:0,y:-1}` - the
   * `-Y` screen-up convention every 2D adapter in this engine uses (positive `y` gravity is "down",
   * see `Gg2dWorld`'s own `gravity` console command doc). */
  up?: Point2
  /** Collision groups this character belongs to. Default: the physics world's main group. */
  ownCollisionGroups?: ReadonlyArray<CollisionGroup> | 'all'
  /** Collision groups this character collides against. Default: `'all'`. */
  interactWithCollisionGroups?: ReadonlyArray<CollisionGroup> | 'all'
  /**
   * Effective mass (kg-equivalent), used only to size the push this character imparts to a dynamic
   * body it walks into - the character's own motion always stays fully kinematic (never affected by
   * this value, or by anything it pushes). On contact, a body's velocity along the push direction is
   * driven towards `pushSpeed * pushMass / (pushMass + bodyMass)` - i.e. a body much lighter than
   * this mass gets shoved at close to the character's own speed, one much heavier barely moves,
   * mirroring the momentum a real body of this mass moving at that speed would transfer. `0`
   * disables pushing - a dynamic body is then just swept-and-slid past like static geometry. Default
   * 80 (roughly human mass). Not every backend implements pushing (see the adapter's own docs);
   * where unimplemented, this option is ignored.
   */
  pushMass?: number
}
```
