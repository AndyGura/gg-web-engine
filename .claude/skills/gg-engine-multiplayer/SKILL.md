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
packages/multiplayer/firebase/   deployable rules + optional sweep function (not in the npm package)
packages/multiplayer/test/       sync unit tests, in-process harness (all 4 physics adapters),
                                 p2p tests (fake RTCPeerConnection, fake Firebase)
```

`src/sync` must never import from `src/p2p` - it is the half a future dedicated-server package
reuses.

## Core contracts (what an entity implements)

- `INetworkSyncable<S>`: `captureNetworkState(): S` (plain JSON) on the owner,
  `applyNetworkState(target, ctx)` on replicas (may return the helper's `CorrectionOutcome`, used
  only for diagnostics), optional `captureFullNetworkState()` (join/takeover),
  optional `isNetworkSyncEnabled` (`false` = ignored entirely) and `networkTuning`.
  `NetworkApplyContext` = `{ ageMs, sinceReceivedMs, dt, snap, tuning }` - `ageMs` is how old the
  snapshot is on the owner's clock (latency included), `sinceReceivedMs` how long ago it arrived
  here; `tuning` is the controller's merged with the entity's override, so helpers need no extra
  argument.
- `INetworkInputDriven<I>`: `captureLocalInput()` on the possessor, `applyRemoteInput(input | null)`
  on replicas; `null` = neutral (entity defines it).
- Built-ins: `Entity2d`/`Entity3d` (rigid-body snapshot; enabled only with a non-static body),
  `GgCarEntity` (chassis snapshot + gear/steering/throttle/brake/handbrake; input-driven;
  `autoShiftEnabled`, auto-suspended while remote input drives it; the snapshot's driving state is
  adopted only without remote input), both character entities
  (`MoverNetState`, input incl. `jumpSeq` = `jumpCount`, `externalDisplacement`, `actualVelocity`,
  `ISerializableEntity` with a `state` block the `"Player"` loader class applies).
- **An entity nested under a networked entity is never networked itself** - the parent's state
  covers it (a car's own `RaycastVehicle3dEntity` child, an app entity driving a child platform).
- App classes: implement the interfaces, delegate to `RigidBodyCorrection.capture/correct` or
  `MoverCorrection.capture/correct` (the latter needs the `INetworkMover` surface:
  `position/rotation/fallVelocity/airHorizontalVelocity/isCrouching/externalDisplacement/
  actualVelocity`).

`RigidBodyCorrection` (per body kind): extrapolate the snapshot by velocity (capped at
`extrapolateMaxMs`; a dynamic replica of a moving target whose snapshot arrived longer ago than that,
up to `coastMaxMs`, coasts on its own simulation - pinning it to the point extrapolation stopped at
made it snap back every `snapDistance` for as long as the stream stalled. A stall is judged by
`sinceReceivedMs` only: by `ageMs`, a link slower than `extrapolateMaxMs` looks stalled all the time
and its replicas are never corrected), deadzone → nothing (and an awake replica of a sleeping target
is put to sleep), `snap`/beyond `snapDistance` → write outright, else dynamic = steer velocity toward
`targetLv + error·velocityGain` at `positionGain`/s (a *P-controller on velocity*: adding the bias
to the previous tick's velocity accumulates and overshoots badly), sleeping target = glide with zero
velocity, kinematic = transform lerp only, static = never. `MoverCorrection` never teleports: the
error becomes `externalDisplacement`, consumed by the next `move()`. It coasts through a stalled
stream the same way, and extrapolates by `v` (the owner's actual last-tick velocity) - `fallVelocity + airHorizontalVelocity` alone omit grounded
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
  local spawn and bounced a copy back - an endless spawn ping-pong between peers. A `possess()` of an
  entity that can't be registered yet (this case, or a session that isn't `'joined'`) goes to
  `desiredPossessions`, drained every joined tick, after `connect()` and after a resync - never
  return `false` for it: games ignore the result, and a dropped possession leaves the player's own
  character Free, so another peer may take it.
- **A link can open long after joining.** Join dumps only cover the links open during `connect()`;
  with zoning, two joined peers meet later (and a slow or retried connection opens late too). Each
  side then sends the other a `spawn` of every runtime spawn it owns (`sendOwnedSpawns`), or the
  other never builds them and drops their state as unknown. Spawns are idempotent: a peer still
  joining may get the same entity from a `spawn` and its dump, and `spawnFromItem` skips an id
  already built or being built.
- **Departed ≠ out of range.** With zoning, a peer leaving the connect ring is still in the room and
  still owns its things; taking them over causes split-brain ownership. The transport reports
  `peerLeft$` only when a peer leaves the signaling presence (aged-out connections close silently);
  the controller's `departed` set (peerLeft or heartbeat timeout *while connected*) is the only thing
  that makes an owner "unavailable", and owner-silence claims apply only to connected owners.
- **A peer without a position keeps its last zoning cell.** An empty cell (`''`) counts as inside every
  ring - right for a peer never placed yet, but a hidden tab (heartbeat `pos: null`) or a spectator
  publishing it would make every peer in the room connect and stream full state to the one peer that
  needs the least. `ZoneTracker.update(null)` keeps the current cell.
- **Shared levels registered after joining are new content, not a mismatch.** Two peers connecting
  at once each see the other's dump list only the first level; the level check runs only for sources
  registered before `connect()` (not on resync).
- **Tombstones only mean removed shared content.** A `despawn` of shared content carries
  `shared: true`, and only those are tombstoned (and listed in join dumps) - a runtime spawn's id
  never is: tombstones live forever, and a stale one makes a joiner drop the live entity that later
  reused the name (a player's character legitimately comes back under the same name after leaving a
  car). A runtime spawn also clears a tombstone for its id.
- **`despawn` works for non-networked shared content** (a coin trigger): broadcast and remove by name,
  and pending/joined entities whose name is tombstoned are removed on processing.
- **Peers' clocks share no origin.** `performance.now()` counts from each tab's start, so a remote
  timestamp means nothing before that peer's clock sync is `ready` (`toLocalTime` returns "now"
  until then). A duration crosses the wire as two timestamps of one sender - a spawn's lifetime is
  `expiresAt - ts`, added to the receiver's own clock - never as one converted absolute time.
- **A peer's clock offset must never step.** Replicas are extrapolated by sender timestamp, so a
  change of the offset by `d` ms moves the target of everything that peer owns by `speed × d` at
  once (70 m/s × 40 ms = 2.8 m: a teleport, or a lunge below `snapDistance`). A LAN never shows it.
  Three rules follow. (1) One ping/pong only bounds the offset (`t2 - t3 <= offset <= t1 - t0`), and
  its midpoint is off by half of whatever one leg was delayed (network, or a busy main thread
  delaying the handler that stamps the time) - so `ClockSync` never averages: it takes the tightest
  bound of each direction over a window of the latest samples, and a delayed sample just isn't one
  of them. (2) Pings and pongs travel `unreliable`: a retransmitted or head-of-line-blocked one
  measures the retransmission, a lost one is only a missing sample. A pong is valid whenever it
  arrives (it carries its own `t0`). (3) Once `ready` (3 samples, which the burst of pings on a
  newly opened link delivers within half a second), `offset` slews toward the estimate at a few
  ms/s as `advance(now)` is called, and steps only for a gross error or when a sample contradicts
  the window (the remote clock itself jumped). In a test, give a peer its own clock origin by
  wrapping the shared scheduler with a shifted `now()`.
- **Contact claims compare pre-impact speeds** (the latest snapshot's `lv`), never the bodies' current
  velocities - those are post-solve, and the hit body is then often the faster one, which made it
  "claim" the hitter right back. Some adapters (Ammo) report impulse 0 on a contact's first step;
  `ContactContext.estimatedImpulse` (closing speed × lighter mass) is the adapter-independent stand-in.
- **2D worlds are pixels.** Both 2D physics adapters work at 100 px/m; every distance default (deadzone,
  snap distance, ownership floor, impulse threshold) is scaled by `unitScale` (`Network2dController`
  defaults it to 100). A 1-unit test box in a 2D world is a 1-pixel box and behaves absurdly.
- **One prefixing controller per process.** The default-name middleware (`prefixEntityNames`) is
  process-wide, because names are generated at construction, before an entity has a world. It is
  registered while the controller is in a world (`onSpawned` to `onRemoved`), not only while
  connected: an entity built before `connect()` (the player's character) still needs a peer-unique
  name once it is networked. A second prefixing controller warns and doesn't register, so prefixes
  never stack. The in-process harness turns prefixing off for every peer. Shared content must be named
  explicitly, because its auto-generated names differ between peers.
- **`connect()` must not decide whom to wait for before presence is known** - wait for the first
  presence snapshot containing the local peer, plus the signaling's `discoveryDelayMs`
  (`BroadcastChannelSignaling` peers only answer a newcomer's announcement), or a joiner thinks it is
  alone and claims everything.
- **Every `await` in a join path is a cancellation point.** `leave()` can run while `connect()` or
  `returnFromAway()` waits on the transport or on join dumps, and `disconnect()` while the transport's
  own `connect()` waits on signaling. Both bump a generation counter that the suspended code checks
  after each `await`. The teardown also resolves a pending join and resumes a world paused for it, so
  nothing finishes joining a session that was left. A failed join (transport error, level mismatch)
  tears the session down to `'idle'`, so `connect()` can be retried; never leave it in `'connecting'`.
- **A departed peer's possessed entities stay in the world.** The takeover election (nearest remaining
  peer) only moves ownership to the taker and clears possession; removing a departed player's
  character is the game's decision. The pattern: on `peers$` and `ownershipChanged$`, `despawn` every
  character whose player isn't in `[localPeerId, ...peerInfos]` and that is `isNetworked` and
  `isLocallyOwned` - so only the taker removes it. Two traps: a hidden tab (`goAway`) triggers the same
  takeover while its peer stays in `peerInfos` (with `away: true`), so check presence, never just
  "possessor became null"; and `isLocallyOwned` is `true` for a not-yet-classified (not networked)
  entity, hence the `isNetworked` guard. A peer back from away should respawn its character if it's
  gone (`resynced$`).
- **`takeoverPossessed: false` pins possessed entities to their peer.** The takeover election (departure,
  heartbeat timeout, a hidden tab's `goAway`) then skips what the gone peer possesses: owner and
  possessor stay, replicas get `applyRemoteInput(null)` (the last input would otherwise drive them on
  forever) and freeze on the last snapshot; the peer's next state packet brings the input back.
  Arbitration never touches a possessed record, so nothing else can move it. Every peer must use the
  same value. It doesn't cover an entity not possessed *yet* (a shared entity whose player hasn't
  connected is Free and gets arbitrated until that player's `possess` arrives).
- **Silence is never measured across a local stall.** A frozen main thread (or a throttled timer)
  resumes with everything the others sent still queued behind the timer or tick that runs first, so
  every peer looks silent for the whole freeze - the stalled peer would declare them all departed and
  take over everything. `checkStall()` runs at the start of both the world tick and the heartbeat
  timer; a gap of over two heartbeat intervals since either last ran refreshes every peer's
  `lastHeard` and every remote record's `lastStateAt`. Anything new that judges silence must call it
  first. In the harness, a stall is `scheduler.time += N` (all peers at once).
- **Every record always has an owner, also outside a session.** `leave()` makes the local peer owner
  of everything (it is alone) and keeps its possessions, queued in `desiredPossessions`. Without that,
  a reconnect started from stale owners - one that left the room meanwhile was neither connected nor
  `departed`, so nothing ever reclaimed its entities, frozen on its last snapshot. A `connect()` after
  a session is a *rejoin*: dumps are applied with force (the room's ownership wins whatever the
  epochs), the queued possessions are taken at once, and a non-shared record nobody vouched for is
  gone from the room - removed if it was a remote spawn, re-announced (`spawn`) if it was our own.
- **Presence `ts` is refreshed every 2 minutes**, because the optional backstop sweep deletes presence
  older than 10 minutes. The sweep needs the Blaze plan and the default project runs without it, so
  the client must never depend on it - `onDisconnect()` removal is the cleanup mechanism.
- **A rules change is a contract change.** `firebase/database.rules.json` is deployed by hand
  (`firebase deploy --only database`); keep it and the package README's rule list in agreement when
  changing what the client writes. The in-memory stub (`test/stubs/firebase.ts`) doesn't enforce rules,
  so a mismatch only shows up live, as `PERMISSION_DENIED` in the browser console.

## Testing

- **In-process harness** (`test/harness/harness.ts`): several `GgWorld`s joined by a `LoopbackHub` on
  one `VirtualScheduler`; `step()` advances network time and every world clock in lockstep
  (`worldClock.step` on paused worlds). `in-process.spec.ts` runs every scenario on rapier2d, matter,
  rapier3d and ammo (`describe.each(ADAPTERS)`); add new scenarios there. Use `adapter.at/up/along` and
  compare distances in meters (`dist / adapter.unit`). matter-js never falls asleep on its own.
  `LoopbackHub.partition`/`heal` simulate a crashed peer (silent, noticed by heartbeat timeout);
  `cutLink`/`openLink` simulate two peers out of each other's zoning range (no link, nobody left).
- Adapter sources are mapped in jest (`@gg-web-engine/<adapter>` → `../<adapter>/src`) and resolve
  through the workspace - **don't add adapter packages to `devDependencies`**: the release script
  installs each package standalone against the freshly published core, and the old adapter versions'
  peer ranges would conflict.
- `firebase/*` is mapped to `test/stubs/firebase.ts`, an in-memory Realtime Database (with real-RTDB
  pruning of empty nodes) - `FirebaseSignaling` is tested against it. `test/p2p/fakes.ts` has a fake
  `RTCPeerConnection` and an in-memory signaling hub for `WebRtcMeshTransport`.
- **Real connection timing** is never tested automatically. `WebRtcMeshTransport.setupTimes` holds each
  link's setup time; with every peer on one machine it measured 71–680 ms. That is a best case, since
  peers on one machine connect over local host candidates and real peers add STUN (and possibly TURN)
  round trips. Check zoning cell sizes against it: speed × setup time must fit in the one-cell margin.
- **A clean link hides timing bugs.** Loopback and same-machine WebRTC deliver in under a millisecond,
  in order, with nothing lost. `LoopbackHub` conditions (latency, jitter, loss) cover tests;
  `LinkConditioner` (`controller.conditioner`, the `net_lag` console command) reproduces a real link
  on the receive path of a live peer: jitter, delivery stalls released as a burst, and reliable
  messages delayed like a retransmission, holding back the sender's later ones (one queue per sender
  drained by one timer at a time: timers of their own don't keep the order, since a host cuts a delay
  to whole milliseconds and two messages due at the same moment then fire in either order). The `net_panel`
  command shows what the link is doing while it happens (`NetDebugPanel`, fed by
  `controller.netStats`): a per-peer offset that keeps slewing or a snapshot age that jumps is the
  clock, a rising `loss` is the link, and `jump`/`lunges`/`snaps` say whether a replica's target
  actually moved (`jump` is the distance between the old and the new snapshot, both extrapolated to
  the moment the new one arrives - near zero for steady motion whatever the latency). Snaps are
  counted from what `applyNetworkState` returns, so an app entity that wants to show up there returns
  its correction helper's outcome. Loss comes from the counter `n` on every state message; a
  transport that splits a state message must keep `n` on every part. A late message takes back a loss
  only if its own counter was counted as lost (a gap after a paused stream never is). Every outgoing message must go through the
  controller's `transmit()`, never `transport.send()` directly, or the stats miss it.
- Live: open an example's `?room=` URL in two tabs (BroadcastChannel signaling needs no backend).
  Automation tabs are hidden: `requestAnimationFrame` doesn't tick and `setTimeout` is clamped to ≥1 s,
  so drive worlds with `worldClock.step(16)` in a loop that yields through a `MessageChannel` (not
  throttled) so network events still run between steps.

## Writing a transport or signaling backend

`ITransport`: `localPeerId`, `peers$`/`peers` (connected), `send(to | to[] | 'all', 'reliable' |
'unreliable', msg)`, `messages$`, `peerLeft$` (left for good), `connect()`, `disconnect()`, optional
`streamTargets()` (interest management) and `updateLocalPosition()` (zoning). A single-channel
transport ignores the channel hint. Serialize a message once per `send()`, whatever the number of
targets: the controller sends each state flush to all of `streamTargets()` in one call. An unreliable message must never
wait in a send queue: delivered late it is useless (a stale snapshot, a clock-sync ping measuring the
queue), and the queue turns one lost packet into a stall. `WebRtcMeshTransport` drops it while the
channel's `bufferedAmount` is above `unreliableBufferLimit` - checked once per message, before its
first frame, so the frames of one split state message aren't starved by each other. `ISignalingChannel`: rooms, presence (with zoning cells), SDP/ICE
relay, optional `discoveryDelayMs`. A server variant pairs a websocket `ITransport` with
`AlwaysServerOwnership`.

## Keep this skill current

When work on `packages/multiplayer` or the core networking contracts hits a pitfall this file doesn't
mention, or something here turns out wrong, fold a short note (what went wrong, why, the fix) into the
relevant section before finishing. Describe the current behavior, not the change history - that
belongs in `CHANGELOG.md`/`milestones.md`. Never name a real `examples/*` app here; describe the
scenario generically.
