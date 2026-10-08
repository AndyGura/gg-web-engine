<p align="center">
  <img src="../../documentation/assets/banner.png" width="100%" alt="GG Web Engine"/>
</p>

## Shared-world multiplayer for [gg-web-engine](https://github.com/AndyGura/gg-web-engine)

`@gg-web-engine/multiplayer` is built for 2–8 peers sharing one physics world, 2D or 3D, on any physics
adapter. It is peer-to-peer first (WebRTC data channels, signaling over Firebase Realtime Database),
with the transport behind an `ITransport` seam so a dedicated server can slot in later.

**Ownership decides whose broadcast wins, never who simulates.** Every peer simulates every entity;
each entity has one owner whose state is broadcast, and every other peer's copy (a *replica*) is
gently corrected toward it. A peer *possesses* the entities its player drives (a character, a car)
and owns them until it releases them; every other (*Free*) entity belongs to whoever is near it.

### Installation
1) make sure **@gg-web-engine/core** is installed
1) `npm install --save @gg-web-engine/multiplayer firebase`

### Usage
```typescript
import {
  BroadcastChannelSignaling,
  buildRoomUrl,
  FirebaseSignaling,
  getRoomIdFromUrl,
  Network3dController,
  WebRtcMeshTransport,
} from '@gg-web-engine/multiplayer';

const signaling = firebaseConfig ? new FirebaseSignaling({ config: firebaseConfig }) : new BroadcastChannelSignaling();
const roomId = getRoomIdFromUrl() ?? (await signaling.createRoom()); // share buildRoomUrl(roomId)
// runtime spawns are rebuilt with the world's own level loader (`world.loader`) by default -
// register the game's entity classes there (or pass `levelLoader`)
const net = new Network3dController({ transport: new WebRtcMeshTransport({ signaling, roomId }) });
world.addEntity(net);
await net.loadSharedLevel(levelJson, 'level', 'level.json'); // every peer builds it itself
await net.connect(); // alone: owns everything; otherwise: pauses, receives join dumps, resumes

const player = await world.loader.createEntity({ class: 'Player', position: spawnPoint });
world.addEntity(player); // a runtime spawn: replicated to every peer automatically
net.possess(player); // local input drives it, state + input are broadcast
```

The rest of the game code is single-player code. Entering a car is `net.possess(car)`, leaving it
`net.release(car)`; what a player can possess is game logic. When a peer leaves, goes silent or hides
its tab, another peer takes over what it owned, possessed entities included (their possession is
cleared); with `takeoverPossessed: false` a possessed entity never changes hands - it stays its
player's and stands still with neutral input until that player is back.

### What gets networked
Every entity implementing core's `INetworkSyncable` (built in: `Entity2d`/`Entity3d` with a
non-static body, `GgCarEntity`, both character entities), unless `net.exclude(entity)`. Entities
nested under a networked entity travel with it. Each one is either:

- **shared** - built by every peer from the same source with the same names (`registerSharedLevel`/
  `loadSharedLevel`, or `markShared(entities)` for seeded/streamed content); only its state travels;
  a peer that loads one later asks the room for its state; `world.removeEntity` is a local unload,
  `net.despawn(entity)` removes it everywhere (also for late joiners);
- **a runtime spawn** - anything else: serialized with the level loader and rebuilt on every peer.
  An entity the loader can't serialize stays local and is reported on `spawnFailed$`.

App classes take part by implementing `INetworkSyncable` (and `INetworkInputDriven` if a player
drives them), typically by delegating to core's `RigidBodyCorrection`/`MoverCorrection` helpers.

### Gameplay authority
Every peer sees every collision and trigger. A gameplay consequence must happen once:
`net.hasAuthority(entity, eventName, payload)` (installed as `world.eventAuthority` while joined, so
level JSON `events` blueprints are gated automatically) is true on at most one peer - the owner of the
entity entering a trigger, the smaller-id owner of two colliding entities. A peer that doesn't know a
participant's owner yet defers, so an event involving an entity nobody owns yet (shared content in
the moment after it loads) runs nowhere rather than everywhere. Run consequences there and
broadcast them (`net.despawn`, `net.send(data)` → `appMessages$`). `net.joinState` supplies late
joiners with game state (`joinState$`).

### Units
Distances in the defaults (correction deadzone/snap distance, the 10 m ownership floor, the contact
impulse threshold) are scaled by `unitScale`, world units per meter: 1 for `Network3dController`,
100 for `Network2dController` (2D physics adapters work in pixels).

### Transports
- `WebRtcMeshTransport` - one `RTCPeerConnection` per pair, a reliable ordered and an unreliable
  unordered data channel, chunking above 16 KB, reconnection with exponential backoff, ICE server
  list and `iceTransportPolicy` in its options. **P2P exposes peers' IP addresses to each other**;
  run a TURN server with `iceTransportPolicy: 'relay'` where that matters.
- `LoopbackTransport`/`LoopbackHub` - in-process, with simulated latency/jitter/loss on a
  `VirtualScheduler`; what the package's own harness runs on.

Signaling: `FirebaseSignaling` (Realtime Database), or `BroadcastChannelSignaling` to connect tabs
of one browser with no backend at all - open the same `?room=` URL in two tabs.

### Zoning
Zoning is off unless asked for: without the `zoning` option (or with `zoning: null`) the transport
is a full mesh, every peer connects to every other and sees everything. That is the right choice
for a map small enough that players see most of it. Zoning is for a world much larger than what one
player sees, with players spread over it.

`new WebRtcMeshTransport({ ..., zoning: { cellSize } })` places each peer on a grid over the ground
plane (x/y), connects only to peers within the 5×5 cell ring and streams state to the 3×3 ring;
connections outside the wide ring age out after 10 s. Sizing rule: the fastest entity's speed ×
connection setup time must fit inside the one-cell margin between the two rings. Setup measured
71–680 ms with every peer on one machine; peers on different networks add STUN/TURN round trips.
`WebRtcMeshTransport.setupTimes` reports each link's setup time for your own measurements. Make the
stream ring at least as wide as the view distance, or entities disappear in plain sight.

A peer outside the stream ring is *out of view* (once it has also been silent about an entity for
`outOfViewGraceMs`, default 2 s). Distance is the only way to get there: a peer that leaves the
room, hides its tab or crashes is taken over exactly as without zoning, and one whose connection
drops while it is in range keeps its entities. An out-of-view peer is still in the room and still
owns its things, but nothing it owns stays around as a frozen copy:

- what its player possesses disappears: a runtime spawn (its character) is removed and rebuilt when
  the peer is back in view; shared content (a level's car it drives) is *hidden* - taken out of the
  world but kept, and shown again at its real position with the owner's next state.
  `controller.isHidden(entity)` tells; a hidden entity has no `world`, so don't keep acting on one.
- a Free entity next to the local player is claimed (the local copy is the one that matters here);
  a Free runtime spawn nobody in view claims is removed; Free shared content stays and is simulated
  locally.
- if the game rebuilds hidden shared content under the same name (its chunk loaded again), the new
  entity takes over the hidden one's place and stays hidden.

A peer that leaves the room while out of view is taken over like any other, and what was hidden for
it shows up again where it was last seen.

### Dev tools
With the dev console: `net_status`, `net_panel` (a live overlay: traffic rates, and per peer the
round trip, clock offset, snapshot age, state message loss, target jumps, lunges and snaps; the same numbers are on
`controller.netStats`), `net_owners [filter]`, `net_tuning key value`,
`net_lag ms loss% jitterMs stallMs stallEveryMs reliableDelayMs reliableDelay%` (a simulated bad
incoming link: latency, unreliable loss, jitter, delivery stalls, retransmitted reliable messages;
e.g. `net_lag 40 2 15 300 5000 400 5`, `net_lag 0` to turn it off). Mutating console commands (`remove`, `spawn`, `set_position`, ...) are rejected
while joined - a local-only edit would desync peers. With `debug_view`, replicas are tinted.

### Firebase project setup
`FirebaseSignaling` uses `DEFAULT_FIREBASE_CONFIG` (the maintainer's project) unless you pass
`config`. To run your own project, follow
[`firebase/README.md`](https://github.com/AndyGura/gg-web-engine/tree/main/packages/multiplayer/firebase)
in the repo - it holds the deployable rules and the optional sweep function: enable **Anonymous**
authentication and the **Realtime Database**, deploy the rules, optionally App Check (pass
`appCheckSiteKey`). Everything the client needs runs on the free Spark plan. Data lives under
`gg-rooms/{roomId}`:

| Node | Shape | Written by |
|---|---|---|
| `meta` | `{ createdAt, uid }` | the room creator; removed by its `onDisconnect` |
| `presence/{peerId}` | `{ uid, cell, ts }` (`ts` refreshed every 2 min) | that peer only |
| `signals/{toPeerId}/{pushId}` | `{ uid, from, payload, ts }` (`payload` = JSON string ≤ 16000 chars) | the peer `from` (any peer in the room may signal any other); deleted by the recipient on read |

The rules the client relies on:
- every read/write requires `auth != null`;
- `meta` and `presence/{peerId}`: create only with `uid === auth.uid`, change only by that same uid;
  `peerId` matches `^[0-9a-z]{1,32}$`, `cell` is a string ≤ 32 chars; the room id is a UUID v4;
- `signals/{to}`: readable only by the uid that owns `presence/{to}`; a message is created with
  `uid === auth.uid` and a `from` whose `presence/{from}` belongs to that same uid (nobody signals in
  another peer's name), validated for shape/size, and never edited. A message may be deleted by its
  sender or by the owner of `presence/{to}`, the whole inbox only by that owner - and by anyone once
  `presence/{to}` is gone (an orphaned inbox).

Every node a client writes is registered with `onDisconnect().remove()`. The optional backstop
(`firebase/functions`, needs the Blaze plan) is a scheduled function removing presence/signal nodes
older than 10 minutes and rooms with no live presence.
