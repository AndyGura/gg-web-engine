import { Entity3d, GgStatic, IEntity } from '@gg-web-engine/core';
import { Network3dController } from '../../src';
import { ADAPTERS, Harness, TICK_MS } from './harness';

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
    expect(await ggstatic.runConsoleCommand('net_tuning', ['deadzone', '0.5'])).toContain('"deadzone":0.5');
    adapter.addBox(a.world, adapter.at(0, 1));
    h.step(2);
    expect(await ggstatic.runConsoleCommand('net_owners', [])).toContain('owner a');
    a.net.leave();
    expect(a.world.commandGuard).toBeNull();
    expect(await ggstatic.runConsoleCommand('remove', ['ground', '0'])).toContain('removed');
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

  it('leave() while waiting for join dumps cancels the join', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    a.net.conditioner.latencyMs = 10_000; // a's join dump arrives only after b gave up
    const world = await adapter.createWorld();
    adapter.addGround(world);
    const loader = adapter.createLoader(world);
    const transport = h.hub.createTransport('b');
    const net = new Network3dController({ transport, scheduler: h.scheduler, levelLoader: loader, prefixEntityNames: false });
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
