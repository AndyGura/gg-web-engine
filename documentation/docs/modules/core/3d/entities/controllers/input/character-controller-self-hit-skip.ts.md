---
title: core/3d/entities/controllers/input/character-controller-self-hit-skip.ts
nav_order: 52
parent: Modules
---

## character-controller-self-hit-skip overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [characterControllerSelfHitSkip](#charactercontrollerselfhitskip)

---

# utils

## characterControllerSelfHitSkip

Safe forward-skip distance, from `origin` along `direction`, to clear a character controller's own
capsule when raycasting from a point on or inside it - e.g. a first-person camera, which sits
inside or right at the surface of its own capsule - without reading an exit point off the raycast
result itself.

A raycast whose origin already lies inside a shape has no reliable way to report where it _exits_
that shape: an adapter using a "solid" ray mode reports the containing shape hit at distance `0`,
from the origin again, not its far boundary, and doing this on some adapters but not others (e.g.
Rapier3d's `castRay(..., solid: true, ...)` vs. Ammo's `rayTest`, which simply can't see the shape
containing its own origin at all) makes any retry built on that reported point adapter-dependent -
see `ObjectGrabController.tryGrab()`'s own doc for a case where exactly this broke self-hit
recovery on one adapter while appearing to work fine on another.

Computed by sphere-tracing against the capsule's own exact distance field instead of guessed from
`radius` alone: `radius - distanceToCapsuleAxis(point, ...)` is the _exact_ signed distance from
any point to the capsule's surface (a capsule is exactly "every point within `radius` of its own
medial segment"), so repeatedly advancing by that remaining distance converges tightly onto the
real exit point along `direction`, for _any_ pitch - not just a near-horizontal look direction. A
flat `radius`-sized skip (this function's first implementation) only clears the capsule when
`origin` sits in its cylindrical midsection and `direction` is close to horizontal; a real,
reproduced regression (found by reproducing the reporter's own exact in-game position) picked a
first-person camera above that midsection - `eyeHeight` (0.7 by default) taller than the capsule's
own half-height, so the camera already sits in the rounded top cap - looking down at a low, close
prop: the flat `radius` skip landed the retry still measurably inside the capsule (its horizontal
travel per meter shrinks with a steeper pitch, exactly where the cap's own cross-section is
smaller too), so the second cast self-hit again and pick-up silently failed at that exact range.
Sphere-tracing has no separate "which part of the capsule" case to get wrong - the same distance
field describes the cylindrical body and both rounded caps continuously.

`skin` (0.05 by default) is added on top of the traced distance for ordinary float/engine surface
tolerance. The result is clamped to at most 90% of `maxDistance` (the full ray length in play at
the call site) so a capsule large relative to a short ray can't consume the entire cast.

**Signature**

```ts
export declare function characterControllerSelfHitSkip(
  origin: Point3,
  direction: Point3,
  capsuleCenter: Point3,
  up: Point3,
  radius: number,
  centersDistance: number,
  maxDistance: number,
  skin = 0.05
): number
```
