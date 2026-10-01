---
name: gg-engine-multiplayer
description: Work on packages/multiplayer (the @gg-web-engine/multiplayer shared-world networking package - NetworkController, ownership/possession, WebRTC mesh transport, Firebase/BroadcastChannel signaling, zoning) or on the core networking contracts it drives (INetworkSyncable/INetworkInputDriven, RigidBodyCorrection/MoverCorrection, GgWorld.eventAuthority/commandGuard). Also covers making an entity class network-aware, adding possession to a game, and writing a new transport or signaling backend.
---

# Working on multiplayer

`@gg-web-engine/multiplayer` lets 2–8 peers share one physics world on any physics adapter. Read
the package `README.md` first for the consumer-facing picture; this file is about how it works and
what bit while building it.

## The model in one paragraph

**Ownership decides whose broadcast wins, never who simulates.** Every peer simulates every entity;
exactly one peer *owns* each networked entity and broadcasts its state, every other peer's copy (a
*replica*) is corrected toward that state. A peer *possesses* the entities its player drives - it
owns them until `release()` or a takeover; every other (*Free*) entity is arbitrated by an
`IOwnershipStrategy` (`NearestPeerOwnership`: distance + contact rules). Core knows nothing about
peers: it only defines how an entity is captured and corrected.

## Layout

```
packages/core/src/base/interfaces/i-network-syncable.ts   INetworkSyncable, INetworkInputDriven,
                                                          NetworkApplyContext, CorrectionTuning
packages/core/src/base/network/                           RigidBodyCorrection, MoverCorrection,
                                                          net-math (internal, 2D/3D at runtime)
packages/multiplayer/src/sync/   transport-agnostic: NetworkController (+ 2D/3D), wire types,
                                 ITransport, LoopbackHub/LoopbackTransport, VirtualScheduler,
                                 ClockSync, chunking, ownership strategies, LinkConditioner
packages/multiplayer/src/p2p/    WebRtcMeshTransport, ISignalingChannel, FirebaseSignaling,
                                 BroadcastChannelSignaling, zoning, room URL helpers
packages/multiplayer/firebase/   deploy files (gitignored except README) - rules + sweep function
packages/multiplayer/test/       sync unit tests, in-process harness (all 4 physics adapters),
                                 p2p tests (fake RTCPeerConnection, fake Firebase), bot harness
```

`src/sync` must never import from `src/p2p` - it is the half a future dedicated-server package
reuses.

## Core contracts (what an entity implements)

- `INetworkSyncable<S>`: `captureNetworkState(): S` (plain JSON) on the owner,
  `applyNetworkState(target, ctx)` on replicas, optional `captureFullNetworkState()` (join/takeover),
  optional `isNetworkSyncEnabled` (`false` = ignored entirely) and `networkTuning`.
  `NetworkApplyContext` = `{ ageMs, dt, snap, tuning }` - `tuning` is the controller's merged with
  the entity's override, so helpers need no extra argument.
- `INetworkInputDriven<I>`: `captureLocalInput()` on the possessor, `applyRemoteInput(input | null)`
  on replicas; `null` = neutral (entity defines it).
- Built-ins: `Entity2d`/`Entity3d` (rigid-body snapshot; enabled only with a non-static body),
  `GgCarEntity` (chassis snapshot + gear/steering/throttle/brake/handbrake; input-driven;
  `autoShiftEnabled`, auto-suspended while remote input drives it), both character entities
  (`MoverNetState`, input incl. `jumpSeq` = `jumpCount`, `externalDisplacement`, `actualVelocity`,
  `ISerializableEntity` with a `state` block the `"Player"` loader class applies).
- **An entity nested under a networked entity is never networked itself** - the parent's state
  covers it (a car's own `RaycastVehicle3dEntity` child, an app entity driving a child platform).
- App classes: implement the interfaces, delegate to `RigidBodyCorrection.capture/correct` or
  `MoverCorrection.capture/correct` (the latter needs the `INetworkMover` surface:
  `position/rotation/fallVelocity/airHorizontalVelocity/isCrouching/externalDisplacement/
  actualVelocity`).

`RigidBodyCorrection` (per body kind): extrapolate the snapshot by velocity (capped at
`extrapolateMaxMs`), deadzone → nothing (and an awake replica of a sleeping target is put to sleep),
`snap`/beyond `snapDistance` → write outright, else dynamic = steer velocity toward
`targetLv + error·velocityGain` at `positionGain`/s (a *P-controller on velocity*: adding the bias
to the previous tick's velocity accumulates and overshoots badly), sleeping target = glide with zero
velocity, kinematic = transform lerp only, static = never. `MoverCorrection` never teleports: the
error becomes `externalDisplacement`, consumed by the next `move()`. It extrapolates by `v` (the
owner's actual last-tick velocity) - `fallVelocity + airHorizontalVelocity` alone omit grounded
walking, so extrapolating by them makes every replica pull back toward a stale position.

## Tick integration

`NetworkController` ticks at `TickOrder.NETWORK_IN` (100): process newly added entities, apply
remote input (only when a new packet arrived) and corrections (every tick - extrapolation keeps
moving), arbitrate every `arbitrationIntervalTicks`. Capture + send happen on
`tickForwardedTo$('PHYSICS_WORLD')` (right after the physics step), at `sendRate` with a keepalive for
unchanged state. Everything that must run while the world clock is paused (heartbeats, clock sync,
join handshakes, link latency) runs on the injected `NetScheduler`, never on `tick$`.

## Things that bit, and the rule each one left behind

- **Classify entities lazily, at the next `NETWORK_IN` tick, never inside `entityAdded$`.** Whether an
  entity is shared or a runtime spawn is often decided *after* `addEntity` (`markShared` right after
  `attachToChunk`, a level group parented after a generator self-added its entity). Pending entities
  wait until the session is joined.
- **While any remote spawn is being built, don't classify pending entities at all.** A generator
  (e.g. `"Primitive"` → `addPrimitiveRigidBody`) adds the entity to the world under a provisional
  auto-name *before* `createEntity` resolves and renames it; a tick in between registered it as a
  local spawn and bounced a copy back - an endless spawn ping-pong between peers.
- **Departed ≠ out of range.** With zoning, a peer leaving the connect ring is still in the room and
  still owns its things; taking them over causes split-brain ownership. The transport reports
  `peerLeft$` only when a peer leaves the signaling presence (aged-out connections close silently);
  the controller's `departed` set (peerLeft or heartbeat timeout *while connected*) is the only thing
  that makes an owner "unavailable", and owner-silence claims apply only to connected owners.
- **Shared levels registered after joining are new content, not a mismatch.** Two peers connecting
  at once each see the other's dump list only the first level; the level check runs only for sources
  registered before `connect()` (not on resync).
- **Tombstones only mean removed shared content.** A runtime spawn clears a tombstone for its id - a
  player's character legitimately comes back under the same name after leaving a car.
- **`despawn` works for non-networked shared content** (a coin trigger): broadcast and remove by name,
  and pending/joined entities whose name is tombstoned are removed on processing.
- **Contact claims compare pre-impact speeds** (the latest snapshot's `lv`), never the bodies' current
  velocities - those are post-solve, and the hit body is then often the faster one, which made it
  "claim" the hitter right back. Some adapters (Ammo) report impulse 0 on a contact's first step;
  `ContactContext.estimatedImpulse` (closing speed × lighter mass) is the adapter-independent stand-in.
- **2D worlds are pixels.** Both 2D physics adapters work at 100 px/m; every distance default (deadzone,
  snap distance, ownership floor, impulse threshold) is scaled by `unitScale` (`Network2dController`
  defaults it to 100). A 1-unit test box in a 2D world is a 1-pixel box and behaves absurdly.
- **One controller per process**: the default-name middleware (`prefixEntityNames`) is process-global;
  the in-process harness turns it off.
- **`connect()` must not decide whom to wait for before presence is known** - wait for the first
  presence snapshot containing the local peer, plus the signaling's `discoveryDelayMs`
  (`BroadcastChannelSignaling` peers only answer a newcomer's announcement), or a joiner thinks it is
  alone and claims everything.
- **Presence `ts` is refreshed every 2 minutes**, because the backstop sweep deletes presence older than
  10 minutes.

## Testing

- **In-process harness** (`test/harness/harness.ts`): several `GgWorld`s joined by a `LoopbackHub` on
  one `VirtualScheduler`; `step()` advances network time and every world clock in lockstep
  (`worldClock.step` on paused worlds). `in-process.spec.ts` runs every scenario on rapier2d, matter,
  rapier3d and ammo (`describe.each(ADAPTERS)`); add new scenarios there. Use `adapter.at/up/along` and
  compare distances in meters (`dist / adapter.unit`). matter-js never falls asleep on its own.
- Adapter sources are mapped in jest (`@gg-web-engine/<adapter>` → `../<adapter>/src`) and resolve
  through the workspace - **don't add adapter packages to `devDependencies`**: the release script
  installs each package standalone against the freshly published core, and the old adapter versions'
  peer ranges would conflict.
- `firebase/*` is mapped to `test/stubs/firebase.ts`, an in-memory Realtime Database (with real-RTDB
  pruning of empty nodes) - `FirebaseSignaling` is tested against it. `test/p2p/fakes.ts` has a fake
  `RTCPeerConnection` and an in-memory signaling hub for `WebRtcMeshTransport`.
- **Bot harness** (`npm run bot`, `test/bot/zoning-bot.bot.ts`, own `jest.bot.config.js`): real Firebase
  + a node WebRTC package, on demand only. It imports `src/p2p` files directly - the package index pulls
  in `@gg-web-engine/core`, which needs a browser `window`.
- Live: open an example's `?room=` URL in two tabs (BroadcastChannel signaling needs no backend).
  Automation tabs are hidden: `requestAnimationFrame` doesn't tick and `setTimeout` is clamped to ≥1 s,
  so drive worlds with `worldClock.step(16)` in a loop that yields through a `MessageChannel` (not
  throttled) so network events still run between steps.

## Writing a transport or signaling backend

`ITransport`: `localPeerId`, `peers$`/`peers` (connected), `send(to | 'all', 'reliable' |
'unreliable', msg)`, `messages$`, `peerLeft$` (left for good), `connect()`, `disconnect()`, optional
`streamTargets()` (interest management) and `updateLocalPosition()` (zoning). A single-channel
transport ignores the channel hint. `ISignalingChannel`: rooms, presence (with zoning cells), SDP/ICE
relay, optional `discoveryDelayMs`. A server variant pairs a websocket `ITransport` with
`AlwaysServerOwnership`.

## Keep this skill current

When work on `packages/multiplayer` or the core networking contracts hits a pitfall this file doesn't
mention, or something here turns out wrong, fold a short note (what went wrong, why, the fix) into the
relevant section before finishing. Describe the current behavior, not the change history - that
belongs in `CHANGELOG.md`/`milestones.md`. Never name a real `examples/*` app here; describe the
scenario generically.
