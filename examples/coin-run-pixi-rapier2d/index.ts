import {
  CharacterController2dEntity,
  Entity2d,
  Gg2dWorld,
  GgStatic,
  GroupEntity,
  LevelJson,
  PlayerCharacterController2d,
  Point2,
  Trigger2dEntity,
  TypedGg2dWorld,
} from '@gg-web-engine/core';
import { PixiCameraComponent, PixiGgWorld, PixiSceneComponent } from '@gg-web-engine/pixi';
import { Rapier2dGgWorld, Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';
import {
  BroadcastChannelSignaling,
  buildRoomUrl,
  DEFAULT_FIREBASE_CONFIG,
  FirebaseSignaling,
  generateRoomId,
  getRoomIdFromUrl,
  Network2dController,
  WebRtcMeshTransport,
} from '@gg-web-engine/multiplayer';
import { FirebaseOptions } from 'firebase/app';

// Coin run: every peer runs its own character around one shared platformer level; touching a coin
// collects it for whoever touched it, first to five wins and the round restarts.
//
// Signaling: set FIREBASE_CONFIG to your own Firebase project (or leave `null` for the package's
// default project). With neither configured, rooms use BroadcastChannel signaling, which connects
// tabs of this one browser - open the room link in a second tab to play against yourself.
const FIREBASE_CONFIG: FirebaseOptions | null = null;

const COINS_TO_WIN = 5;
const COIN_RADIUS = 14;
const ROOM_WIDTH = 900;
const ROOM_HEIGHT = 600;
const WALL = 40;

GgStatic.instance.devConsoleEnabled = true;

const box = (name: string, x: number, y: number, w: number, h: number, color: number) => ({
  class: 'Primitive',
  shape: 'BOX',
  name,
  position: { x, y },
  config: { dimensions: { x: w, y: h }, material: { color }, body: { bodyType: 'static' } },
});

// The arena never changes: every peer loads it itself (shared content - only state would travel,
// and static bodies don't even have any).
const arena: LevelJson = {
  entities: [
    box('Floor', 0, ROOM_HEIGHT / 2 - WALL / 2, ROOM_WIDTH, WALL, 0x4a4e69),
    box('Ceiling', 0, -(ROOM_HEIGHT / 2 - WALL / 2), ROOM_WIDTH, WALL, 0x22223b),
    box('WallLeft', -(ROOM_WIDTH / 2 - WALL / 2), 0, WALL, ROOM_HEIGHT, 0x22223b),
    box('WallRight', ROOM_WIDTH / 2 - WALL / 2, 0, WALL, ROOM_HEIGHT, 0x22223b),
    box('PlatformLow', -260, 140, 180, 24, 0x9a8c98),
    box('PlatformMid', 20, 0, 160, 24, 0x9a8c98),
    box('PlatformHigh', 260, -140, 160, 24, 0x9a8c98),
  ],
};

// One set of ten coins per round, loaded as shared level "coins-<round>": the round number makes
// every coin's name (its network id) fresh each round, so a coin despawned last round stays gone
// without blocking this round's coin at the same spot.
const COIN_SPOTS: Point2[] = [
  { x: -380, y: 220 },
  { x: -120, y: 220 },
  { x: 140, y: 220 },
  { x: 380, y: 220 },
  { x: -300, y: 100 },
  { x: -220, y: 100 },
  { x: -20, y: -40 },
  { x: 60, y: -40 },
  { x: 220, y: -180 },
  { x: 300, y: -180 },
];
const coinsLevel: LevelJson = { entities: COIN_SPOTS.map(position => ({ class: 'Coin', position })) };

type GameMessage = { type: 'coin'; by: string } | { type: 'round'; round: number; winner: string };
type JoinState = { round: number; scores: Record<string, number> };

/** a stable, distinct color per peer id - each peer paints its own capsule with it */
const colorOf = (peerId: string) => {
  let h = 0;
  for (const ch of peerId) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  const hue = h % 360;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (0.55 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
};

const world: TypedGg2dWorld<PixiGgWorld, Rapier2dGgWorld> = new Gg2dWorld({
  visualScene: new PixiSceneComponent(),
  physicsWorld: new Rapier2dWorldComponent(),
});

world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(new PixiCameraComponent(), canvas);
  renderer.rendererSize$.subscribe(newSize => {
    if (!newSize) return;
    renderer.camera.zoom = Math.min(newSize.x / (ROOM_WIDTH + 100), newSize.y / (ROOM_HEIGHT + 100), 1);
  });

  // --- room: from the URL, or a fresh one put into the URL so the address bar is the invite link
  let roomId = getRoomIdFromUrl();
  if (!roomId) {
    roomId = generateRoomId();
    history.replaceState(null, '', buildRoomUrl(roomId));
  }
  const config = FIREBASE_CONFIG ?? DEFAULT_FIREBASE_CONFIG;
  const signaling = config ? new FirebaseSignaling({ config }) : new BroadcastChannelSignaling();
  const net = new Network2dController({ transport: new WebRtcMeshTransport({ signaling, roomId }) });
  world.addEntity(net);
  const me = net.localPeerId;

  // --- game state: scores live on every peer; late joiners get them through join state
  let round = 0;
  let scores: Record<string, number> = {};
  let coinsGroup: GroupEntity | null = null;
  let connecting = true;
  net.joinState = (): JoinState => ({ round, scores });

  const score = (by: string) => {
    scores[by] = (scores[by] ?? 0) + 1;
    renderScores();
    if (by === me && scores[me] >= COINS_TO_WIN) {
      net.send({ type: 'round', round: round + 1, winner: me } as GameMessage);
      void startRound(round + 1, me);
    }
  };

  // The coin class: a trigger with a sprite. Every peer sees every character touch every coin, but
  // only the touching character's owner has authority over that event: it removes the coin for
  // everyone (`net.despawn`) and tells everyone who scored.
  world.loader.registerClass('Coin', (w: typeof world, settings: { position: Point2 }) => {
    const coin = new Trigger2dEntity(
      w.physicsWorld!.factory.createTrigger({ shape: 'CIRCLE', radius: COIN_RADIUS }, { position: settings.position }),
    );
    coin.position = settings.position;
    const sprite = new Entity2d({ object2D: w.visualScene!.factory.createCircle(COIN_RADIUS, { color: 0xffd166 }) });
    sprite.position = settings.position;
    coin.addChildren(sprite);
    coin.onEntityEntered.subscribe(entity => {
      if (!coin.world || !(entity instanceof CharacterController2dEntity)) return;
      if (!net.hasAuthority(coin, 'onEntityEntered', entity)) return;
      net.despawn(coin);
      net.send({ type: 'coin', by: me } as GameMessage);
      score(me);
    });
    return coin;
  });

  const loadCoins = async (r: number) => {
    if (coinsGroup) {
      world.removeEntity(coinsGroup, true); // a local unload: every peer swaps rounds itself
    }
    coinsGroup = await net.loadSharedLevel(coinsLevel, `coins-${r}`, 'coins.json');
  };

  const startRound = async (r: number, winner: string) => {
    if (r <= round) return; // both finalists may announce the same new round
    round = r;
    scores = {};
    renderScores();
    showBanner(winner === me ? 'You win!' : `${winner} wins!`);
    await loadCoins(r);
  };

  net.appMessages$.subscribe(({ data }) => {
    const msg = data as GameMessage;
    if (msg.type === 'coin') {
      score(msg.by);
    } else if (msg.type === 'round') {
      void startRound(msg.round, msg.winner);
    }
  });
  net.peers$.subscribe(() => renderScores());

  // --- join: the arena first, so the room can check we all play the same level
  await net.loadSharedLevel(arena, 'arena', 'arena.json');
  let joined: JoinState | null = null;
  net.joinState$.subscribe(s => (joined = s as JoinState));
  renderRoom();
  await net.connect();
  connecting = false;
  if (joined) {
    round = (joined as JoinState).round;
    scores = (joined as JoinState).scores;
  }
  await loadCoins(round);

  // --- my character: a runtime spawn (appears on every peer), possessed by me
  const player = (await world.loader.createEntity({
    class: 'Player',
    name: `Player_${me}`,
    position: { x: -ROOM_WIDTH / 2 + 100 + Math.random() * (ROOM_WIDTH - 200), y: ROOM_HEIGHT / 2 - WALL - 60 },
    config: {
      radius: 20,
      centersDistance: 40,
      maxStepHeight: 12,
      walkSpeed: 260,
      runSpeedMultiplier: 1.8,
      jumpSpeed: 780,
      // pixel-scale fall acceleration (the world's own 9.82 default is meter-scale)
      gravity: 2000,
      airControlFactor: 0.4,
      display: { color: colorOf(me) },
    },
  })) as CharacterController2dEntity;
  world.addEntity(player);
  net.possess(player);
  world.addEntity(new PlayerCharacterController2d(world.keyboardInput, player, renderer, { lookAheadDistance: 120 }));

  renderRoom();
  renderScores();
  world.start();

  // --- HUD
  function renderRoom() {
    const el = document.getElementById('room')!;
    const url = buildRoomUrl(roomId!);
    const players = net.peerInfos.length + 1;
    el.innerHTML = '';
    const label = document.createElement('span');
    label.textContent = connecting
      ? 'connecting...'
      : `ROOM - ${players} player${players > 1 ? 's' : ''} (${config ? 'Firebase' : 'local tabs'} signaling)`;
    const link = document.createElement('input');
    link.readOnly = true;
    link.value = url;
    link.onfocus = () => link.select();
    const copy = document.createElement('button');
    copy.textContent = 'Copy invite link';
    copy.onclick = () => navigator.clipboard.writeText(url).then(() => (copy.textContent = 'Copied'));
    el.append(label, link, copy);
  }

  function renderScores() {
    const el = document.getElementById('scores');
    if (!el) return;
    const ids = [me, ...net.peerInfos.map(p => p.peerId)];
    el.innerHTML =
      `<div>COIN RUN - first to ${COINS_TO_WIN} (round ${round + 1})</div>` +
      ids
        .map(id => {
          const color = '#' + colorOf(id).toString(16).padStart(6, '0');
          return `<div><span style="color:${color}">&#9632;</span> ${id === me ? 'you' : id}: ${scores[id] ?? 0}</div>`;
        })
        .join('') +
      `<div style="margin-top:0.5rem">Arrows/WASD to move, Shift to run, Space to jump</div>`;
    renderRoom();
  }

  function showBanner(text: string) {
    const el = document.getElementById('banner')!;
    el.textContent = text;
    el.style.display = 'flex';
    setTimeout(() => (el.style.display = 'none'), 2000);
  }
});
