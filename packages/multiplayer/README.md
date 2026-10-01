<p align="center">
  <img src="../../documentation/assets/logo.png" style="height: 400px; width:400px;" alt=''/>
</p>

## Shared-world multiplayer for [gg-web-engine](https://github.com/AndyGura/gg-web-engine)

`@gg-web-engine/multiplayer` lets 2–8 peers share one physics world, 2D or 3D, on any physics
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
`net.release(car)`; what a player can possess is game logic.

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
level JSON `events` blueprints are gated automatically) is true on exactly one peer - the owner of the
entity entering a trigger, the smaller-id owner of two colliding entities. Run consequences there and
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
`new WebRtcMeshTransport({ ..., zoning: { cellSize } })` places each peer on a grid over the ground
plane (x/y), connects only to peers within the 5×5 cell ring and streams state to the 3×3 ring;
connections outside the wide ring age out after 10 s. Sizing rule: the fastest entity's speed ×
connection setup time must fit inside the wide ring's radius. Validate with the bot harness:
`GG_FIREBASE_CONFIG='{...}' npm run bot` (see `test/bot/zoning-bot.bot.ts`).

### Dev tools
With the dev console: `net_status`, `net_owners [filter]`, `net_tuning key value`,
`net_lag ms loss%`. Mutating console commands (`remove`, `spawn`, `set_position`, ...) are rejected
while joined - a local-only edit would desync peers. With `debug_view`, replicas are tinted.

### Firebase project setup
`FirebaseSignaling` uses `DEFAULT_FIREBASE_CONFIG` (the maintainer's project) unless you pass
`config`. To run your own project: enable **Anonymous** authentication and the **Realtime Database**,
optionally App Check (pass `appCheckSiteKey`). Data lives under `gg-rooms/{roomId}`:

| Node | Shape | Written by |
|---|---|---|
| `meta` | `{ createdAt, uid }` | the room creator; removed by its `onDisconnect` |
| `presence/{peerId}` | `{ uid, cell, ts }` (`ts` refreshed every 2 min) | that peer only |
| `signals/{toPeerId}/{pushId}` | `{ uid, from, payload, ts }` (`payload` = JSON string ≤ 16000 chars) | any authenticated peer; deleted by the recipient on read |

The rules the client relies on:
- every read/write requires `auth != null`;
- `meta` and `presence/{peerId}`: create only with `uid === auth.uid`, change only by that same uid;
  `peerId` matches `^[0-9a-z]{1,32}$`, `cell` is a string ≤ 32 chars; the room id is a UUID v4;
- `signals/{to}`: readable only by the uid that owns `presence/{to}`; a message is created with
  `uid === auth.uid` and validated for shape/size, and may be deleted (never edited) afterwards.

Every node a client writes is registered with `onDisconnect().remove()`. As a backstop, schedule a
function that removes presence/signal nodes older than 10 minutes and rooms with no live presence.
