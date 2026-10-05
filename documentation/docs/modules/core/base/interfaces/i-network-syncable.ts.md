---
title: core/base/interfaces/i-network-syncable.ts
nav_order: 131
parent: Modules
---

## i-network-syncable overview

Tuning of the replica-correction helpers (`RigidBodyCorrection`, `MoverCorrection`). Gains are
per-second and get scaled by the tick delta, so frame rate doesn't change how a correction feels.
See {@link DEFAULT_CORRECTION_TUNING} for the defaults.

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CorrectionOutcome (type alias)](#correctionoutcome-type-alias)
  - [CorrectionTuning (interface)](#correctiontuning-interface)
  - [DEFAULT_CORRECTION_TUNING](#default_correction_tuning)
  - [INetworkInputDriven (interface)](#inetworkinputdriven-interface)
  - [INetworkSyncable (interface)](#inetworksyncable-interface)
  - [NetworkApplyContext (interface)](#networkapplycontext-interface)
  - [isNetworkInputDriven](#isnetworkinputdriven)
  - [isNetworkSyncable](#isnetworksyncable)

---

# utils

## CorrectionOutcome (type alias)

What a correction ended up doing - handy for tests and debug overlays.

**Signature**

```ts
export type CorrectionOutcome = 'none' | 'blend' | 'snap' | 'sleep' | 'coast'
```

## CorrectionTuning (interface)

Tuning of the replica-correction helpers (`RigidBodyCorrection`, `MoverCorrection`). Gains are
per-second and get scaled by the tick delta, so frame rate doesn't change how a correction feels.
See {@link DEFAULT_CORRECTION_TUNING} for the defaults.

**Signature**

```ts
export interface CorrectionTuning {
  /** Position error (world units) below which nothing is corrected. Default 0.02. */
  deadzone: number
  /** Rotation error (radians) below which nothing is corrected. Default 1° (π/180). */
  rotationDeadzone: number
  /** Position error (world units) above which the replica is snapped outright. Default 2. */
  snapDistance: number
  /**
   * Per-second gain of position convergence: for a mover the fraction of the error removed per
   * second, for a dynamic body how fast its velocity converges to the corrective target velocity,
   * for a kinematic body the per-second lerp factor of its position. Default 6.
   */
  positionGain: number
  /** Per-second gain turning a dynamic body's position error into extra velocity. Default 4. */
  velocityGain: number
  /** Per-second slerp/lerp factor of rotation convergence. Default 8. */
  rotationGain: number
  /** Upper bound of how far (ms) a snapshot is extrapolated forward along its velocity. Default 250. */
  extrapolateMaxMs: number
  /**
   * When no newer snapshot has arrived for longer than `extrapolateMaxMs`, the owner's stream stalled
   * and the latest one has nothing more to say about where its entity is now. Until that silence
   * (`NetworkApplyContext.sinceReceivedMs`) lasts this long (ms), a moving replica is left to its own
   * simulation instead of being pulled back to the point the extrapolation stopped at - the next
   * snapshot will most likely find the replica about where it should be. Past it, the replica is
   * corrected to that point again. 0 turns coasting off. Default 1000.
   */
  coastMaxMs: number
}
```

## DEFAULT_CORRECTION_TUNING

**Signature**

```ts
export declare const DEFAULT_CORRECTION_TUNING: Readonly<CorrectionTuning>
```

## INetworkInputDriven (interface)

Per-entity input contract for entities a player can drive (a character, a car). A replica that
knows what the possessor is pressing predicts far better than one extrapolating from velocity
alone, since a released key is a discontinuity extrapolation cannot see. Not every possessable
entity is input-driven: one moved purely by game logic on its possessor's side reaches replicas as
state alone.

**Signature**

```ts
export interface INetworkInputDriven<I = unknown> {
  /** Possessor side: what the local input driver has set on this entity since last sample. */
  captureLocalInput(): I

  /**
   * Replica side: apply the possessor's input. `null` means "neutral" (takeover, lost or released
   * possessor) - the entity defines neutral (car: throttle 0, brake 1; character: no movement).
   */
  applyRemoteInput(input: I | null): void
}
```

## INetworkSyncable (interface)

Per-entity networked-state contract, the network counterpart of `ISerializableEntity`: each
entity class decides what it broadcasts (`S` is whatever the class chooses, as long as it is plain
JSON) and how a replica reconciles toward it. Core never knows who owns an entity or how state
travels - a network layer (e.g. `@gg-web-engine/multiplayer`) calls `captureNetworkState` on the
owner, ships the result, and calls `applyNetworkState` on every other peer's copy. Built-in
entities implement it by delegating to `RigidBodyCorrection`/`MoverCorrection`.

**Signature**

```ts
export interface INetworkSyncable<S = unknown> {
  /** Owner side: the state to broadcast now. Must be plain JSON. */
  captureNetworkState(): S

  /**
   * Replica side: reconcile local state toward `target`. The entity decides how (blend, velocity
   * bias, `move()` displacement, snap) - typically by delegating to a correction helper. May return
   * what the correction did (the helpers' own return value), which a network layer only uses for
   * diagnostics, e.g. counting the replicas it had to snap.
   */
  applyNetworkState(target: S, ctx: NetworkApplyContext): CorrectionOutcome | void

  /**
   * Optional: state for a peer that has no local copy yet (late join / takeover). Defaults to
   * `captureNetworkState()`. Override when the tick payload is a delta or omits rarely-changing
   * fields.
   */
  captureFullNetworkState?(): S

  /**
   * Optional: `false` makes a network layer ignore this entity entirely (neither captured nor
   * corrected) - e.g. an `Entity3d` with no rigid body, or with a static one that never moves.
   * Read when the entity is registered. Absent means `true`.
   */
  readonly isNetworkSyncEnabled?: boolean

  /** Optional per-entity override of the network layer's correction tuning. */
  readonly networkTuning?: Partial<CorrectionTuning>
}
```

## NetworkApplyContext (interface)

What a replica gets alongside the owner's state in {@link INetworkSyncable.applyNetworkState}.

**Signature**

```ts
export interface NetworkApplyContext {
  /** ms elapsed on the owner's clock since `state` was captured (after clock-offset correction) */
  ageMs: number
  /**
   * ms elapsed on this peer since `state` arrived. Unlike `ageMs` it doesn't include the link's
   * latency, so it tells a stalled stream (it keeps growing) from a slow link (it stays below the
   * send interval). A replica coasts only by this; without it, it never does.
   */
  sinceReceivedMs?: number
  /** this tick's delta, ms */
  dt: number
  /** true when the controller demands an exact state (late join, takeover, structural snap) */
  snap: boolean
  /** correction tuning in effect for this entity: the network layer's default merged with the
   * entity's own {@link INetworkSyncable.networkTuning} override */
  tuning: CorrectionTuning
}
```

## isNetworkInputDriven

**Signature**

```ts
export declare function isNetworkInputDriven(entity: unknown): entity is INetworkInputDriven
```

## isNetworkSyncable

**Signature**

```ts
export declare function isNetworkSyncable(entity: unknown): entity is INetworkSyncable
```
