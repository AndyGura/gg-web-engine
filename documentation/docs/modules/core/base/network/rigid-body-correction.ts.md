---
title: core/base/network/rigid-body-correction.ts
nav_order: 143
parent: Modules
---

## rigid-body-correction overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [RigidBodyCorrection (class)](#rigidbodycorrection-class)
    - [capture (static method)](#capture-static-method)
    - [targetPosition (static method)](#targetposition-static-method)
    - [correct (static method)](#correct-static-method)
  - [RigidBodyNetState (interface)](#rigidbodynetstate-interface)
  - [captureRigidBody](#capturerigidbody)
  - [correctRigidBody](#correctrigidbody)

---

# utils

## RigidBodyCorrection (class)

Replica correction for rigid bodies, shared by every entity class whose networked state is (or
contains) a rigid body: one algorithm, applied per body kind.

1. The snapshot is extrapolated to "now" along its velocities, capped at `extrapolateMaxMs`. A
   dynamic replica of a moving target whose snapshot arrived longer ago than that
   (`ctx.sinceReceivedMs`), up to `coastMaxMs`, is left alone (`'coast'`): the stream stalled, and
   its own simulation is the better guess. A snapshot that is old only because the link is slow
   is corrected to as usual.
2. Error below the deadzone: nothing is written (and an awake replica of a sleeping target is put
   to sleep).
3. Error above `snapDistance`, or `ctx.snap`: the extrapolated state is written outright.
4. Otherwise blend:
   - dynamic body: velocity is steered toward `targetVelocity + error * velocityGain` at
     `positionGain` per second (a velocity bias does not fight momentum the way a position lerp
     does), rotation slerped at `rotationGain`, angular velocity lerped. A sleeping target instead
     gets a gentle position/rotation lerp with zero velocity, so the replica comes to rest where
     the owner's body rests;
   - kinematic body (`kinematic_pos`/`kinematic_vel`): position/rotation lerp only, through the
     setters - kinematic bodies don't integrate a written velocity on every adapter;
   - static body: never corrected.

The helper never reads a value back after writing it within one call (a position-based kinematic
write is deferred to the next physics step on some adapters), and gains are per-second, scaled by
`ctx.dt`.

**Signature**

```ts
export declare class RigidBodyCorrection
```

### capture (static method)

Owner side: snapshot `body` as plain JSON.

**Signature**

```ts
static capture<D, R>(body: IRigidBodyComponent<D, R>): RigidBodyNetState<D, R>
```

### targetPosition (static method)

Where a replica of `target` is steered to once the snapshot is `ageMs` old: its position
extrapolated along its linear velocity (not at all for a sleeping target), capped at
`extrapolateMaxMs`.

**Signature**

```ts
static targetPosition<D, R>(
    target: RigidBodyNetState<D, R>,
    ageMs: number,
    tuning: CorrectionTuning = DEFAULT_CORRECTION_TUNING,
  ): D
```

### correct (static method)

Replica side: reconcile `body` toward `target` - see the class doc for the algorithm.

**Signature**

```ts
static correct<D, R>(
    body: IRigidBodyComponent<D, R>,
    target: RigidBodyNetState<D, R>,
    ctx: NetworkApplyContext,
    tuning: CorrectionTuning = ctx.tuning ?? DEFAULT_CORRECTION_TUNING,
  ): CorrectionOutcome
```

## RigidBodyNetState (interface)

Networked snapshot of one rigid body: position, rotation, linear velocity, angular velocity
(scalar in 2D, world-space axis\*rate vector in 3D) and the sleep flag. Short keys keep the JSON
small - it is sent many times per second per entity.

**Signature**

```ts
export interface RigidBodyNetState<D = unknown, R = unknown> {
  p: D
  r: R
  lv: D
  av: R | D
  s: boolean
}
```

## captureRigidBody

Function alias of {@link RigidBodyCorrection.capture}.

**Signature**

```ts
export declare const captureRigidBody: typeof RigidBodyCorrection.capture
```

## correctRigidBody

Function alias of {@link RigidBodyCorrection.correct}.

**Signature**

```ts
export declare const correctRigidBody: typeof RigidBodyCorrection.correct
```
