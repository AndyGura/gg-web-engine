import {
  Gg3dWorld,
  GgCarEntity,
  GgCarHandlingController,
  GgStatic,
  LoadingScreen,
  Pnt3,
  Point3,
  Qtrn,
  TypedGg3dWorld,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
import { Rapier3dGgWorld, Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import {
  BroadcastChannelSignaling,
  buildRoomUrl,
  FirebaseSignaling,
  generateRoomId,
  getRoomIdFromUrl,
  ISignalingChannel,
  Network3dController,
  WebRtcMeshTransport,
} from '@gg-web-engine/multiplayer';
import { level } from './level';
import { carJson, followWithChaseCamera } from './car';

// Development builds get the engine's dev console (backquote key). The branch is dead code in a
// production build, so the console is not shipped to players.
if (import.meta.env.DEV) {
  GgStatic.instance.devConsoleEnabled = true;
}

// 1. The engine's loading screen covers the page until the game runs.
const loading = LoadingScreen.show();

// 2. A 3D world: three.js renders it, Rapier simulates it. Every peer in a room must use the same
//    physics backend.
const world: TypedGg3dWorld<ThreeGgWorld, Rapier3dGgWorld> = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new Rapier3dWorldComponent(),
});
await world.init();
const canvas = document.getElementById('gg') as HTMLCanvasElement;
const renderer = world.addRenderer(world.visualScene.factory.createPerspectiveCamera(), canvas);
renderer.position = { x: 0, y: -40, z: 25 };
renderer.rotation = Qtrn.lookAt(renderer.position, Pnt3.O);

// 3. Signaling: how peers find each other before talking directly over WebRTC.
//    - default: Firebase, using the engine maintainer's shared public project (fine for trying
//      things out; pass `{ config: yourFirebaseConfig }` for a real game - see README.md).
//    - `?local` in the URL: BroadcastChannel, which connects tabs of this one browser, no network.
const local = new URLSearchParams(location.search).has('local');
const signaling: ISignalingChannel = local ? new BroadcastChannelSignaling() : new FirebaseSignaling();

// 4. The room: from `?room=` in the URL, or a fresh id written into the address bar, so the
//    current URL is the link to share. (A new id is made locally; nothing needs to be registered
//    before the first peer joins it.)
const roomId = getRoomIdFromUrl() ?? generateRoomId();
const roomUrl = buildRoomUrl(roomId);
history.replaceState(null, '', roomUrl);

// 5. The network controller shares the world with the other peers in the room.
const net = new Network3dController({ transport: new WebRtcMeshTransport({ signaling, roomId }) });
world.addEntity(net);

// 6. The arena is shared content: every peer builds it itself from src/level.ts, only the state of
//    its dynamic bodies travels.
await net.loadSharedLevel(level, 'arena', 'arena-v1');
world.start();
loading.hide();

// 7. Join the room. Alone: this peer owns everything. Otherwise: receive the room's current state.
//    This waits on the network, so the HUD says what is going on meanwhile.
let joined = false;
renderHud();
const slowHint = setTimeout(() => {
  if (!joined)
    setStatus(
      'Still connecting... signaling unreachable? Add ?local to the URL to try it in two tabs of this browser.',
    );
}, 15000);
try {
  await net.connect();
} catch (error) {
  setStatus(`Could not join the room: ${error instanceof Error ? error.message : String(error)}`);
  throw error;
} finally {
  clearTimeout(slowHint);
}
joined = true;

// 8. Spawn this player's own car. A runtime spawn: it is serialized and rebuilt on every peer.
//    Possessing it makes this peer drive it (its input and state win).
const me = net.localPeerId;
const car = await world.loader.createEntity(carJson(`Car_${me}`, ...freeSpawnPoint(), colorOf(me)));
if (!(car instanceof GgCarEntity)) throw new Error('The "GgCar" level class did not build a GgCarEntity');
world.addEntity(car);
net.possess(car);
net.localPosition = () => car.position; // where this player is, for ownership of nearby props

// 9. Keyboard driving: arrows or WASD, Space for the handbrake. "Down" brakes, then reverses.
const driving = new GgCarHandlingController(world.keyboardInput, car, {
  keymap: 'wasd+arrows',
  maxSteerDeltaPerSecond: 6,
  gearUpDownKeys: ['KeyE', 'KeyQ'], // manual shifting only; off below
  autoReverse: true,
  neutralGear: false,
  handbrakeKey: 'Space',
});
driving.switchingGearsEnabled = false; // automatic gearbox: E/Q do nothing until this is turned on
world.addEntity(driving);
followWithChaseCamera(renderer, car);

// 10. When a player leaves the room, the peer that took over their car removes it.
const despawnDepartedCars = () => {
  const present = new Set([me, ...net.peerInfos.map(p => p.peerId)]);
  // a copy: despawning removes the car from world.children while the loop runs
  for (const entity of [...world.children]) {
    if (!(entity instanceof GgCarEntity) || !entity.name.startsWith('Car_')) continue;
    const owner = entity.name.slice('Car_'.length);
    if (!present.has(owner) && net.isNetworked(entity) && net.isLocallyOwned(entity)) {
      net.despawn(entity);
    }
  }
};
net.peers$.subscribe(() => {
  despawnDepartedCars();
  renderHud();
});
net.ownershipChanged$.subscribe(despawnDepartedCars);
renderHud();

// --- Where to go from here: add gameplay below. Ideas: a trigger in level.ts that scores a point
//     (gate it with `net.hasAuthority(...)` so it counts once), `net.send(...)`/`net.appMessages$` for
//     game events, `net.joinState` for late joiners. See README.md.

/** A small overlay: the link to share and how many players are in the room. */
function renderHud() {
  const players = 1 + net.peerInfos.length;
  const via = local ? 'local tabs (BroadcastChannel)' : 'Firebase';
  setStatus(
    joined ? `${players} player${players === 1 ? '' : 's'} in room · ${via} signaling` : `Connecting via ${via}...`,
  );
  const link = document.getElementById('room-link') as HTMLInputElement;
  link.value = roomUrl;
  link.onfocus = () => link.select();
}

function setStatus(text: string) {
  document.getElementById('status')!.textContent = text;
}

/**
 * A spawn point no other car is standing on: 8 slots on a circle, facing the center. Each peer
 * starts looking at a different slot (picked from its peer id), then takes the first free one.
 */
function freeSpawnPoint(): [Point3, ReturnType<typeof Qtrn.fromEuler>] {
  const SLOTS = 8;
  const RADIUS = 14;
  const cars = world.children.filter((e): e is GgCarEntity => e instanceof GgCarEntity);
  const start = hash(me) % SLOTS;
  let slot = start;
  for (let i = 0; i < SLOTS; i++) {
    slot = (start + i) % SLOTS;
    const p = slotPosition(slot);
    if (cars.every(c => Pnt3.dist({ ...c.position, z: 0 }, { ...p, z: 0 }) > 5)) break;
  }
  function slotPosition(s: number): Point3 {
    const a = (s / SLOTS) * Math.PI * 2;
    return { x: Math.cos(a) * RADIUS, y: Math.sin(a) * RADIUS, z: 1 };
  }
  const angle = (slot / SLOTS) * Math.PI * 2;
  // the car's forward axis is +Y; turn it to face the arena's center
  return [slotPosition(slot), Qtrn.fromEuler({ x: 0, y: 0, z: angle + Math.PI / 2 })];
}

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A per-player car color, the same on every peer. */
function colorOf(peerId: string): number {
  const palette = [0xd7263d, 0x1b998b, 0x2e86ab, 0xf46036, 0xc5d86d, 0x8e44ad, 0xf1c40f, 0xecf0f1];
  return palette[hash(peerId) % palette.length];
}
