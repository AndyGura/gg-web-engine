import {
  CharacterAnimation2dController,
  CharacterController2dEntity,
  CharacterState2d,
  DisplayObject2dOpts,
  Entity2d,
  Gg2dWorld,
  GgStatic,
  GroupEntity,
  IEntity,
  LevelJson,
  PlayerCharacterController2d,
  Point2,
  TickOrder,
  Trigger2dEntity,
  TypedGg2dWorld,
} from '@gg-web-engine/core';
import { PixiCameraComponent, PixiDisplayObjectComponent, PixiGgWorld, PixiSceneComponent } from '@gg-web-engine/pixi';
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
import { Assets, Graphics, Text, Texture } from 'pixi.js';

// Coin run: every peer runs its own character around one shared platformer level. A lone player
// waits (and can warm up); once a second player joins, rounds start: a countdown, then a race for
// the coins - first to COINS_TO_WIN wins, or, when the coins run out (or the clock does), whoever
// collected the most (on a draw, whoever got to that count first).
//
// Signaling: set FIREBASE_CONFIG to your own Firebase project (or leave `null` for the package's
// default project). With neither configured, rooms use BroadcastChannel signaling, which connects
// tabs of this one browser - open the room link in a second tab to play against yourself.
const FIREBASE_CONFIG: FirebaseOptions | null = null;

const characterAtlasUrl = '/assets/characters/character-atlas.png';

const COINS_TO_WIN = 6;
const COUNTDOWN_MS = 3000;
const ROUND_MS = 60000;
const RESULTS_MS = 5000;
const COIN_RADIUS = 12;
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
// and static bodies don't even have any). Four tiers of platforms, each one a jump above the last.
const arena: LevelJson = {
  entities: [
    box('Floor', 0, ROOM_HEIGHT / 2 - WALL / 2, ROOM_WIDTH, WALL, 0x4a4e69),
    box('Ceiling', 0, -(ROOM_HEIGHT / 2 - WALL / 2), ROOM_WIDTH, WALL, 0x22223b),
    box('WallLeft', -(ROOM_WIDTH / 2 - WALL / 2), 0, WALL, ROOM_HEIGHT, 0x22223b),
    box('WallRight', ROOM_WIDTH / 2 - WALL / 2, 0, WALL, ROOM_HEIGHT, 0x22223b),
    box('LedgeLowLeft', -300, 150, 160, 24, 0x9a8c98),
    box('LedgeLowRight', 300, 150, 160, 24, 0x9a8c98),
    box('Bridge', 0, 40, 220, 24, 0x9a8c98),
    box('LedgeHighLeft', -260, -70, 140, 24, 0x9a8c98),
    box('LedgeHighRight', 260, -70, 140, 24, 0x9a8c98),
    box('Summit', 0, -150, 120, 24, 0xc9ada7),
  ],
};

// One set of coins per round, loaded as shared level "coins-<round>": the round number makes every
// coin's name (its network id) fresh each round, so a coin despawned last round stays gone without
// blocking this round's coin at the same spot.
const COIN_SPOTS: Point2[] = [
  // floor
  { x: -370, y: 232 },
  { x: -150, y: 232 },
  { x: 0, y: 232 },
  { x: 150, y: 232 },
  { x: 370, y: 232 },
  // low ledges
  { x: -340, y: 110 },
  { x: -260, y: 110 },
  { x: 260, y: 110 },
  { x: 340, y: 110 },
  // bridge
  { x: -60, y: 0 },
  { x: 60, y: 0 },
  // high ledges
  { x: -290, y: -110 },
  { x: -230, y: -110 },
  { x: 230, y: -110 },
  { x: 290, y: -110 },
  // summit - the lonely one at the top
  { x: 0, y: -190 },
];
const coinsLevel: LevelJson = { entities: COIN_SPOTS.map(position => ({ class: 'Coin', position })) };

// --- round state machine
//
// Every peer keeps the full round state; the "director" (the lexically smallest active peer id, so
// every peer agrees without asking) is the only one deciding phase changes and broadcasts them. If
// the director leaves, the next one simply carries on from its own copy of the state.
type Phase = 'waiting' | 'countdown' | 'playing' | 'results';
type WinReason = 'target' | 'cleared' | 'time';
type RoundResult = { winner: string | null; reason: WinReason; tie: boolean; scores: Record<string, number> };
type PhaseChange = {
  /** monotonic version of the state machine: a change applies only if it is newer */
  seq: number;
  round: number;
  phase: Phase;
  msLeft: number;
  result: RoundResult | null;
  cancelled?: boolean;
};
type GameMessage = ({ type: 'phase' } & PhaseChange) | { type: 'coin'; round: number; by: string; at: Point2 };
type JoinState = PhaseChange & { scores: Record<string, number> };

/** a stable hash of a peer id - picks its color and its name */
const hashOf = (peerId: string) => {
  let h = 0;
  for (const ch of peerId) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
};

/** a stable, distinct color per peer id - each peer paints its own capsule with it */
const colorOf = (peerId: string) => {
  const hue = hashOf(peerId) % 360;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (0.55 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
};
/** a player color mixed halfway to white - a tint that keeps the sprite's own shading readable */
const pastel = (color: number) =>
  (((((color >> 16) & 0xff) + 255) >> 1) << 16) |
  (((((color >> 8) & 0xff) + 255) >> 1) << 8) |
  (((color & 0xff) + 255) >> 1);
const cssColorOf = (peerId: string) => '#' + colorOf(peerId).toString(16).padStart(6, '0');

const ADJECTIVES = ['Swift', 'Lucky', 'Sneaky', 'Jolly', 'Brave', 'Fuzzy', 'Zippy', 'Mighty', 'Sleepy', 'Cosmic'];
const ANIMALS = ['Fox', 'Otter', 'Panda', 'Gecko', 'Moose', 'Llama', 'Badger', 'Koala', 'Penguin', 'Yak'];
/** a friendlier display name than the raw peer id */
const nameOf = (peerId: string) => {
  const h = hashOf(peerId);
  return `${ADJECTIVES[h % ADJECTIVES.length]} ${ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length]}`;
};

const CHARACTER_PREFIX = 'Player_';
/** whose character this is - characters are named after the peer that spawned them */
const peerOf = (entity: IEntity) =>
  entity instanceof CharacterController2dEntity && entity.name.startsWith(CHARACTER_PREFIX)
    ? entity.name.slice(CHARACTER_PREFIX.length)
    : null;

/** a text sprite in the world - purely local decoration, never networked (it has no body) */
class Label extends Entity2d {
  static readonly entityTypeName: string = 'Label';

  constructor(
    protected readonly text: Text,
    size: number,
  ) {
    super({ object2D: new PixiDisplayObjectComponent(text) });
    text.style = {
      fontFamily: 'monospace',
      fontSize: size,
      fontWeight: 'bold',
      fill: '#ffffff',
      stroke: { color: '#000000', width: 4 },
    };
    text.anchor.set(0.5, 1);
  }
}

/** a name above a character, following it - ticks right after the characters have moved */
class NameTag extends Label {
  static readonly entityTypeName: string = 'NameTag';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING + 1;

  constructor(target: CharacterController2dEntity, label: (target: CharacterController2dEntity) => string) {
    super(new Text({ text: '' }), 13);
    this.tick$.subscribe(() => {
      // a remote character gets its final name only after it was added - so re-read it
      const text = label(target);
      if (this.text.text !== text) {
        this.text.text = text;
        const peer = peerOf(target);
        this.text.style.fill = peer ? cssColorOf(peer) : '#ffffff';
      }
      this.position = { x: target.position.x, y: target.position.y - 50 };
    });
  }
}

/** a "+1" floating up from a collected coin and fading away */
class PopText extends Label {
  static readonly entityTypeName: string = 'PopText';

  constructor(text: string, color: string, from: Point2) {
    super(new Text({ text }), 20);
    this.text.style.fill = color;
    this.position = from;
    let age = 0;
    this.tick$.subscribe(([, delta]) => {
      age += delta;
      const t = Math.min(age / 800, 1);
      this.position = { x: from.x, y: from.y - 50 * t };
      this.text.alpha = 1 - t * t;
      if (t === 1 && this.world) {
        // not mid-tick: removing an entity while the world iterates its tick listeners skips one
        const world = this.world;
        queueMicrotask(() => this.world === world && world.removeEntity(this, true));
      }
    });
  }
}

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

  // --- game state: every peer holds all of it; late joiners get it through join state
  const state: PhaseChange & { by: string; endsAt: number } = {
    seq: 0,
    by: me,
    round: 0,
    phase: 'waiting',
    msLeft: 0,
    endsAt: 0,
    result: null,
  };
  let scores: Record<string, number> = {};
  /** when each player's score last went up (a local pickup counter) - breaks draws */
  let reachedAt: Record<string, number> = {};
  let pickups = 0;
  let connected = false;
  let flash: { title: string; subtitle: string; until: number } | null = null;
  net.joinState = (): JoinState => ({ ...snapshot(), scores });

  const snapshot = (): PhaseChange => ({
    seq: state.seq,
    round: state.round,
    phase: state.phase,
    msLeft: Math.max(0, state.endsAt - performance.now()),
    result: state.result,
  });
  /** everyone in the room, and the ones actually able to play (a hidden tab is "away") */
  const allPlayers = () => [me, ...net.peerInfos.map(p => p.peerId)];
  const activePlayers = () => [me, ...net.peerInfos.filter(p => !p.away).map(p => p.peerId)];
  const isDirector = () => net.sessionState === 'joined' && [...activePlayers()].sort()[0] === me;
  const coinsLeft = () => COIN_SPOTS.length - Object.values(scores).reduce((a, b) => a + b, 0);

  const applyPhase = (change: PhaseChange, from: string) => {
    // newer wins; two directors announcing at once (a moment of disagreement on who's director)
    // settle on the smaller peer id, the same everywhere
    if (change.seq < state.seq || (change.seq === state.seq && from >= state.by)) return;
    const previous = state.phase;
    const { seq, round, phase, msLeft, result } = change;
    Object.assign(state, { seq, round, phase, msLeft, result, by: from, endsAt: performance.now() + msLeft });
    if (change.phase === 'countdown' || change.phase === 'waiting') {
      scores = {};
      reachedAt = {};
    }
    if (change.phase === 'results' && change.result) {
      scores = { ...change.result.scores }; // the director's tally is the one everybody shows
    }
    if (change.phase === 'playing' && previous === 'countdown') {
      showFlash('GO!', 'Grab the coins!', 900);
    }
    if (change.cancelled) {
      showFlash('Round cancelled', 'not enough players left', 2000);
    }
    void syncCoins();
    renderHud();
  };

  const announce = (change: Omit<PhaseChange, 'seq'>) => {
    const next: PhaseChange = { ...change, seq: state.seq + 1 };
    net.send({ type: 'phase', ...next } as GameMessage);
    applyPhase(next, me);
  };

  const decide = (reason: WinReason): RoundResult => {
    const present = new Set(allPlayers());
    const ranked = Object.keys(scores)
      .filter(id => present.has(id) && scores[id] > 0)
      .sort((a, b) => scores[b] - scores[a] || (reachedAt[a] ?? 0) - (reachedAt[b] ?? 0));
    const winner = ranked[0] ?? null;
    const tie = winner !== null && ranked.length > 1 && scores[ranked[1]] === scores[winner];
    return { winner, reason, tie, scores: { ...scores } };
  };

  /** the director's decisions - runs a few times a second, and right after every pickup */
  const direct = () => {
    if (!connected || !isDirector()) return;
    const enough = activePlayers().length >= 2;
    const timeUp = performance.now() >= state.endsAt;
    const next = { round: state.round, msLeft: 0, result: null };
    switch (state.phase) {
      case 'waiting':
        if (enough) announce({ ...next, round: state.round + 1, phase: 'countdown', msLeft: COUNTDOWN_MS });
        break;
      case 'countdown':
        if (!enough) announce({ ...next, phase: 'waiting', cancelled: true });
        else if (timeUp) announce({ ...next, phase: 'playing', msLeft: ROUND_MS });
        break;
      case 'playing': {
        if (!enough) {
          announce({ ...next, phase: 'waiting', cancelled: true });
          break;
        }
        const reason: WinReason | null = Object.values(scores).some(s => s >= COINS_TO_WIN)
          ? 'target'
          : coinsLeft() <= 0
            ? 'cleared'
            : timeUp
              ? 'time'
              : null;
        if (reason) announce({ ...next, phase: 'results', msLeft: RESULTS_MS, result: decide(reason) });
        break;
      }
      case 'results':
        if (timeUp) {
          announce(
            enough
              ? { ...next, round: state.round + 1, phase: 'countdown', msLeft: COUNTDOWN_MS }
              : { ...next, phase: 'waiting' },
          );
        }
        break;
    }
  };

  const onCoin = (round: number, by: string, at: Point2) => {
    // a pickup can race the director's "playing" by a few ms, hence countdown too
    if (round !== state.round || (state.phase !== 'playing' && state.phase !== 'countdown')) return;
    scores[by] = (scores[by] ?? 0) + 1;
    reachedAt[by] = ++pickups;
    world.addEntity(new PopText('+1', cssColorOf(by), at));
    renderHud();
    direct();
  };

  // The coin class: a spinning sprite over a trigger. Every peer sees every character touch every
  // coin, but only the touching character's owner has authority over that event: it removes the
  // coin for everyone (`net.despawn`) and tells everyone who scored.
  world.loader.registerClass('Coin', (w: typeof world, settings: { position: Point2 }) => {
    const { x, y } = settings.position;
    const coin = new Trigger2dEntity(
      w.physicsWorld!.factory.createTrigger({ shape: 'CIRCLE', radius: COIN_RADIUS }, { position: settings.position }),
    );
    coin.position = settings.position;
    const disc = new Graphics()
      .circle(0, 0, COIN_RADIUS)
      .fill(0xffd166)
      .stroke({ width: 3, color: 0xd99a00 })
      .rect(-2, -COIN_RADIUS / 2, 4, COIN_RADIUS)
      .fill(0xd99a00);
    const sprite = new Entity2d({ object2D: new PixiDisplayObjectComponent(disc) });
    sprite.position = settings.position;
    sprite.tick$.subscribe(([elapsed]) => {
      // spin by squashing horizontally, bob a little - offset by position so coins aren't in sync
      disc.scale.x = Math.cos(elapsed / 300 + x / 50);
      sprite.position = { x, y: y + Math.sin(elapsed / 400 + x / 80) * 3 };
    });
    coin.addChildren(sprite);
    coin.onEntityEntered.subscribe(entity => {
      const by = entity ? peerOf(entity) : null;
      if (!coin.world || !by || state.phase !== 'playing') return;
      if (!net.hasAuthority(coin, 'onEntityEntered', entity)) return;
      net.despawn(coin);
      net.send({ type: 'coin', round: state.round, by, at: settings.position } as GameMessage);
      onCoin(state.round, by, settings.position);
    });
    return coin;
  });

  // The character class: the shared pixel-art atlas (idle/walk/run/jump/crouch rows on a uniform grid
  // - see ../assets/characters/generate-character-atlas.py), tinted with its player's color. Every
  // peer builds every character through this class: the network rebuilds a remote player's
  // character from its serialized config (options, `display` and the mid-jump `state`), so all of
  // that has to go through `settings`.
  const atlas: Texture = await Assets.load(characterAtlasUrl);
  atlas.source.scaleMode = 'nearest'; // keep the pixel-art look crisp when scaled up
  type RunnerSettings = Partial<ConstructorParameters<typeof CharacterController2dEntity>[0]> & {
    position?: Point2;
    display?: DisplayObject2dOpts<Texture>;
    state?: CharacterState2d;
  };
  world.loader.registerClass('Runner', (w: typeof world, settings: RunnerSettings) => {
    const { position, display, state, radius = 20, centersDistance = 40, ...options } = settings;
    const sprite = w.visualScene!.factory.createAnimatedSprite(atlas, {
      frameWidth: 48,
      frameHeight: 72,
      clips: {
        idle: { row: 0, frameCount: 4, fps: 6 },
        walk: { row: 1, frameCount: 6, fps: 10 },
        run: { row: 2, frameCount: 6, fps: 14 },
        jump: { row: 3, frameCount: 6, fps: 10 },
        crouch: { row: 4, frameCount: 4, fps: 6 },
      },
    });
    sprite.scale = { x: 1.2, y: 1.2 };
    if (display?.color !== undefined) {
      sprite.nativeSprite.tint = pastel(display.color);
    }
    const controller = w.physicsWorld!.factory.createCharacterController(
      { radius, centersDistance, ...(options.maxStepHeight !== undefined && { maxStepHeight: options.maxStepHeight }) },
      { position },
    );
    const character = new CharacterController2dEntity({ radius, centersDistance, ...options }, sprite, controller);
    if (position) character.position = position;
    if (display) character.displaySettings = display; // serialized back, so remote copies get the tint too
    if (state) character.applyState(state);
    // a child entity: removed together with the character, and never networked on its own
    character.addChildren(new CharacterAnimation2dController(character));
    return character;
  });

  // coins exist only while a round is being played; this round's set is loaded, any other removed
  let coins: { round: number; group: GroupEntity } | null = null;
  let loadingCoins = false;
  const syncCoins = async () => {
    const wanted = connected && state.phase === 'playing' ? state.round : null;
    if (coins && coins.round !== wanted) {
      world.removeEntity(coins.group, true); // a local unload: every peer swaps rounds itself
      coins = null;
    }
    if (wanted === null || coins || loadingCoins) return;
    loadingCoins = true;
    const group = await net.loadSharedLevel(coinsLevel, `coins-${wanted}`, 'coins.json');
    loadingCoins = false;
    coins = { round: wanted, group };
    void syncCoins(); // the phase may have moved on while loading
  };

  net.appMessages$.subscribe(({ from, data }) => {
    const msg = data as GameMessage;
    if (msg.type === 'coin') {
      onCoin(msg.round, msg.by, msg.at);
    } else if (msg.type === 'phase') {
      applyPhase(msg, from);
    }
  });
  // on joining (and on returning from a hidden tab), the room's state replaces ours outright
  net.joinState$.subscribe(s => {
    const joined = s as JoinState;
    state.seq = -1; // whatever we had, the room's state is newer
    applyPhase(joined, '');
    scores = { ...joined.scores };
    reachedAt = {};
    renderHud();
  });

  // --- characters: a name tag over each one; a departed player's character is removed by whoever
  // took it over (the peer nearest to it - see the multiplayer package's takeover election)
  const characters = new Map<CharacterController2dEntity, NameTag>();
  const tagLabel = (c: CharacterController2dEntity) => {
    const peer = peerOf(c);
    return peer ? nameOf(peer) + (peer === me ? ' (you)' : '') : '';
  };
  world.entityAdded$.subscribe(entity => {
    if (entity instanceof CharacterController2dEntity && !characters.has(entity)) {
      const tag = new NameTag(entity, tagLabel);
      characters.set(entity, tag);
      world.addEntity(tag);
    }
  });
  world.entityRemoved$.subscribe(entity => {
    const tag = entity instanceof CharacterController2dEntity ? characters.get(entity) : undefined;
    if (tag) {
      characters.delete(entity as CharacterController2dEntity);
      queueMicrotask(() => tag.world && world.removeEntity(tag, true));
    }
  });
  const despawnDepartedCharacters = () => {
    const present = new Set(allPlayers());
    for (const character of characters.keys()) {
      const peer = peerOf(character);
      // a hidden tab's character is taken over too, but its player is still here and comes back:
      // only a character whose player left the room, and which we now own, goes
      if (peer && !present.has(peer) && net.isNetworked(character) && net.isLocallyOwned(character)) {
        net.despawn(character);
      }
    }
  };
  net.peers$.subscribe(() => {
    despawnDepartedCharacters();
    renderHud();
  });
  net.ownershipChanged$.subscribe(() => despawnDepartedCharacters());

  // my character: a runtime spawn (appears on every peer), possessed by me
  let player: CharacterController2dEntity | null = null;
  const spawnMe = async () => {
    player = (await world.loader.createEntity({
      class: 'Runner',
      name: CHARACTER_PREFIX + me,
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
  };
  // back from a hidden tab that long: if the room gave up on us meanwhile, come back in
  net.resynced$.subscribe(() => {
    if (!player?.world) void spawnMe();
  });

  // --- join: the arena first, so the room can check we all play the same level
  await net.loadSharedLevel(arena, 'arena', 'arena.json');
  renderHud();
  await net.connect();
  connected = true;
  await syncCoins();
  await spawnMe();
  world.start();
  setInterval(() => {
    direct();
    renderHud();
  }, 100);

  // --- HUD
  function showFlash(title: string, subtitle: string, ms: number) {
    flash = { title, subtitle, until: performance.now() + ms };
  }

  function renderHud() {
    renderRoom();
    renderScores();
    renderStatus();
  }

  function renderRoom() {
    const el = document.getElementById('room')!;
    const label = `${allPlayers().length} in room · ${config ? 'Firebase' : 'local tabs'} signaling`;
    if (el.dataset.label === label) return; // don't rebuild the input under the user's cursor
    el.dataset.label = label;
    const url = buildRoomUrl(roomId!);
    el.innerHTML = '';
    const caption = document.createElement('span');
    caption.textContent = label;
    const link = document.createElement('input');
    link.readOnly = true;
    link.value = url;
    link.onfocus = () => link.select();
    const copy = document.createElement('button');
    copy.textContent = 'Copy invite link';
    copy.onclick = () => navigator.clipboard.writeText(url).then(() => (copy.textContent = 'Copied!'));
    el.append(caption, link, copy);
  }

  function renderScores() {
    const el = document.getElementById('scores')!;
    const away = new Set(net.peerInfos.filter(p => p.away).map(p => p.peerId));
    const ids = allPlayers().sort(
      (a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || (reachedAt[a] ?? 0) - (reachedAt[b] ?? 0),
    );
    const lead = (scores[ids[0]] ?? 0) > 0 ? ids[0] : null;
    const rows = ids
      .map(id => {
        const name = `${nameOf(id)}${id === me ? ' (you)' : ''}${away.has(id) ? ' - away' : ''}`;
        const points = state.phase === 'waiting' ? '' : `<b>${scores[id] ?? 0}</b>`;
        return (
          `<div class="row${id === lead ? ' lead' : ''}"><span class="dot" style="background:${cssColorOf(id)}"></span>` +
          `<span class="name">${name}</span>${points}</div>`
        );
      })
      .join('');
    el.innerHTML =
      `<div class="title">COIN RUN</div>` +
      `<div class="rule">first to ${COINS_TO_WIN} coins, or most coins at the end</div>` +
      rows +
      `<div class="help">Arrows/WASD move · Shift run · Space jump</div>`;
  }

  function renderStatus() {
    const now = performance.now();
    const left = Math.max(0, state.endsAt - now);
    const seconds = Math.ceil(left / 1000);
    const status = document.getElementById('status')!;
    const banner = document.getElementById('banner')!;
    let title = '';
    let subtitle = '';
    if (!connected) {
      status.textContent = 'Connecting...';
    } else if (state.phase === 'waiting') {
      status.textContent =
        activePlayers().length < 2
          ? 'Waiting for other players... share the invite link - warm up meanwhile!'
          : 'Starting...';
    } else if (state.phase === 'countdown') {
      status.textContent = `Round ${state.round} - get ready`;
      title = String(seconds);
      subtitle = `Round ${state.round}`;
    } else if (state.phase === 'playing') {
      const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      status.innerHTML = `Round ${state.round} &nbsp; <b class="${seconds <= 10 ? 'hurry' : ''}">${clock}</b> &nbsp; ${coinsLeft()} coins left`;
    } else {
      const r = state.result;
      const why = r?.winner
        ? r.reason === 'target'
          ? `first to ${COINS_TO_WIN} coins`
          : `most coins when ${r.reason === 'cleared' ? 'every coin was taken' : 'time ran out'}` +
            (r.tie ? ` - got to ${r.scores[r.winner]} first` : '')
        : 'nobody collected a coin';
      title = !r?.winner ? 'Nobody wins' : r.winner === me ? 'You win!' : `${nameOf(r.winner)} wins!`;
      subtitle = why;
      status.textContent = activePlayers().length >= 2 ? `Next round in ${seconds}...` : 'Waiting for other players...';
    }
    if (flash && now < flash.until) {
      title = flash.title;
      subtitle = flash.subtitle;
    }
    banner.style.display = title ? 'flex' : 'none';
    banner.querySelector('.big')!.textContent = title;
    banner.querySelector('.small')!.textContent = subtitle;
    const winner = state.phase === 'results' ? state.result?.winner : null;
    (banner.querySelector('.big') as HTMLElement).style.color = winner ? cssColorOf(winner) : '';
  }
});
