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

  it('replicates a character spawned through the level loader, and the replica lands with it', async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a');
    await h.addPeer('b');
    const player: any = await a.loader.createEntity({ class: 'Player', config: { position: adapter.at(0, 3) } } as any);
    a.world.addEntity(player);
    await h.run(5);
    const replica = findByName(h, 'b', player.name);
    expect(replica).toBeDefined();
    expect(replica.constructor).toBe(player.constructor);
    await h.run(180); // ~3 s: falls towards the ground
    expect(meters(player.position, adapter.at(0, 3))).toBeGreaterThan(0.2);
    expect(meters(player.position, replica.position)).toBeLessThan(0.1);
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

  describe('interest management (zoning): an owner out of view', () => {
    // the grace period, plus the next arbitration round
    const OUT_OF_VIEW = Math.ceil(3000 / TICK_MS);
    const sharedBox = (peer: any, name: string, position: any) => {
      const box = adapter.addBox(peer.world, position);
      box.name = name;
      peer.net.markShared(box);
      return box;
    };

    it('removes a possessed runtime spawn, and rebuilds it when its owner is back in view', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a');
      const b = await h.addPeer('b');
      const box = adapter.addBox(a.world, adapter.at(0, 0.5));
      await h.run(5);
      a.net.possess(box);
      await h.run(30);
      expect(findByName(h, 'b', box.name)).toBeDefined();

      h.hub.cutStream('a', 'b');
      await h.run(OUT_OF_VIEW);
      expect(findByName(h, 'b', box.name)).toBeUndefined();
      expect(findByName(h, 'a', box.name)).toBe(box);

      box.position = adapter.at(20, 0.5);
      h.hub.openStream('a', 'b');
      await h.run(30);
      const back = findByName(h, 'b', box.name);
      expect(back).toBeDefined();
      expect(b.net.possessorOf(back)).toBe('a');
      expect(meters(back.position, box.position)).toBeLessThan(0.1);
    });

    it('hides possessed shared content, and shows the same entity at the owner position afterwards', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const b = await h.addPeer('b', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const car = a.world.getEntityByName('car') as any;
      const replica = b.world.getEntityByName('car') as any;
      await h.run(5);
      a.net.possess(car);
      await h.run(30);
      expect(b.net.possessorOf(replica)).toBe('a');

      h.hub.cutStream('a', 'b');
      await h.run(OUT_OF_VIEW);
      expect(findByName(h, 'b', 'car')).toBeUndefined();
      expect(replica.world).toBeNull();
      expect(replica.disposed).toBe(false);
      expect(b.net.isHidden(replica)).toBe(true);

      car.position = adapter.at(25, 0.5);
      await h.run(30);
      expect(b.net.isHidden(replica)).toBe(true);

      h.hub.openStream('a', 'b');
      await h.run(30);
      expect(findByName(h, 'b', 'car')).toBe(replica);
      expect(b.net.isHidden(replica)).toBe(false);
      expect(b.net.possessorOf(replica)).toBe('a');
      expect(meters(replica.position, car.position)).toBeLessThan(0.1);
    });

    it('stops correcting a replica instead of snapping it back to the last snapshot', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a', peer => void sharedBox(peer, 'crate', adapter.at(0, 0.5)));
      const b = await h.addPeer('b', peer => void sharedBox(peer, 'crate', adapter.at(0, 0.5)));
      b.position = null; // a spectator never claims
      const replica = b.world.getEntityByName('crate') as any;
      await h.run(60);
      expect(b.net.ownerOf(replica)).toBe('a');

      h.hub.cutStream('a', 'b');
      await h.run(OUT_OF_VIEW);
      const snapsBefore = b.net.netStats.peers.find(p => p.peerId === 'a')!.snaps;
      // pushed around locally, far beyond the snap distance from where its owner last reported it
      replica.position = adapter.at(10, 0.5);
      await h.run(120);
      expect(b.net.ownerOf(replica)).toBe('a');
      expect(meters(replica.position, adapter.at(10, 0.5))).toBeLessThan(0.5);
      expect(b.net.netStats.peers.find(p => p.peerId === 'a')!.snaps).toBe(snapsBefore);
    });

    it('claims a Free entity next to the local player, and removes a Free runtime spawn nobody claims', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a');
      const b = await h.addPeer('b');
      const c = await h.addPeer('c');
      c.position = null; // a spectator never claims
      const box = adapter.addBox(a.world, adapter.at(0, 0.5));
      await h.run(30);
      expect(findByName(h, 'b', box.name)).toBeDefined();
      expect(findByName(h, 'c', box.name)).toBeDefined();

      // a is out of range of both: no link at all
      h.hub.interestManagement = true;
      h.hub.cutLink('a', 'b');
      h.hub.cutLink('a', 'c');
      await h.run(OUT_OF_VIEW);
      expect(b.net.ownerOf(findByName(h, 'b', box.name))).toBe('b');
      // c learns it from b's stream
      expect(c.net.ownerOf(findByName(h, 'c', box.name))).toBe('b');

      // b drops out of c's view as well, c holds no position: nothing keeps the box on c
      b.net.possess(findByName(h, 'b', box.name));
      await h.run(10);
      h.hub.cutStream('b', 'c');
      await h.run(OUT_OF_VIEW);
      expect(findByName(h, 'c', box.name)).toBeUndefined();
    });

    it('disposes hidden shared content its owner despawns', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const b = await h.addPeer('b', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const car = a.world.getEntityByName('car') as any;
      const replica = b.world.getEntityByName('car') as any;
      await h.run(5);
      a.net.possess(car);
      await h.run(30);
      h.hub.cutStream('a', 'b');
      await h.run(OUT_OF_VIEW);
      expect(b.net.isHidden(replica)).toBe(true);

      a.net.despawn(car);
      await h.run(10);
      expect(replica.disposed).toBe(true);
      expect(b.net.isNetworked(replica)).toBe(false);
    });

    it('hands what is known about hidden content to the entity the game rebuilds under its name', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const b = await h.addPeer('b', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const car = a.world.getEntityByName('car') as any;
      const replica = b.world.getEntityByName('car') as any;
      await h.run(5);
      a.net.possess(car);
      await h.run(30);
      h.hub.cutStream('a', 'b');
      await h.run(OUT_OF_VIEW);
      expect(b.net.isHidden(replica)).toBe(true);

      // e.g. the chunk it belongs to was unloaded and loaded again
      const rebuilt = sharedBox(b, 'car', adapter.at(0, 0.5)) as any;
      await h.run(2);
      expect(replica.disposed).toBe(true);
      expect(b.net.isHidden(rebuilt)).toBe(true);
      expect(findByName(h, 'b', 'car')).toBeUndefined();
      expect(b.net.possessorOf(rebuilt)).toBe('a');

      car.position = adapter.at(25, 0.5);
      h.hub.openStream('a', 'b');
      await h.run(30);
      expect(findByName(h, 'b', 'car')).toBe(rebuilt);
      expect(meters(rebuilt.position, car.position)).toBeLessThan(0.1);
    });

    it('shows hidden content again, taken over, when its owner leaves the room', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const b = await h.addPeer('b', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const replica = b.world.getEntityByName('car') as any;
      await h.run(5);
      a.net.possess(a.world.getEntityByName('car'));
      await h.run(30);
      h.hub.cutStream('a', 'b');
      await h.run(OUT_OF_VIEW);
      expect(b.net.isHidden(replica)).toBe(true);

      a.net.leave();
      await h.run(20);
      expect(findByName(h, 'b', 'car')).toBe(replica);
      expect(b.net.isHidden(replica)).toBe(false);
      expect(b.net.ownerOf(replica)).toBe('b');
      expect(b.net.possessorOf(replica)).toBeNull();
    });

    it('asks for a runtime spawn it removed when its state shows up again without a spawn', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a');
      const b = await h.addPeer('b');
      const box = adapter.addBox(a.world, adapter.at(0, 0.5));
      await h.run(5);
      a.net.possess(box);
      await h.run(30);
      // a keeps b among its stream targets the whole time, so it never sends the spawn again by
      // itself; b sees a outside its ring while nothing of a's stream arrives
      h.hub.interestManagement = true;
      await h.run(5);
      b.net.transport.streamTargets = () => [];
      b.net.transport.inStreamRange = () => false;
      h.hub.conditions.lossRate = 1;
      await h.run(OUT_OF_VIEW);
      expect(findByName(h, 'b', box.name)).toBeUndefined();

      h.hub.conditions.lossRate = 0;
      delete (b.net.transport as any).streamTargets;
      delete (b.net.transport as any).inStreamRange;
      await h.run(90); // a body at rest is only sent at the keepalive rate
      const back = findByName(h, 'b', box.name);
      expect(back).toBeDefined();
      expect(b.net.possessorOf(back)).toBe('a');
    });

    it('settles on one possessor when two peers possessed the same content while out of range', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const b = await h.addPeer('b', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const onA = a.world.getEntityByName('car');
      const onB = b.world.getEntityByName('car');
      await h.run(30);
      h.hub.interestManagement = true;
      h.hub.cutLink('a', 'b');
      await h.run(5);
      const lost: string[] = [];
      for (const peer of [a, b]) {
        peer.net.possessionChanged$.subscribe(({ from, to }) => {
          if (from === peer.id && to !== peer.id) {
            lost.push(peer.id);
          }
        });
      }
      expect(a.net.possess(onA)).toBe(true);
      await h.run(OUT_OF_VIEW); // b claims it meanwhile: nobody near it that b can see
      expect(b.net.possess(onB)).toBe(true);
      await h.run(10);

      h.hub.openLink('a', 'b');
      await h.run(60);
      const possessor = a.net.possessorOf(onA);
      expect(possessor).not.toBeNull();
      expect(b.net.possessorOf(onB)).toBe(possessor);
      expect(a.net.ownerOf(onA)).toBe(possessor);
      expect(b.net.ownerOf(onB)).toBe(possessor);
      expect(lost).toEqual([possessor === 'a' ? 'b' : 'a']);
    });

    it('takes over the entities of a peer that left the room or went away, as without zoning', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a');
      const b = await h.addPeer('b');
      const c = await h.addPeer('c');
      h.hub.interestManagement = true;
      const boxes = [a, b, c].map((peer, i) => adapter.addBox(peer.world, adapter.at(i * 3, 0.5)));
      await h.run(5);
      [a, b, c].forEach((peer, i) => peer.net.possess(boxes[i]));
      const prop = adapter.addBox(a.world, adapter.at(-3, 0.5));
      await h.run(30);

      a.net.goAway(); // a hidden tab
      await h.run(10);
      b.net.leave(); // gone from the room
      await h.run(OUT_OF_VIEW);
      for (const box of [boxes[0], boxes[1], prop]) {
        const onC = findByName(h, 'c', box.name);
        expect(onC).toBeDefined();
        expect(c.net.ownerOf(onC)).toBe('c');
        expect(c.net.isHidden(onC)).toBe(false);
      }
    });

    it('keeps the entities of a peer whose connection dropped while it is in range', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a');
      const b = await h.addPeer('b');
      h.hub.interestManagement = true;
      const box = adapter.addBox(a.world, adapter.at(0, 0.5));
      const prop = adapter.addBox(a.world, adapter.at(3, 0.5));
      await h.run(5);
      a.net.possess(box);
      b.position = null; // would not claim the prop either
      await h.run(30);
      b.net.transport.inStreamRange = () => true; // no link, but not because of the distance
      h.hub.cutLink('a', 'b');
      await h.run(OUT_OF_VIEW);
      expect(b.net.possessorOf(findByName(h, 'b', box.name))).toBe('a');
      expect(b.net.ownerOf(findByName(h, 'b', prop.name))).toBe('a');
    });

    it('never hands a Free runtime spawn to a peer out of view, which never built it', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a');
      const b = await h.addPeer('b');
      h.hub.cutStream('a', 'b');
      const box = adapter.addBox(a.world, adapter.at(0, 0.5));
      let transfers = 0;
      a.net.ownershipChanged$.subscribe(({ entity, to }) => entity === box && to !== 'a' && transfers++);
      // linked, but outside each other's stream ring: b is the one next to the box
      a.position = adapter.at(60, 0);
      b.position = adapter.at(2, 0);
      await h.run(400);
      expect(findByName(h, 'b', box.name)).toBeUndefined();
      expect(a.net.ownerOf(box)).toBe('a');
      expect(transfers).toBe(0);
    });

    it('shows hidden content where its owner left it when that owner hands it over', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const b = await h.addPeer('b', peer => void sharedBox(peer, 'car', adapter.at(0, 0.5)));
      const car = a.world.getEntityByName('car') as any;
      const replica = b.world.getEntityByName('car') as any;
      await h.run(5);
      a.net.possess(car);
      await h.run(30);
      h.hub.cutStream('a', 'b');
      await h.run(OUT_OF_VIEW);
      expect(b.net.isHidden(replica)).toBe(true);

      // parked far from where b last saw it, then its driver walks off and b comes next to it
      car.position = adapter.at(25, 0.5);
      await h.run(30);
      a.net.release(car);
      a.position = adapter.at(80, 0);
      b.position = adapter.at(25, 0);
      await h.run(200);
      expect(b.net.ownerOf(replica)).toBe('b');
      expect(findByName(h, 'b', 'car')).toBe(replica);
      expect(meters(replica.position, car.position)).toBeLessThan(0.5);
    });

    it('leaves everything alone on a transport without interest management', async () => {
      h = new Harness(adapter);
      const a = await h.addPeer('a');
      const b = await h.addPeer('b');
      const box = adapter.addBox(a.world, adapter.at(0, 0.5));
      await h.run(5);
      a.net.possess(box);
      await h.run(30);
      h.hub.cutLink('a', 'b'); // e.g. a dropped connection being retried
      await h.run(OUT_OF_VIEW);
      const replica = findByName(h, 'b', box.name);
      expect(replica).toBeDefined();
      expect(b.net.possessorOf(replica)).toBe('a');
    });
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
