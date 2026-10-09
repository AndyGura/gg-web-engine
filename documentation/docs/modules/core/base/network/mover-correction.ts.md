---
title: core/base/network/mover-correction.ts
nav_order: 160
parent: Modules
---

## mover-correction overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [INetworkMover (interface)](#inetworkmover-interface)
  - [MoverCorrection (class)](#movercorrection-class)
    - [capture (static method)](#capture-static-method)
    - [targetPosition (static method)](#targetposition-static-method)
    - [correct (static method)](#correct-static-method)
  - [MoverNetState (interface)](#movernetstate-interface)
  - [captureMover](#capturemover)
  - [correctMover](#correctmover)

---

# utils

## INetworkMover (interface)

The surface of a character controller entity `MoverCorrection` drives - satisfied structurally
by `CharacterController3dEntity` and `CharacterController2dEntity`.

**Signature**

```ts
export interface INetworkMover<D, R> {
  position: D
  rotation: R
  fallVelocity: D
  airHorizontalVelocity: D
  isCrouching: boolean
  /** consumed (then cleared) by the mover's next `move()`, so corrections slide against geometry */
  externalDisplacement: D
  /** velocity the mover actually moved at on its last tick */
  readonly actualVelocity: D
}
```

## MoverCorrection (class)

Replica correction for movers (kinematic capsules driven through `move()`): the position error
never teleports the capsule - it becomes the mover's `externalDisplacement`, which its next
`move()` consumes, so a correction slides against geometry and respects step/snap-to-ground like
any other movement. Forwarded input does most of the work; correction only erases a tick or two of
divergence. Rotation is lerped, `fallVelocity`/`airHorizontalVelocity` lerped toward the target,
crouch applied directly. While the stream is stalled (`ctx.sinceReceivedMs` between
`extrapolateMaxMs` and `coastMaxMs`) the mover is left alone (`'coast'`), only crouch is still
adopted. A snap (error above `snapDistance`, or `ctx.snap`) writes position and
rotation through the setters and resets both momentum vectors to the owner's.

**Signature**

```ts
export declare class MoverCorrection
```

### capture (static method)

Owner side: snapshot `mover` as plain JSON.

**Signature**

```ts
static capture<D, R>(mover: INetworkMover<D, R>): MoverNetState<D, R>
```

### targetPosition (static method)

Where a replica of `target` is steered to once the snapshot is `ageMs` old: its position
extrapolated along the owner's velocity, capped at `extrapolateMaxMs`.

**Signature**

```ts
static targetPosition<D, R>(
    target: MoverNetState<D, R>,
    ageMs: number,
    tuning: CorrectionTuning = DEFAULT_CORRECTION_TUNING,
  ): D
```

### correct (static method)

Replica side: reconcile `mover` toward `target` - see the class doc.

**Signature**

```ts
static correct<D, R>(
    mover: INetworkMover<D, R>,
    target: MoverNetState<D, R>,
    ctx: NetworkApplyContext,
    tuning: CorrectionTuning = ctx.tuning ?? DEFAULT_CORRECTION_TUNING,
  ): CorrectionOutcome
```

## MoverNetState (interface)

Networked snapshot of a mover (character controller): position, rotation, fall velocity,
airborne horizontal velocity, crouch flag, and `v` - the velocity the mover actually moved at on
its last tick, used to extrapolate the snapshot (a grounded walk's horizontal motion is driven by
input and appears in neither `fv` nor `ahv`).

**Signature**

```ts
export interface MoverNetState<D = unknown, R = unknown> {
  p: D
  r: R
  fv: D
  ahv: D
  crouch: boolean
  v?: D
}
```

## captureMover

Function alias of {@link MoverCorrection.capture}.

**Signature**

```ts
export declare const captureMover: typeof MoverCorrection.capture
```

## correctMover

Function alias of {@link MoverCorrection.correct}.

**Signature**

```ts
export declare const correctMover: typeof MoverCorrection.correct
```
