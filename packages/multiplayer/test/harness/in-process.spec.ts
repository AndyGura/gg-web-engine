import { IEntity } from '@gg-web-engine/core';
import { NearestPeerOwnership } from '../../src';
import { ADAPTERS, CountNode, dist, Harness, TICK_MS } from './harness';

jest.setTimeout(60_000);

const findByName = (h: Harness, peerId: string, name: string): any =>
  h.peer(peerId).world.children.find((e: IEntity) => e.name === name);

describe.each(ADAPTERS)('in-process multiplayer harness ($name)', adapter => {
  let h: Harness;
  // distance in meters, whatever the adapter's world units
  const meters = (a: any, b: any) => dist(a, b) / adapter.unit;

  afterEach(() => {
    h?.dispose();
    CountNode.counts.clear();
  });

  it('replicates a runtime spawn, converges, and settles asleep on both peers', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const box = adapter.addBox(a.world, adapter.at(0, 3));
    await h.run(5);
    const replica = findByName(h, 'b', box.name);
    expect(replica).toBeDefined();
    expect(b.net.ownerOf(replica)).toBe('a');
    expect(a.net.ownerOf(box)).toBe('a');

    await h.run(300); // ~5 s
    expect(meters(box.position, replica.position)).toBeLessThan(0.1);
    // matter-js never falls asleep on its own (its engine runs without enableSleeping); everywhere
    // else the owner's body rests and the replica follows it to sleep
    expect(box.objectBody!.isSleeping).toBe(adapter.name !== 'matter');
    expect(replica.objectBody.isSleeping).toBe(box.objectBody!.isSleeping);
  });

  it('converges under latency, jitter and loss', async () => {
    h = new Harness(adapter, { latencyMs: 60, jitterMs: 30, lossRate: 0.15 });
    const a = await h.addPeer('a');
    await h.addPeer('b');
    const box = adapter.addBox(a.world, adapter.at(0, 4));
    box.objectBody!.linearVelocity = adapter.along(2);
    await h.run(30);
    const replica = findByName(h, 'b', box.name);
    expect(replica).toBeDefined();
    await h.run(300);
    expect(meters(box.position, replica.position)).toBeLessThan(0.15);
  });

  it('possession transfers ownership to the possessor on every peer', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const box = adapter.addBox(a.world, adapter.at(0, 0.5));
    await h.run(10);
    const replica = findByName(h, 'b', box.name);
    expect(b.net.possess(replica)).toBe(true);
    await h.run(5);
    expect(a.net.ownerOf(box)).toBe('b');
    expect(a.net.possessorOf(box)).toBe('b');
    expect(b.net.isLocallyOwned(replica)).toBe(true);
    // possessed by b: a can't take it
    expect(a.net.possess(box)).toBe(false);
    b.net.release(replica);
    await h.run(5);
    expect(a.net.possessorOf(box)).toBeNull();
    expect(a.net.possess(box)).toBe(true);
    await h.run(5);
    expect(b.net.ownerOf(replica)).toBe('a');
  });

  it('hands a Free entity over to a much closer peer (distance rule)', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const box = adapter.addBox(a.world, adapter.at(0, 0.5));
    a.position = adapter.at(60, 0);
    b.position = adapter.at(2, 0);
    await h.run(150); // heartbeats carry positions, arbitration runs every 15 ticks, 1.5 s cooldown
    const replica = findByName(h, 'b', box.name);
    expect(a.net.ownerOf(box)).toBe('b');
    expect(b.net.ownerOf(replica)).toBe('b');
  });

  it('claims a foreign Free body hit hard by a possessed body (contact rule), without chaining', async () => {
    h = new Harness(
      adapter,
      {},
      { ownership: new NearestPeerOwnership({ contactImpulseThreshold: 0.001, floor: 10 * adapter.unit }) },
    );
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const target = adapter.addBox(a.world, adapter.at(0, 0.5));
    const bystander = adapter.addBox(a.world, adapter.at(1.6, 0.5));
    const projectile = adapter.addBox(b.world, adapter.at(-1.5, 0.5));
    await h.run(40);
    expect(b.net.possess(projectile)).toBe(true);
    await h.run(5);
    projectile.objectBody!.linearVelocity = adapter.along(8);
    await h.run(90);
    const targetOnB = findByName(h, 'b', target.name);
    expect(b.net.ownerOf(targetOnB)).toBe('b');
    expect(a.net.ownerOf(target)).toBe('b');
    expect(a.net.ownerOf(bystander)).toBe('a'); // the claimed target pushing it on doesn't chain
  });

  it('late joiner reproduces the entity set, ownership and state', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const boxA = adapter.addBox(a.world, adapter.at(-2, 0.5));
    const boxB = adapter.addBox(b.world, adapter.at(2, 0.5));
    await h.run(60);
    b.net.possess(findByName(h, 'b', boxB.name));
    await h.run(10);
    const c = await h.addPeer('c');
    await h.run(10);
    const onC = (name: string) => findByName(h, 'c', name);
    expect(onC(boxA.name)).toBeDefined();
    expect(onC(boxB.name)).toBeDefined();
    expect(c.net.ownerOf(onC(boxA.name))).toBe('a');
    expect(c.net.possessorOf(onC(boxB.name))).toBe('b');
    expect(meters(onC(boxA.name).position, boxA.position)).toBeLessThan(0.1);
    expect(meters(onC(boxB.name).position, boxB.position)).toBeLessThan(0.1);
  });

  it('exchanges runtime spawns over a link that opens after both peers joined (zoning)', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    await h.addPeer('b');
    h.hub.cutLink('a', 'c'); // out of each other's range: c joins knowing only b
    const c = await h.addPeer('c');
    const boxA = adapter.addBox(a.world, adapter.at(-2, 0.5));
    const boxC = adapter.addBox(c.world, adapter.at(2, 0.5));
    await h.run(5);
    a.net.possess(boxA);
    c.net.possess(boxC);
    await h.run(60);
    expect(findByName(h, 'c', boxA.name)).toBeUndefined();
    expect(findByName(h, 'a', boxC.name)).toBeUndefined();
    h.hub.openLink('a', 'c'); // they meet
    await h.run(30);
    const aOnC = findByName(h, 'c', boxA.name);
    const cOnA = findByName(h, 'a', boxC.name);
    expect(aOnC).toBeDefined();
    expect(cOnA).toBeDefined();
    expect(c.net.possessorOf(aOnC)).toBe('a');
    expect(a.net.possessorOf(cOnA)).toBe('c');
    expect(meters(aOnC.position, boxA.position)).toBeLessThan(0.1);
    expect(meters(cOnA.position, boxC.position)).toBeLessThan(0.1);
  });

  it('takes over a silent peer: owned and possessed entities move to the nearest peer as Free', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const c = await h.addPeer('c');
    const boxB = adapter.addBox(b.world, adapter.at(5, 0.5));
    await h.run(10);
    b.net.possess(boxB);
    b.position = adapter.at(5, 0);
    a.position = adapter.at(30, 0);
    c.position = adapter.at(4, 0);
    await h.run(80);
    h.hub.partition('b');
    await h.run(Math.ceil(6000 / TICK_MS));
    const onA = findByName(h, 'a', boxB.name);
    const onC = findByName(h, 'c', boxB.name);
    expect(a.net.ownerOf(onA)).toBe('c');
    expect(c.net.ownerOf(onC)).toBe('c');
    expect(c.net.possessorOf(onC)).toBeNull();
  });

  it("takeoverPossessed: false keeps a silent peer's possessed entity its own, Free ones are still taken", async () => {
    h = new Harness(adapter);
    const options = { takeoverPossessed: false };
    const a = await h.addPeer('a', undefined, options);
    const b = await h.addPeer('b', undefined, options);
    const c = await h.addPeer('c', undefined, options);
    const possessed = adapter.addBox(b.world, adapter.at(5, 0.5));
    const free = adapter.addBox(b.world, adapter.at(8, 0.5));
    await h.run(10);
    b.net.possess(possessed);
    b.position = adapter.at(5, 0);
    a.position = adapter.at(30, 0);
    c.position = adapter.at(4, 0);
    await h.run(80);
    expect(c.net.ownerOf(findByName(h, 'c', free.name))).toBe('b');
    h.hub.partition('b');
    await h.run(Math.ceil(6000 / TICK_MS));
    for (const peer of [a, c]) {
      const onPeer = findByName(h, peer.id, possessed.name);
      expect(peer.net.ownerOf(onPeer)).toBe('b');
      expect(peer.net.possessorOf(onPeer)).toBe('b');
      expect(peer.net.ownerOf(findByName(h, peer.id, free.name))).toBe('c');
    }
    h.hub.heal('b');
    await h.run(Math.ceil(2000 / TICK_MS));
    expect(b.net.isLocallyPossessed(possessed)).toBe(true);
    expect(a.net.possessorOf(findByName(h, 'a', possessed.name))).toBe('b');
    expect(c.net.ownerOf(findByName(h, 'c', possessed.name))).toBe('b');
  });

  it('a stall of the local peer is not taken for silence of the others', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    const b = await h.addPeer('b');
    const c = await h.addPeer('c');
    const boxB = adapter.addBox(b.world, adapter.at(5, 0.5));
    await h.run(10);
    b.net.possess(boxB);
    await h.run(80);
    // nothing ran for 10 s: no timer, no tick, no delivery
    (h.scheduler as any).time += 10_000;
    await h.run(Math.ceil(2000 / TICK_MS));
    for (const peer of [a, b, c]) {
      expect(peer.net.peerInfos.length).toBe(2);
      expect(peer.net.possessorOf(findByName(h, peer.id, boxB.name))).toBe('b');
    }
  });

  it('a level JSON events binding fires exactly once across peers (event authority gate)', async () => {
    h = new Harness(adapter);
    const triggerDims = adapter.dim === 2 ? { x: 4, y: 2 } : { x: 4, y: 4, z: 2 };
    const level = {
      entities: [
        {
          class: 'Trigger',
          name: 'zone',
          // clear of the (static, non-networked) ground: an overlap with it would fire on every peer
          position: adapter.at(0, 2.5),
          config: { dimensions: triggerDims },
          events: { onEntityEntered: 'Count' },
        },
      ],
    };
    const setup = async (peer: any) => {
      await peer.net.loadSharedLevel(level, 'level', 'level.json');
    };
    const a = await h.addPeer('a', setup);
    await h.addPeer('b', setup);
    await h.addPeer('c', setup);
    adapter.addBox(a.world, adapter.at(0, 5), 0.5);
    await h.run(200);
    const total = [...CountNode.counts.values()].reduce((x, y) => x + y, 0);
    expect(total).toBe(1);
    expect(CountNode.counts.get('a')).toBe(1);
  });

  it('despawn removes a shared entity everywhere, including for a later joiner', async () => {
    h = new Harness(adapter);
    const crateDims = adapter.dim === 2 ? { x: 1, y: 1 } : { x: 1, y: 1, z: 1 };
    const level = {
      entities: [
        {
          class: 'Primitive',
          shape: 'BOX',
          name: 'crate',
          position: adapter.at(0, 0.5),
          config: { dimensions: crateDims },
        },
      ],
    };
    const setup = async (peer: any) => {
      await peer.net.loadSharedLevel(level, 'level', 'level.json');
    };
    const a = await h.addPeer('a', setup);
    const b = await h.addPeer('b', setup);
    await h.run(30);
    const crateOnB = b.world.getEntityByName('crate');
    expect(b.net.ownerOf(crateOnB)).toBe('a');
    a.net.despawn(a.world.getEntityByName('crate'));
    await h.run(5);
    expect(() => b.world.getEntityByName('crate')).toThrow();
    const c = await h.addPeer('c', setup);
    await h.run(5);
    expect(() => c.world.getEntityByName('crate')).toThrow();
  });

  it('despawns shared content that is not itself networked (a trigger), everywhere and for late joiners', async () => {
    h = new Harness(adapter);
    const dims = adapter.dim === 2 ? { x: 100, y: 100 } : { x: 1, y: 1, z: 1 };
    const level = {
      entities: [{ class: 'Trigger', name: 'coin', position: adapter.at(0, 1), config: { dimensions: dims } }],
    };
    const setup = async (peer: any) => {
      await peer.net.loadSharedLevel(level, 'coins', 'coins.json');
    };
    const a = await h.addPeer('a', setup);
    const b = await h.addPeer('b', setup);
    await h.run(5);
    a.net.despawn(a.world.getEntityByName('coin'));
    await h.run(5);
    expect(() => b.world.getEntityByName('coin')).toThrow();
    const c = await h.addPeer('c', setup);
    await h.run(5);
    expect(() => c.world.getEntityByName('coin')).toThrow();
  });

  it('accepts a new shared level registered after joining (e.g. the next round)', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a', async peer => peer.net.registerSharedLevel('level', 'one.json'));
    const b = await h.addPeer('b', async peer => peer.net.registerSharedLevel('level', 'one.json'));
    expect(() => a.net.registerSharedLevel('round-2', 'two.json')).not.toThrow();
    expect(() => b.net.registerSharedLevel('round-2', 'two.json')).not.toThrow();
  });

  it('refuses a joiner whose shared level differs from the room', async () => {
    h = new Harness(adapter);
    await h.addPeer('a', async peer => peer.net.registerSharedLevel('level', 'one.json'));
    await expect(h.addPeer('b', async peer => peer.net.registerSharedLevel('level', 'two.json'))).rejects.toThrow(
      /don't match/,
    );
  });
});
