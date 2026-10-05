---
title: core/base/network/net-extrapolation.ts
nav_order: 151
parent: Modules
---

## net-extrapolation overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [extrapolateNetPosition](#extrapolatenetposition)
  - [isNetStateCoasting](#isnetstatecoasting)

---

# utils

## extrapolateNetPosition

Where a replica of a networked `state` is steered to once the snapshot is `ageMs` old, for any state
shaped like (or containing) a {@link RigidBodyNetState} or a {@link MoverNetState} - the same
extrapolation the correction helpers apply. `null` for a state of another shape. For a network
layer's diagnostics, which sees states without knowing their entity class.

**Signature**

```ts
export declare function extrapolateNetPosition<D = unknown>(
  state: unknown,
  ageMs: number,
  tuning: CorrectionTuning = DEFAULT_CORRECTION_TUNING
): D | null
```

## isNetStateCoasting

Whether a replica whose latest snapshot arrived `sinceReceivedMs` ago is coasting: the stream has
been silent for longer than a snapshot is extrapolated (`extrapolateMaxMs`), not yet long enough for
the replica to be corrected to it again (`coastMaxMs`).

**Signature**

```ts
export declare function isNetStateCoasting(
  sinceReceivedMs: number,
  tuning: CorrectionTuning = DEFAULT_CORRECTION_TUNING
): boolean
```
