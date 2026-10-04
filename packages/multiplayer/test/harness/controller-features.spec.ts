import { Entity3d, GgStatic, IEntity, RigidBodyCorrection } from '@gg-web-engine/core';
import { ClockSync, NetScheduler, Network3dController } from '../../src';
import { ADAPTERS, dist, Harness, TICK_MS } from './harness';

jest.setTimeout(60_000);

const adapter = ADAPTERS.find(a => a.name === 'rapier3d')!;
const findByName = (h: Harness, peerId: string, name: string): any =>
  h.peer(peerId).world.children.find((e: IEntity) => e.name === name);

describe('NetworkController features', () => {
  let h: Harness;

  afterEach(() => {
    h?.dispose();
    delete (window as any).ggstatic;
  });

  it('locks mutating console commands while joined and registers net_* commands', async () => {
    const ggstatic = GgStatic.instance;
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    (ggstatic as any)._selectedWorld$.next(a.world);
    expect(await ggstatic.runConsoleCommand('remove', ['ground'])).toContain('rejected');
    expect(await ggstatic.runConsoleCommand('entities', [])).toContain('ground');
    expect(await ggstatic.runConsoleCommand('net_status', [])).toContain('session: joined');
    expect(await ggstatic.runConsoleCommand('net_lag', ['100', '10'])).toBe('100 ms, 10% loss');
    expect(a.net.conditioner.latencyMs).toBe(100);
    expect(await ggstatic.runConsoleCommand('net_lag', ['40', '2', '15', '300', '5000', '400', '5'])).toBe(
      '40 ms, 2% loss, +-15 ms jitter, 300 ms stall every 5000 ms, 5% of reliable +400 ms',
    );
    expect(await ggstatic.runConsoleCommand('net_status', [])).toContain('simulated lag: 40 ms, 2% loss, +-15 ms');
    expect(await ggstatic.runConsoleCommand('net_lag', ['0'])).toBe('0 ms, 0% loss');
    expect(a.net.conditioner.active).toBe(false);
    expect(await ggstatic.runConsoleCommand('net_tuning', ['deadzone', '0.5'])).toContain('"deadzone":0.5');
    adapter.addBox(a.world, adapter.at(0, 1));
    h.step(2);
    expect(await ggstatic.runConsoleCommand('net_owners', [])).toContain('owner a');
    a.net.leave();
    expect(a.world.commandGuard).toBeNull();
    expect(await ggstatic.runConsoleCommand('remove', ['ground', '0'])).toContain('removed');
  });

  it('net_panel shows live stats of the session and every peer, and goes away with the controller', async () => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'performance'] });
    try {
      const ggstatic = GgStatic.instance;
      h = new Harness(adapter, { latencyMs: 20 });
      const a = await h.addPeer('a');
      const b = await h.addPeer('b');
      (ggstatic as any)._selectedWorld$.next(b.world);
      const box = adapter.addBox(a.world, adapter.at(0, 1));
      box.objectBody!.linearVelocity = adapter.along(1);
      await h.run(Math.ceil(1000 / TICK_MS));
      expect(await ggstatic.runConsoleCommand('net_panel', [])).toBe('1');
      const panel = document.getElementById('gg_net_panel')!;
      expect(panel.textContent).toContain('joined as b, 1 peer(s)');
      expect(panel.textContent).toContain('1 replicas');
      const before = b.net.netStats;
      await h.run(Math.ceil(1000 / TICK_MS));
      jest.advanceTimersByTime(500);
      const stats = b.net.netStats;
      expect(stats.received.stateItems).toBeGreaterThan(before.received.stateItems);
      expect(stats.received.bytes).toBeGreaterThan(before.received.bytes);
      expect(stats.sent.messages).toBeGreaterThan(before.sent.messages);
      const peer = stats.peers[0];
      expect(peer).toMatchObject({ peerId: 'a', clockReady: true, owned: 1 });
      expect(peer.rttMs).toBeCloseTo(40, 0);
      // snapshots arrive one link latency old
      expect(peer.stateAgeSumMs / peer.stateAgeCount).toBeCloseTo(20, 0);
      const row = panel.textContent!.split('\n').find(l => l.startsWith('a '))!;
      expect(row).toContain('40.0 ms');
      expect(row).toMatch(/2\d\.\d ms/); // age
      expect(await ggstatic.runConsoleCommand('net_panel', ['1'])).toBe('1');
      expect(document.querySelectorAll('#gg_net_panel')).toHaveLength(1);
      b.world.removeEntity(b.net);
      expect(document.getElementById('gg_net_panel')).toBeNull();
      // the panel never touches the app's own switch
      b.net.measureTraffic = true;
      b.net.showNetPanel = true;
      b.net.showNetPanel = false;
      expect(b.net.measureTraffic).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('tints replicas in the physics debug view, never owned bodies', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    await h.addPeer('b');
    const box = adapter.addBox(a.world, adapter.at(0, 1));
    await h.run(5);
    const replica = findByName(h, 'b', box.name);
    expect(box.objectBody!.debugBodySettings.color).not.toBe(0xff6ec7);
    expect(replica.objectBody.debugBodySettings.color).toBe(0xff6ec7);
  });

  it('delivers app messages, and the most senior peer join state to a late joiner', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    a.net.joinState = () => ({ scores: { a: 3 } });
    const b = await h.addPeer('b');
    b.net.joinState = () => ({ scores: { b: 99 } });
    const got: unknown[] = [];
    a.net.appMessages$.subscribe(m => got.push(m));
    b.net.send({ hello: 1 });
    h.step(2);
    expect(got).toEqual([{ from: 'b', data: { hello: 1 } }]);
    let state: unknown = null;
    await h.addPeer('c', peer => {
      peer.net.joinState$.subscribe(s => (state = s));
    });
    expect(state).toEqual({ scores: { a: 3 } });
  });

  it('despawns an entity everywhere when its lifetime runs out', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    await h.addPeer('b');
    const box = adapter.addBox(a.world, adapter.at(0, 1));
    a.net.setLifetime(box, 500);
    await h.run(5);
    expect(findByName(h, 'b', box.name)).toBeDefined();
    await h.run(Math.ceil(600 / TICK_MS));
    expect(box.world).toBeNull();
    expect(findByName(h, 'b', box.name)).toBeUndefined();
  });

  it('keeps a lifetime that arrives before the clock sync, whatever the sender clock', async () => {
    h = new Harness(adapter, { latencyMs: 50 });
    const shared = h.scheduler;
    // a's clock counts from a minute later than everybody else's (another tab's performance.now())
    const skewed: NetScheduler = {
      now: () => shared.now() - 60_000,
      setTimeout: (fn, ms) => shared.setTimeout(fn, ms),
      clearTimeout: t => shared.clearTimeout(t),
      setInterval: (fn, ms) => shared.setInterval(fn, ms),
      clearInterval: t => shared.clearInterval(t),
    };
    const a = await h.addPeer('a', undefined, { scheduler: skewed });
    const b = await h.addPeer('b');
    await h.run(5);
    (b.net as any).peers.get('a').clock = new ClockSync(); // no sample from a yet
    const box = adapter.addBox(a.world, adapter.at(0, 1));
    a.net.setLifetime(box, 2000);
    await h.run(10);
    expect(findByName(h, 'b', box.name)).toBeDefined();
    await h.run(Math.ceil(2500 / TICK_MS));
    expect(findByName(h, 'b', box.name)).toBeUndefined();
  });

  // a scheduler whose clock counts from `skewMs` earlier than the shared one (another tab's performance.now())
  const skewedScheduler = (shared: NetScheduler, skewMs: number): NetScheduler => ({
    now: () => shared.now() - skewMs,
    setTimeout: (fn, ms) => shared.setTimeout(fn, ms),
    clearTimeout: t => shared.clearTimeout(t),
    setInterval: (fn, ms) => shared.setInterval(fn, ms),
    clearInterval: t => shared.clearInterval(t),
  });

  it('syncs clocks with a burst of unreliable pings when a link opens, then at the regular interval', async () => {
    h = new Harness(adapter, { latencyMs: 40 });
    const a = await h.addPeer('a', undefined, { scheduler: skewedScheduler(h.scheduler, 60_000) });
    const pings: string[] = [];
    const send = h.hub._deliver.bind(h.hub);
    h.hub._deliver = (from, to, channel, msg) => {
      if (msg.t === 'ping' || msg.t === 'pong') {
        pings.push(`${from} ${msg.t} ${channel}`);
      }
      send(from, to, channel, msg);
    };
    const b = await h.addPeer('b');
    await h.run(Math.ceil(1000 / TICK_MS));
    expect(pings.every(p => p.endsWith('unreliable'))).toBe(true);
    expect(pings.filter(p => p === 'b ping unreliable').length).toBe(5);
    const clock: ClockSync = (b.net as any).peers.get('a').clock;
    expect(clock.ready).toBe(true);
    expect(clock.offset).toBeCloseTo(-60_000, 0);
    expect(clock.rtt).toBeCloseTo(80, 0);
    pings.length = 0;
    await h.run(Math.ceil(6000 / TICK_MS));
    expect(pings.filter(p => p === 'b ping unreliable').length).toBe(3);
    // peerInfos (and net_status) report the same numbers
    expect(b.net.peerInfos.find(p => p.peerId === 'a')!.offsetMs).toBeCloseTo(-60_000, 0);
    expect(b.net.peerInfos.find(p => p.peerId === 'a')!.rttMs).toBeCloseTo(80, 0);
  });

  it('never snaps a replica moving at constant velocity under jitter and ping loss', async () => {
    // 25..55 ms each way, 2% of everything unreliable lost
    h = new Harness(adapter, { latencyMs: 25, jitterMs: 30, lossRate: 0.02 });
    const a = await h.addPeer('a', undefined, { scheduler: skewedScheduler(h.scheduler, 60_000) });
    const b = await h.addPeer('b');
    for (const peer of [a, b]) {
      (peer.world.physicsWorld as any).gravity = { x: 0, y: 0, z: 0 };
    }
    await h.run(Math.ceil(1000 / TICK_MS));
    const speed = 70;
    const box = adapter.addBox(a.world, adapter.at(-900, 20)) as Entity3d;
    box.objectBody!.linearVelocity = adapter.along(speed);
    a.net.possess(box);
    const clock: ClockSync = (b.net as any).peers.get('a').clock;
    const outcomes: string[] = [];
    const correct = jest.spyOn(RigidBodyCorrection, 'correct');
    let worstClock = 0;
    let worstGap = 0;
    try {
      for (let i = 0; i < Math.ceil(25_000 / TICK_MS); i++) {
        await h.run(1);
        worstClock = Math.max(worstClock, Math.abs(clock.offset + 60_000));
        const replica = findByName(h, 'b', box.name);
        if (replica && i > 60) {
          worstGap = Math.max(worstGap, Math.abs(replica.position.x - box.position.x));
        }
      }
      for (const r of correct.mock.results) {
        outcomes.push(r.value as string);
      }
    } finally {
      correct.mockRestore();
    }
    expect(box.position.x).toBeGreaterThan(800);
    expect(outcomes.length).toBeGreaterThan(1000);
    // the spawn places the replica outright; nothing after that may teleport it
    expect(outcomes.slice(1).filter(o => o === 'snap')).toEqual([]);
    expect(worstClock).toBeLessThan(8);
    // and the stats agree: no snap, no lunge, new snapshots barely move the target, ~2% of them lost
    const stats = b.net.netStats.peers[0];
    expect(stats.snaps).toBe(0);
    expect(stats.lunges).toBe(0);
    expect(stats.targetJumpCount).toBeGreaterThan(500);
    expect(stats.targetJumpSum / stats.targetJumpCount).toBeLessThan(0.05);
    const loss = stats.stateMessagesLost / (stats.stateMessagesLost + stats.stateMessages);
    expect(loss).toBeGreaterThan(0.005);
    expect(loss).toBeLessThan(0.05);
    // the replica stays about a tick of travel (1.1 m) from the owner's body, well inside snapDistance
    expect(worstGap).toBeLessThan(2);
  });

  it('counts lost state messages, lunges and snaps per peer', async () => {
    h = new Harness(adapter, { latencyMs: 20 });
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    for (const peer of [a, b]) {
      (peer.world.physicsWorld as any).gravity = { x: 0, y: 0, z: 0 };
    }
    await h.run(Math.ceil(1000 / TICK_MS));
    const box = adapter.addBox(a.world, adapter.at(0, 20)) as Entity3d;
    box.objectBody!.linearVelocity = adapter.along(10);
    await h.run(Math.ceil(2000 / TICK_MS));
    let stats = b.net.netStats.peers[0];
    expect(stats).toMatchObject({ peerId: 'a', stateMessagesLost: 0, snaps: 0, lunges: 0 });
    expect(stats.stateMessages).toBeGreaterThan(40);

    // one in five state messages lost on the way
    h.hub.conditions.lossRate = 0.2;
    const before = stats;
    await h.run(Math.ceil(10_000 / TICK_MS));
    stats = b.net.netStats.peers[0];
    const lost = stats.stateMessagesLost - before.stateMessagesLost;
    const arrived = stats.stateMessages - before.stateMessages;
    expect(lost / (lost + arrived)).toBeGreaterThan(0.12);
    expect(lost / (lost + arrived)).toBeLessThan(0.28);
    expect(stats.snaps).toBe(0);
    expect(stats.lunges).toBe(0);

    // a split message arrives as parts with one counter, in any order: counted once
    const countState = (n: number) => (b.net as any).countStateMessage((b.net as any).peers.get('a'), n);
    const messages = () => b.net.netStats.peers[0].stateMessages;
    const lostNow = () => b.net.netStats.peers[0].stateMessagesLost;
    const n0: number = (b.net as any).peers.get('a').lastStateN;
    const [m0, l0] = [messages(), lostNow()];
    countState(n0 + 1);
    countState(n0 + 2);
    countState(n0 + 1);
    countState(n0 + 4); // n0 + 3 is missing
    expect([messages() - m0, lostNow() - l0]).toEqual([3, 1]);
    countState(n0 + 3); // late after all
    expect([messages() - m0, lostNow() - l0]).toEqual([4, 0]);
    // a gap after a silent second is a paused stream (out of the sender's stream ring), not loss
    h.hub.conditions.lossRate = 0;
    const rate = a.net.sendRate;
    a.net.sendRate = 0.001;
    await h.run(Math.ceil(1500 / TICK_MS));
    const [n1, l1] = [(b.net as any).peers.get('a').lastStateN as number, lostNow()];
    countState(n1 + 50);
    expect(lostNow()).toBe(l1);
    countState(n1 + 60); // while one within a running stream is
    expect(lostNow()).toBe(l1 + 9);
    (b.net as any).peers.get('a').lastStateN = null; // back in step with the real stream
    a.net.sendRate = rate;
    await h.run(5);
    // the pause froze the replica's target (extrapolation is capped) while its body kept moving: it was
    // snapped back several times, and the stream resuming was a lunge
    const resumed = b.net.netStats.peers[0];
    expect(resumed.lunges).toBe(1);
    expect(resumed.snaps).toBeGreaterThan(1);

    // the owner's body jumps 30 m: the next snapshot moves the replica's target (a lunge), beyond snapDistance
    h.hub.conditions.lossRate = 0;
    const p = box.objectBody!.position;
    box.objectBody!.position = { x: p.x, y: p.y + 30, z: p.z };
    await h.run(Math.ceil(500 / TICK_MS));
    stats = b.net.netStats.peers[0];
    expect([stats.lunges - resumed.lunges, stats.snaps - resumed.snaps]).toEqual([1, 1]);
    expect(dist(findByName(h, 'b', box.name).position, box.position)).toBeLessThan(1);
  });

  it('a hidden peer hands its entities over and takes its possession back after resyncing', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const box = adapter.addBox(b.world, adapter.at(0, 1));
    await h.run(5);
    b.net.possess(box);
    await h.run(5);
    b.net.goAway();
    await h.run(5);
    const onA = findByName(h, 'a', box.name);
    expect(a.net.ownerOf(onA)).toBe('a');
    expect(a.net.possessorOf(onA)).toBeNull();
    const resync = b.net.returnFromAway();
    await h.run(10);
    await resync;
    await h.run(5);
    expect(a.net.possessorOf(onA)).toBe('b');
    expect(b.net.isLocallyPossessed(box)).toBe(true);
  });

  it('possesses an entity added while a remote spawn is still being built', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const createEntity = b.loader.createEntity.bind(b.loader);
    let finishSpawn!: () => void;
    const gate = new Promise<void>(resolve => (finishSpawn = resolve));
    jest.spyOn(b.loader, 'createEntity').mockImplementation(async (...args) => {
      await gate;
      return createEntity(...args);
    });
    adapter.addBox(a.world, adapter.at(3, 1));
    await h.run(3);
    const mine = adapter.addBox(b.world, adapter.at(0, 1));
    expect(b.net.possess(mine)).toBe(true);
    finishSpawn();
    await h.run(5);
    expect(b.net.isLocallyPossessed(mine)).toBe(true);
    expect(a.net.possessorOf(findByName(h, 'a', mine.name))).toBe('b');
  });

  it('possesses an entity requested while away once back', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    b.net.goAway();
    await h.run(3);
    const mine = adapter.addBox(b.world, adapter.at(0, 1));
    expect(b.net.possess(mine)).toBe(true);
    const resync = b.net.returnFromAway();
    await h.run(10);
    await resync;
    await h.run(5);
    expect(b.net.isLocallyPossessed(mine)).toBe(true);
    expect(a.net.possessorOf(findByName(h, 'a', mine.name))).toBe('b');
  });

  it('a non-networked entity spawned by an unserializable class reports spawnFailed and stays local', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    await h.addPeer('b');
    const failures: string[] = [];
    a.net.spawnFailed$.subscribe(f => failures.push(f.entity.name));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // a subclass the "Primitive" live serializer deliberately doesn't claim, with no spawn record
    class Custom extends Entity3d {}
    const objectBody = (a.world as any).physicsWorld.factory.createRigidBody({
      shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
      body: { bodyType: 'dynamic', mass: 1 },
    });
    const custom = new Custom({ objectBody });
    a.world.addEntity(custom);
    await h.run(3);
    errorSpy.mockRestore();
    expect(failures).toEqual([custom.name]);
    expect(findByName(h, 'b', custom.name)).toBeUndefined();
  });

  it('a joiner refused for a shared level mismatch resumes its world and can connect again', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a', peer => peer.net.registerSharedLevel('level', 'source-a'));
    await expect(
      h.addPeer('b', peer => {
        peer.net.registerSharedLevel('level', 'source-b');
        peer.world.resumeWorld();
      }),
    ).rejects.toThrow(/don't match/);
    const b = h.peer('b');
    b.world.pauseWorld();
    expect(b.net.sessionState).toBe('idle');
    expect(b.world.commandGuard).toBeNull();
    await h.run(Math.ceil(6000 / TICK_MS));
    expect(a.net.peerInfos).toEqual([]);
    a.net.leave();
    await h.run(2);
    const retry = b.net.connect();
    await h.run(5);
    await retry;
    expect(b.net.sessionState).toBe('joined');
  });

  it('owns everything after leave(), and on reconnecting adopts the room and takes its possessions back', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const c = await h.addPeer('c');
    const ofC = adapter.addBox(c.world, adapter.at(4, 1));
    const ofB = adapter.addBox(b.world, adapter.at(0, 1));
    const doomed = adapter.addBox(a.world, adapter.at(-4, 1));
    await h.run(5);
    b.net.possess(ofB);
    await h.run(5);
    b.net.leave();
    const ofCOnB = findByName(h, 'b', ofC.name);
    expect(b.net.ownerOf(ofCOnB)).toBe('b');
    expect(b.net.isLocallyPossessed(ofB)).toBe(true);
    await h.run(5);
    a.net.despawn(findByName(h, 'a', doomed.name));
    c.net.leave(); // ofC's owner is gone by the time b is back
    await h.run(Math.ceil(5000 / TICK_MS));
    const rejoin = b.net.connect();
    await h.run(10);
    await rejoin;
    await h.run(10);
    expect(b.net.sessionState).toBe('joined');
    expect(b.net.ownerOf(ofCOnB)).toBe(a.net.ownerOf(findByName(h, 'a', ofC.name)));
    expect(b.net.ownerOf(ofCOnB)).not.toBe('c');
    expect(findByName(h, 'b', doomed.name)).toBeUndefined();
    expect(b.net.isLocallyPossessed(ofB)).toBe(true);
    expect(a.net.possessorOf(findByName(h, 'a', ofB.name))).toBe('b');
  });

  it('re-announces its own runtime spawn the room lost while it was gone', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const ofB = adapter.addBox(b.world, adapter.at(0, 1));
    await h.run(5);
    b.net.possess(ofB);
    await h.run(5);
    b.net.leave();
    await h.run(5);
    // the taker removes a departed player's character, as games do
    a.net.despawn(findByName(h, 'a', ofB.name));
    await h.run(5);
    expect(findByName(h, 'a', ofB.name)).toBeUndefined();
    const rejoin = b.net.connect();
    await h.run(10);
    await rejoin;
    await h.run(10);
    expect(ofB.world).toBe(b.world);
    expect(b.net.isLocallyPossessed(ofB)).toBe(true);
    expect(a.net.possessorOf(findByName(h, 'a', ofB.name))).toBe('b');
  });

  it('leave() while waiting for join dumps cancels the join', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    a.net.conditioner.latencyMs = 10_000; // a's join dump arrives only after b gave up
    const world = await adapter.createWorld();
    adapter.addGround(world);
    const loader = adapter.createLoader(world);
    const transport = h.hub.createTransport('b');
    const net = new Network3dController({
      transport,
      scheduler: h.scheduler,
      levelLoader: loader,
      prefixEntityNames: false,
    });
    world.addEntity(net);
    h.peers.push({ id: 'b', world, net, loader, position: adapter.at(0, 0) });
    world.resumeWorld();
    const connecting = net.connect();
    await h.run(3);
    expect(net.sessionState).toBe('connecting');
    expect(world.isPaused).toBe(true);
    net.leave();
    expect(world.isPaused).toBe(false);
    await connecting;
    world.pauseWorld();
    await h.run(Math.ceil(12_000 / TICK_MS));
    expect(net.sessionState).toBe('left');
    expect(world.commandGuard).toBeNull();
  });

  it('prefixes default names with one peer id, and only while that controller is in a world', async () => {
    h = new Harness(adapter);
    const make = async (id: string) => {
      const world = await adapter.createWorld();
      const net = new Network3dController({ transport: h.hub.createTransport(id), scheduler: h.scheduler });
      return { world, net };
    };
    const p = await make('p');
    const q = await make('q');
    const beforeAdding = adapter.addBox(p.world, adapter.at(0, 1));
    expect(beforeAdding.name).not.toContain('.');
    p.world.addEntity(p.net);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    q.world.addEntity(q.net);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('prefixEntityNames'));
    warn.mockRestore();
    expect(adapter.addBox(q.world, adapter.at(0, 1)).name).toMatch(/^p\.[^.]+$/);
    p.world.removeEntity(p.net);
    expect(adapter.addBox(p.world, adapter.at(0, 1)).name).not.toContain('.');
    p.world.dispose();
    q.world.dispose();
  });

  it('defers event authority over a shared entity whose owner is not known yet', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    a.position = adapter.at(100, 0); // b is the nearest peer, so it claims the box once nobody answers
    const b = await h.addPeer('b');
    const box = adapter.addBox(b.world, adapter.at(0, 1));
    box.name = 'only-on-b';
    b.net.markShared(box); // a never answers the state request: b doesn't know who owns it yet
    h.step(2);
    expect(b.net.ownerOf(box)).toBe('');
    expect(b.net.hasAuthority(box, 'onEntityEntered', null)).toBe(false);
    await h.run(Math.ceil(1500 / TICK_MS));
    expect(b.net.ownerOf(box)).toBe('b');
    expect(b.net.hasAuthority(box, 'onEntityEntered', null)).toBe(true);
  });

  it('streams state to every stream target in one send', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    await h.addPeer('b');
    await h.addPeer('c');
    adapter.addBox(a.world, adapter.at(0, 1));
    await h.run(5);
    a.net.transport.streamTargets = () => ['b'];
    await h.run(5); // let state already in flight to c land
    const send = jest.spyOn(a.net.transport, 'send');
    const received = new Map<string, number>();
    for (const id of ['b', 'c']) {
      h.peer(id).net.transport.messages$.subscribe(({ from, msg }) => {
        if (from === 'a' && msg.t === 'state') {
          received.set(id, (received.get(id) ?? 0) + 1);
        }
      });
    }
    await h.run(10);
    const stateSends = send.mock.calls.filter(([, , msg]) => msg.t === 'state');
    expect(stateSends.length).toBeGreaterThan(0);
    expect(stateSends.every(([to]) => Array.isArray(to) && to.length === 1 && to[0] === 'b')).toBe(true);
    expect(received.get('b')).toBeGreaterThan(0);
    expect(received.get('c')).toBeUndefined();
  });

  it('keeps tombstones for despawned shared content only, never for runtime spawns', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    await h.addPeer('b');
    const shared = adapter.addBox(a.world, adapter.at(0, 1));
    shared.name = 'shared-box';
    a.net.markShared(shared);
    const spawned = adapter.addBox(a.world, adapter.at(2, 1));
    await h.run(5);
    a.net.despawn(shared);
    a.net.despawn(spawned);
    await h.run(5);
    const despawnedLists: string[][] = [];
    await h.addPeer('c', peer => {
      peer.net.transport.messages$.subscribe(({ msg }) => {
        if (msg.t === 'joinDump') {
          despawnedLists.push(msg.despawned);
        }
      });
    });
    expect(despawnedLists).toEqual([['shared-box'], ['shared-box']]);
  });

  it('a runtime spawn may reuse the name of an entity despawned earlier', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    await h.addPeer('b');
    const first = adapter.addBox(a.world, adapter.at(0, 1));
    first.name = 'reused';
    await h.run(5);
    expect(findByName(h, 'b', 'reused')).toBeDefined();
    a.world.removeEntity(first, true);
    await h.run(5);
    expect(findByName(h, 'b', 'reused')).toBeUndefined();
    const second = adapter.addBox(a.world, adapter.at(2, 1));
    second.name = 'reused';
    await h.run(5);
    expect(findByName(h, 'b', 'reused')).toBeDefined();
  });
});
