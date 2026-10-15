import {
  Gg3dWorld,
  Gg3dWorldWithPhysics,
  GgCarEntity,
  GgCarHandlingController,
  GgStatic,
  IEntity,
  LoadingScreen,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Trigger3dEntity,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
import { MobileControls } from '@gg-web-engine/mobile-controls';
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
import { createPhysicsWorld, selectedPhysicsBackend } from './backends';
import { carJson, followWithChaseCamera } from './car';
import { benchSlot, carRotation, CHECKPOINTS, checkpointDistance, gridSlot, poseAt, track } from './track';

// Car race: everyone in the room drives their own car around one shared track, with no game
// server. Open the page, share the link it puts in the address bar, and race: a countdown on the
// starting grid, three laps through every checkpoint in order, first across the line wins.
// Collisions are real: every car and wall is in one shared physics world.
//
// A race starts on its own once two players are in the room; alone, press Enter for a solo time
// trial. Players who join mid-race wait in the infield for the next one.
//
// Signaling (how peers find each other before talking directly over WebRTC) is Firebase, on the
// engine maintainer's shared public project by default (`new FirebaseSignaling({ config })` takes
// your own). `?local` in the URL switches to BroadcastChannel, which connects tabs of one browser:
// open the room link in a second tab to race against yourself with no network.

const LAPS = 3;
const COUNTDOWN_MS = 4000;
const RACE_MS = 5 * 60_000; // a race ends after this long even if not everyone finished
const FINISH_GRACE_MS = 30_000; // once the winner is in, the rest have this long to finish
const RESULTS_MS = 8000;

GgStatic.instance.devConsoleEnabled = true;

// --- race state machine
//
// Every peer keeps the full race state. The "director" (the lexically smallest active peer id, so
// every peer agrees without asking) is the only one deciding phase changes, and broadcasts them. If
// the director leaves, the next one carries on from its own copy of the state. Each player counts
// its own car's checkpoints and broadcasts its progress.
type Phase = 'waiting' | 'countdown' | 'racing' | 'results';
type Standing = { by: string; passed: number; timeMs: number | null };
type PhaseChange = {
  /** monotonic version of the state machine: a change applies only if it is newer */
  seq: number;
  race: number;
  phase: Phase;
  msLeft: number;
  /** who lined up on the grid for this race, in grid order */
  racers: string[];
  result: Standing[] | null;
  cancelled?: boolean;
};
/** a player's progress in the current race: gates passed so far, and when the last one was */
type Progress = { passed: number; at: number; finishMs: number | null };
type GameMessage =
  ({ type: 'phase' } & PhaseChange) | ({ type: 'progress'; race: number; by: string } & Progress) | { type: 'start' };
type JoinState = PhaseChange & { progress: Record<string, Progress> };

/** a stable hash of a peer id - picks its color and its name */
const hashOf = (peerId: string) => {
  let h = 0;
  for (const ch of peerId) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
};
/** a stable, distinct color per peer id: its car's paint */
const colorOf = (peerId: string) => {
  const hue = hashOf(peerId) % 360;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (0.5 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
};
const cssColorOf = (peerId: string) => '#' + colorOf(peerId).toString(16).padStart(6, '0');
const ADJECTIVES = ['Swift', 'Lucky', 'Sneaky', 'Jolly', 'Brave', 'Fuzzy', 'Zippy', 'Mighty', 'Sleepy', 'Cosmic'];
const ANIMALS = ['Fox', 'Otter', 'Panda', 'Gecko', 'Moose', 'Llama', 'Badger', 'Koala', 'Penguin', 'Yak'];
/** a friendlier display name than the raw peer id */
const nameOf = (peerId: string) => {
  const h = hashOf(peerId);
  return `${ADJECTIVES[h % ADJECTIVES.length]} ${ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length]}`;
};

const CAR_PREFIX = 'Car_';
/** whose car this is - cars are named after the peer that spawned them */
const peerOf = (entity: IEntity) =>
  entity instanceof GgCarEntity && entity.name.startsWith(CAR_PREFIX) ? entity.name.slice(CAR_PREFIX.length) : null;

const formatTime = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};
/** the lap a player is on, counting the first crossing of the line as the start of lap 1 */
const lapOf = (passed: number) => Math.min(LAPS, Math.max(1, Math.floor((passed - 1) / CHECKPOINTS) + 1));
/** the gates a car passes in a whole race: every gate LAPS times, then the line once more */
const GATES_TO_FINISH = LAPS * CHECKPOINTS + 1;

/**
 * The room's invite link. It names the physics engine too: every peer of a room has to simulate
 * with the same one, so a link opened elsewhere must not fall back to another default.
 */
function inviteUrl(roomId: string): string {
  const url = new URL(buildRoomUrl(roomId));
  url.searchParams.set('physics', selectedPhysicsBackend());
  return url.toString();
}

// the engine's loading screen, up until the game runs (hidden after world.start() below)
const loading = LoadingScreen.show();

// three.js renders, the physics engine is picked by `?physics=` (see backends.ts); everyone in a
// room uses the one its invite link names
const world: Gg3dWorldWithPhysics<ThreeGgWorld> = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
});
await world.init();
const canvas = document.getElementById('gg') as HTMLCanvasElement;
const renderer = world.addRenderer(world.visualScene.factory.createPerspectiveCamera({ fov: 65 }), canvas);
renderer.position = { x: -20, y: -110, z: 60 };
renderer.rotation = Qtrn.lookAt(renderer.position, Pnt3.O);
// on a phone: a steering stick and pedals for the car's handling controller
world.addEntity(new MobileControls());

// --- room: from the URL, or a fresh one put into the URL so the address bar is the invite link
const local = new URLSearchParams(location.search).has('local');
const signaling: ISignalingChannel = local ? new BroadcastChannelSignaling() : new FirebaseSignaling();
const roomId = getRoomIdFromUrl() ?? generateRoomId();
history.replaceState(null, '', inviteUrl(roomId));
const net = new Network3dController({ transport: new WebRtcMeshTransport({ signaling, roomId }) });
world.addEntity(net);
const me = net.localPeerId;

// --- game state: every peer holds all of it; late joiners get it through join state
const state: PhaseChange & { by: string; endsAt: number; goAt: number } = {
  seq: 0,
  by: me,
  race: 0,
  phase: 'waiting',
  msLeft: 0,
  endsAt: 0,
  goAt: 0,
  racers: [],
  result: null,
};
let progress: Record<string, Progress> = {};
/** when this peer first saw somebody finish the current race (starts the grace period) */
let firstFinishSeenAt: number | null = null;
let startRequested = false;
let connected = false;
let flash: { title: string; subtitle: string; until: number } | null = null;
let lapStartedAt: number | null = null;
let lastLapMs: number | null = null;
let bestLapMs: number | null = null;

const snapshot = (): PhaseChange => ({
  seq: state.seq,
  race: state.race,
  phase: state.phase,
  msLeft: Math.max(0, state.endsAt - performance.now()),
  racers: state.racers,
  result: state.result,
});
net.joinState = (): JoinState => ({ ...snapshot(), progress });

/** everyone in the room, and the ones actually able to play (a hidden tab is "away") */
const allPlayers = () => [me, ...net.peerInfos.map(p => p.peerId)];
const activePlayers = () => [me, ...net.peerInfos.filter(p => !p.away).map(p => p.peerId)];
const isDirector = () => net.sessionState === 'joined' && [...activePlayers()].sort()[0] === me;
const amRacing = () => (state.phase === 'countdown' || state.phase === 'racing') && state.racers.includes(me);
const raceClock = () => performance.now() - state.goAt;

/** the racers of the current race, best first: finished by time, the rest by how far they got */
const standings = (): Standing[] =>
  state.racers
    .map(by => ({
      by,
      passed: progress[by]?.passed ?? 0,
      timeMs: progress[by]?.finishMs ?? null,
      at: progress[by]?.at ?? 0,
    }))
    .sort((a, b) =>
      a.timeMs !== null || b.timeMs !== null
        ? (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity)
        : b.passed - a.passed || a.at - b.at,
    )
    .map(({ by, passed, timeMs }) => ({ by, passed, timeMs }));

const applyPhase = (change: PhaseChange, from: string) => {
  // newer wins; two directors announcing at once settle on the smaller peer id, the same everywhere
  if (change.seq < state.seq || (change.seq === state.seq && from >= state.by)) return;
  const previous = state.phase;
  const { seq, race, phase, msLeft, racers, result } = change;
  const now = performance.now();
  Object.assign(state, { seq, race, phase, msLeft, racers, result, by: from, endsAt: now + msLeft });
  if (phase === 'countdown') {
    progress = {};
    firstFinishSeenAt = null;
    lapStartedAt = null;
    lastLapMs = null;
  }
  if (phase === 'racing') {
    state.goAt = now - (RACE_MS - msLeft); // a late joiner's clock runs from the same start
    if (previous === 'countdown') showFlash('GO!', `${LAPS} laps`, 900);
  }
  if (change.cancelled) {
    showFlash('Race cancelled', 'everyone on the grid left', 2000);
  }
  placeCarForPhase(previous);
  renderHud();
};

const announce = (change: Omit<PhaseChange, 'seq'>) => {
  const next: PhaseChange = { ...change, seq: state.seq + 1 };
  net.send({ type: 'phase', ...next } as GameMessage);
  applyPhase(next, me);
};

/** the director's decisions - runs a few times a second */
const direct = () => {
  if (!connected || !isDirector()) return;
  const now = performance.now();
  const timeUp = now >= state.endsAt;
  const present = new Set(allPlayers());
  const onGrid = state.racers.filter(id => present.has(id));
  const next = { race: state.race, racers: state.racers, msLeft: 0, result: null };
  switch (state.phase) {
    case 'waiting':
      if (activePlayers().length >= 2 || startRequested) {
        startRequested = false;
        const racers = [...activePlayers()].sort();
        announce({ ...next, race: state.race + 1, racers, phase: 'countdown', msLeft: COUNTDOWN_MS });
      }
      break;
    case 'countdown':
      if (onGrid.length === 0) announce({ ...next, racers: [], phase: 'waiting', cancelled: true });
      else if (timeUp) announce({ ...next, phase: 'racing', msLeft: RACE_MS });
      break;
    case 'racing': {
      if (onGrid.length === 0) {
        announce({ ...next, racers: [], phase: 'waiting', cancelled: true });
        break;
      }
      const allFinished = onGrid.every(id => progress[id]?.finishMs != null);
      const graceOver = firstFinishSeenAt !== null && now - firstFinishSeenAt >= FINISH_GRACE_MS;
      if (allFinished || graceOver || timeUp) {
        announce({ ...next, phase: 'results', msLeft: RESULTS_MS, result: standings() });
      }
      break;
    }
    case 'results':
      if (timeUp) announce({ ...next, racers: [], phase: 'waiting' });
      break;
  }
};

const onProgress = (race: number, by: string, p: Progress) => {
  if (race !== state.race || state.phase !== 'racing') return;
  progress[by] = p;
  if (p.finishMs !== null && firstFinishSeenAt === null) firstFinishSeenAt = performance.now();
  renderHud();
};

net.appMessages$.subscribe(({ from, data }) => {
  const msg = data as GameMessage;
  if (msg.type === 'phase') applyPhase(msg, from);
  else if (msg.type === 'progress') onProgress(msg.race, msg.by, msg);
  else if (msg.type === 'start') startRequested = true;
});
// on joining (and on returning from a hidden tab), the room's state replaces ours outright
net.joinState$.subscribe(s => {
  const joined = s as JoinState;
  state.seq = -1; // whatever we had, the room's state is newer
  applyPhase(joined, '');
  progress = { ...joined.progress };
  renderHud();
});

// --- the track: shared content, built by every peer itself; the room checks we all have the same
const trackGroup = await net.loadSharedLevel(track, 'track', 'track-v1');

// A checkpoint counts only for this peer's own car, and only the next one in order. Each player
// counts their own laps and tells the others.
let car: GgCarEntity | null = null;
const isMyCar = (entity: IEntity | null) => !!car && (entity === car || entity === car.raycastVehicle);
for (let gate = 0; gate < CHECKPOINTS; gate++) {
  const trigger = trackGroup.getChildEntityByName<Trigger3dEntity>(`Checkpoint_${gate}`);
  trigger.onEntityEntered.subscribe(entity => {
    if (!isMyCar(entity) || state.phase !== 'racing' || !state.racers.includes(me)) return;
    const mine = progress[me] ?? { passed: 0, at: 0, finishMs: null };
    if (mine.finishMs !== null || gate !== mine.passed % CHECKPOINTS) return;
    const at = raceClock();
    const passed = mine.passed + 1;
    if (gate === 0) {
      if (lapStartedAt !== null) {
        lastLapMs = at - lapStartedAt;
        bestLapMs = bestLapMs === null ? lastLapMs : Math.min(bestLapMs, lastLapMs);
        showFlash(passed === GATES_TO_FINISH ? 'FINISH!' : `Lap ${lapOf(passed)}`, formatTime(lastLapMs), 1500);
      }
      lapStartedAt = at;
    }
    const update: Progress = { passed, at, finishMs: passed === GATES_TO_FINISH ? at : null };
    net.send({ type: 'progress', race: state.race, by: me, ...update } as GameMessage);
    onProgress(state.race, me, update);
  });
}

// --- cars: a departed player's car is removed by whoever took it over
const despawnDepartedCars = () => {
  const present = new Set(allPlayers());
  // a copy: despawning removes the car from world.children while the loop runs
  for (const entity of [...world.children]) {
    const peer = peerOf(entity);
    // a hidden tab's car is taken over too, but its player is still here and comes back: only a car
    // whose player left the room, and which we now own, goes
    if (peer && !present.has(peer) && net.isNetworked(entity) && net.isLocallyOwned(entity)) {
      net.despawn(entity);
    }
  }
};
net.peers$.subscribe(() => {
  despawnDepartedCars();
  renderHud();
});
net.ownershipChanged$.subscribe(despawnDepartedCars);

// my car: a runtime spawn (it appears on every peer), possessed by me so my input and state win
const driving = new GgCarHandlingController(world.keyboardInput, null, {
  keymap: 'wasd+arrows',
  maxSteerDeltaPerSecond: 6,
  gearUpDownKeys: ['KeyE', 'KeyQ'],
  autoReverse: true,
  neutralGear: false,
  handbrakeKey: 'Space',
});
driving.switchingGearsEnabled = false; // automatic gearbox
world.addEntity(driving);
let stopFollowing: (() => void) | null = null;

const spawnMe = async () => {
  const spot = freeGridSlot();
  const spawned = await world.loader.createEntity(carJson(CAR_PREFIX + me, spot.position, spot.rotation, colorOf(me)));
  if (!(spawned instanceof GgCarEntity)) throw new Error('The "GgCar" level class did not build a GgCarEntity');
  car = spawned;
  world.addEntity(car);
  net.possess(car);
  net.localPosition = () => car?.position ?? Pnt3.O; // where this player is, for ownership hand-offs
  stopFollowing?.();
  stopFollowing = followWithChaseCamera(renderer, car);
  placeCarForPhase('waiting'); // as if the current phase just began: on the grid, benched or free
};
// back from a hidden tab that long: if the room gave up on us meanwhile, come back in
net.resynced$.subscribe(() => {
  if (!car?.world) void spawnMe();
});

/** In practice a car drives anywhere; on the grid it is held still; mid-race spectators wait. */
function placeCarForPhase(previous: Phase) {
  if (!car) return;
  const phase = state.phase;
  if (phase === 'countdown' && previous !== 'countdown') {
    if (state.racers.includes(me)) moveCar(gridSlot(state.racers.indexOf(me)));
    else moveCar(benchSlot(hashOf(me) % 16));
  }
  if (phase === 'racing' && !state.racers.includes(me) && previous !== 'racing') {
    moveCar(benchSlot(hashOf(me) % 16));
  }
  const held = phase === 'countdown' || (phase === 'racing' && !state.racers.includes(me));
  driving.car = held ? null : car;
  car.handBrake = held;
  if (held) {
    car.acceleration = 0;
    car.brake = 1;
    car.steeringFactor = 0;
  } else if (driving.car === car && previous !== phase) {
    car.brake = 0;
  }
}

function moveCar(to: { position: Point3; rotation: Point4 }) {
  car?.resetTo({ position: to.position, rotation: to.rotation });
}

/** R: back onto the track, just past the last checkpoint passed (or the start line) */
world.keyboardInput.bind('KeyR').subscribe(pressed => {
  if (!pressed || !car || !driving.car) return;
  const passed = amRacing() ? (progress[me]?.passed ?? 0) : 0;
  const gate = passed === 0 ? 0 : (passed - 1) % CHECKPOINTS;
  const pose = poseAt(checkpointDistance(gate) + 3);
  moveCar({ position: { ...pose.position, z: 0.8 }, rotation: carRotation(pose.heading) });
});
/** Enter: start a race now, with whoever is in the room (alone: a time trial) */
world.keyboardInput.bind('Enter').subscribe(pressed => {
  if (!pressed || !connected || state.phase !== 'waiting') return;
  startRequested = true;
  net.send({ type: 'start' } as GameMessage);
});

/** a starting-grid slot no other car is standing on, for a player joining between races */
function freeGridSlot() {
  const cars = world.children.filter((e): e is GgCarEntity => e instanceof GgCarEntity);
  for (let i = 0; i < 16; i++) {
    const slot = gridSlot((hashOf(me) + i) % 16);
    if (cars.every(c => Pnt3.dist({ ...c.position, z: 0 }, { ...slot.position, z: 0 }) > 4)) return slot;
  }
  return benchSlot(hashOf(me) % 16);
}

// --- join: the track is loaded, so connect, then put my car on it
world.start();
loading.hide();
renderHud();
const slowHint = setTimeout(() => {
  if (!connected) {
    setStatus('Still connecting... signaling unreachable? Add ?local to the URL to race in two tabs of this browser.');
  }
}, 15000);
try {
  await net.connect();
} catch (error) {
  setStatus(`Could not join the room: ${error instanceof Error ? error.message : String(error)}`);
  throw error;
} finally {
  clearTimeout(slowHint);
}
connected = true;
await spawnMe();
setInterval(() => {
  direct();
  renderHud();
}, 100);

// --- HUD
function showFlash(title: string, subtitle: string, ms: number) {
  flash = { title, subtitle, until: performance.now() + ms };
}

function setStatus(text: string) {
  document.getElementById('status')!.textContent = text;
}

function renderHud() {
  renderRoom();
  renderBoard();
  renderStatus();
  renderDash();
}

function renderRoom() {
  const el = document.getElementById('room')!;
  const label = `${allPlayers().length} in room · ${selectedPhysicsBackend()} · ${local ? 'local tabs' : 'Firebase'} signaling`;
  if (el.dataset.label === label) return; // don't rebuild the input under the user's cursor
  el.dataset.label = label;
  const url = inviteUrl(roomId);
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

function renderBoard() {
  const el = document.getElementById('board')!;
  const away = new Set(net.peerInfos.filter(p => p.away).map(p => p.peerId));
  const inRace = state.phase === 'racing' || state.phase === 'countdown' || state.phase === 'results';
  const ranked = state.phase === 'results' && state.result ? state.result : inRace ? standings() : [];
  const others = allPlayers().filter(id => !ranked.some(s => s.by === id));
  const row = (id: string, place: string, detail: string) =>
    `<div class="row"><span class="place">${place}</span><span class="dot" style="background:${cssColorOf(id)}"></span>` +
    `<span class="name">${nameOf(id)}${id === me ? ' (you)' : ''}${away.has(id) ? ' - away' : ''}</span>` +
    `<b>${detail}</b></div>`;
  const rows = [
    ...ranked.map((s, i) =>
      row(
        s.by,
        `${i + 1}.`,
        s.timeMs !== null ? formatTime(s.timeMs) : state.phase === 'results' ? 'DNF' : `lap ${lapOf(s.passed)}`,
      ),
    ),
    ...others.map(id => row(id, '', inRace ? 'next race' : '')),
  ].join('');
  el.innerHTML =
    `<div class="title">CAR RACE</div>` +
    `<div class="rule">${LAPS} laps through every checkpoint · first across the line wins</div>` +
    rows +
    `<div class="help">Arrows/WASD drive · Space handbrake · R back on track · Enter start a race</div>`;
}

function renderStatus() {
  const now = performance.now();
  const seconds = Math.ceil(Math.max(0, state.endsAt - now) / 1000);
  const status = document.getElementById('status')!;
  const banner = document.getElementById('banner')!;
  let title = '';
  let subtitle = '';
  if (!connected) {
    if (!status.textContent?.startsWith('Still') && !status.textContent?.startsWith('Could')) {
      status.textContent = `Connecting via ${local ? 'local tabs' : 'Firebase'}...`;
    }
  } else if (state.phase === 'waiting') {
    status.textContent =
      activePlayers().length < 2
        ? 'Practice - share the invite link to race, or press Enter for a time trial'
        : 'Starting...';
  } else if (state.phase === 'countdown') {
    status.textContent = `Race ${state.race} - on the grid`;
    title = String(seconds);
    subtitle = amRacing() ? 'get ready' : 'you race in the next one';
  } else if (state.phase === 'racing') {
    const grace =
      firstFinishSeenAt !== null
        ? ` · ${Math.ceil(Math.max(0, FINISH_GRACE_MS - (now - firstFinishSeenAt)) / 1000)}s left to finish`
        : '';
    status.textContent = `Race ${state.race} · ${formatTime(raceClock())}${grace}`;
    if (!state.racers.includes(me)) subtitle = 'Race in progress - you join the next one';
  } else {
    const winner = state.result?.find(s => s.timeMs !== null);
    title = !winner ? 'Nobody finished' : winner.by === me ? 'You win!' : `${nameOf(winner.by)} wins!`;
    if (winner && state.racers.length === 1) title = `${formatTime(winner.timeMs!)}`;
    subtitle = winner ? `${formatTime(winner.timeMs!)} for ${LAPS} laps` : '';
    if (winner && state.racers.length === 1) subtitle = 'time trial';
    status.textContent = `Next race in ${seconds}...`;
  }
  if (flash && now < flash.until) {
    title = flash.title;
    subtitle = flash.subtitle;
  }
  banner.style.display = title || subtitle ? 'flex' : 'none';
  banner.querySelector('.big')!.textContent = title;
  banner.querySelector('.small')!.textContent = subtitle;
  const winner = state.phase === 'results' ? state.result?.find(s => s.timeMs !== null)?.by : null;
  (banner.querySelector('.big') as HTMLElement).style.color = winner ? cssColorOf(winner) : '';
}

function renderDash() {
  const el = document.getElementById('dash')!;
  const kmh = car ? Math.abs(Math.round(car.raycastVehicle.getSpeed() * 3.6)) : 0;
  const mine = progress[me];
  const lap =
    state.phase === 'racing' && state.racers.includes(me)
      ? mine?.finishMs != null
        ? `finished ${formatTime(mine.finishMs)}`
        : `lap ${lapOf(mine?.passed ?? 0)}/${LAPS} · ${formatTime(lapStartedAt === null ? raceClock() : raceClock() - lapStartedAt)}`
      : '';
  const laps = [
    lastLapMs !== null && `last ${formatTime(lastLapMs)}`,
    bestLapMs !== null && `best ${formatTime(bestLapMs)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  el.innerHTML = `<div class="speed">${kmh}<small> km/h</small></div><div>${lap}</div><div>${laps}</div>`;
}
