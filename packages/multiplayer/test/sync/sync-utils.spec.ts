import { IEntity, TickOrder } from '@gg-web-engine/core';
import {
  AlwaysServerOwnership,
  ChunkAssembler,
  claimWins,
  ClockSync,
  frameMessage,
  LinkConditioner,
  LoopbackHub,
  NearestPeerOwnership,
  VirtualScheduler,
  WireMessage,
} from '../../src';

class Positioned extends IEntity {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  constructor(public position: { x: number; y: number; z?: number }) {
    super();
  }
}

describe('VirtualScheduler', () => {
  it('runs timers in due order only when advanced', () => {
    const s = new VirtualScheduler();
    const log: string[] = [];
    s.setTimeout(() => log.push('b'), 20);
    s.setTimeout(() => log.push('a'), 10);
    const interval = s.setInterval(() => log.push('i'), 15);
    expect(log).toEqual([]);
    s.advance(31);
    expect(log).toEqual(['a', 'i', 'b', 'i']);
    expect(s.now()).toBe(31);
    s.clearInterval(interval);
    s.advance(100);
    expect(log).toEqual(['a', 'i', 'b', 'i']);
    expect(s.pendingTimers).toBe(0);
  });
});

describe('LoopbackHub', () => {
  it('delivers JSON copies after the configured latency and reports peers', async () => {
    const s = new VirtualScheduler();
    const hub = new LoopbackHub(s, { latencyMs: 50 });
    const a = hub.createTransport('a');
    const b = hub.createTransport('b');
    await a.connect();
    await b.connect();
    expect(a.peers).toEqual(['b']);
    const received: { from: string; msg: WireMessage }[] = [];
    b.messages$.subscribe(m => received.push(m));
    const msg: WireMessage = { t: 'app', data: { n: 1 } };
    a.send('all', 'reliable', msg);
    s.advance(49);
    expect(received).toHaveLength(0);
    s.advance(1);
    expect(received).toEqual([{ from: 'a', msg: { t: 'app', data: { n: 1 } } }]);
    expect(received[0].msg).not.toBe(msg);
  });

  it('keeps reliable messages ordered under jitter and drops only unreliable ones on loss', async () => {
    const s = new VirtualScheduler();
    let r = 0;
    const randoms = [0.9, 0.1, 0.5, 0.0, 0.99, 0.3];
    const hub = new LoopbackHub(s, { latencyMs: 10, jitterMs: 100, lossRate: 0.5 }, () => randoms[r++ % randoms.length]);
    const a = hub.createTransport('a');
    const b = hub.createTransport('b');
    await a.connect();
    await b.connect();
    const got: number[] = [];
    b.messages$.subscribe(({ msg }) => got.push((msg as any).data));
    for (let i = 0; i < 3; i++) {
      a.send('b', 'reliable', { t: 'app', data: i });
    }
    s.advance(1000);
    expect(got).toEqual([0, 1, 2]);
  });

  it('partition silently cuts a peer off both ways', async () => {
    const s = new VirtualScheduler();
    const hub = new LoopbackHub(s);
    const a = hub.createTransport('a');
    const b = hub.createTransport('b');
    await a.connect();
    await b.connect();
    const got: string[] = [];
    a.messages$.subscribe(({ from }) => got.push(from));
    hub.partition('b');
    b.send('a', 'reliable', { t: 'heartbeat', pos: null });
    s.advance(10);
    expect(got).toEqual([]);
    expect(a.peers).toEqual(['b']); // nobody was told
    hub.heal('b');
    b.send('a', 'reliable', { t: 'heartbeat', pos: null });
    s.advance(10);
    expect(got).toEqual(['b']);
  });

  it('notifies peerLeft on a clean disconnect', async () => {
    const hub = new LoopbackHub(new VirtualScheduler());
    const a = hub.createTransport('a');
    const b = hub.createTransport('b');
    await a.connect();
    await b.connect();
    const left: string[] = [];
    a.peerLeft$.subscribe(id => left.push(id));
    b.disconnect();
    expect(left).toEqual(['b']);
    expect(a.peers).toEqual([]);
  });
});

describe('chunking', () => {
  it('passes small messages through as a single frame', () => {
    const frames = frameMessage({ t: 'app', data: 'x' }, 100);
    expect(frames).toHaveLength(1);
    expect(new ChunkAssembler().accept(JSON.parse(frames[0]))).toEqual({ t: 'app', data: 'x' });
  });

  it('splits and reassembles large messages, tolerating interleaving and out-of-order frames', () => {
    const big: WireMessage = { t: 'app', data: 'a'.repeat(1000) };
    const other: WireMessage = { t: 'app', data: 'b'.repeat(500) };
    const f1 = frameMessage(big, 64).map(f => JSON.parse(f));
    const f2 = frameMessage(other, 64).map(f => JSON.parse(f));
    expect(f1.length).toBeGreaterThan(10);
    const assembler = new ChunkAssembler();
    const results: WireMessage[] = [];
    const order = [...f1.slice(1), ...f2, f1[0]];
    for (const frame of order) {
      const done = assembler.accept(frame);
      if (done) {
        results.push(done);
      }
    }
    expect(results).toEqual([other, big]);
    expect(assembler.pending).toBe(0);
  });

  it('discards stale incomplete messages', () => {
    const frames = frameMessage({ t: 'app', data: 'a'.repeat(300) }, 64).map(f => JSON.parse(f));
    const assembler = new ChunkAssembler(1000);
    assembler.accept(frames[0], 0);
    assembler.accept(frameMessage({ t: 'app', data: 'z'.repeat(300) }, 64).map(f => JSON.parse(f))[0], 5000);
    expect(assembler.pending).toBe(1);
  });
});

describe('ClockSync', () => {
  it('estimates offset and rtt from four timestamps', () => {
    const clock = new ClockSync();
    // remote clock runs 1000 ms ahead, 20 ms each way, 2 ms processing
    clock.addSample(0, 1020, 1022, 42);
    expect(clock.offset).toBeCloseTo(1000);
    expect(clock.rtt).toBeCloseTo(40);
    expect(clock.toLocal(1500)).toBeCloseTo(500);
  });

  it('smooths later samples', () => {
    const clock = new ClockSync(0.5);
    clock.addSample(0, 1020, 1020, 40); // offset sample 1000
    clock.addSample(100, 1140, 1140, 140); // offset sample 1020
    expect(clock.offset).toBeCloseTo(1010);
  });
});

describe('ownership', () => {
  it('claimWins: higher epoch wins, equal epoch goes to the lexically smaller candidate', () => {
    expect(claimWins(3, 'b', 2, 'a')).toBe(true);
    expect(claimWins(1, 'a', 2, 'b')).toBe(false);
    expect(claimWins(2, 'a', 2, 'b')).toBe(true);
    expect(claimWins(2, 'c', 2, 'b')).toBe(false);
    expect(claimWins(0, 'z', 0, '')).toBe(true);
  });

  describe('NearestPeerOwnership', () => {
    const strategy = new NearestPeerOwnership<any>();
    const peers = (m: Record<string, any>) => new Map(Object.entries(m));

    it('keeps the owner within the floor distance', () => {
      const e = new Positioned({ x: 0, y: 0 });
      expect(strategy.proposeOwner(e, 'a', peers({ a: { x: 9, y: 0 }, b: { x: 0, y: 0 } }), null)).toBeNull();
    });

    it('hands over when a challenger is closer than half the distance and the owner is beyond the floor', () => {
      const e = new Positioned({ x: 0, y: 0 });
      expect(strategy.proposeOwner(e, 'a', peers({ a: { x: 30, y: 0 }, b: { x: 14, y: 0 } }), null)).toBe('b');
      expect(strategy.proposeOwner(e, 'a', peers({ a: { x: 30, y: 0 }, b: { x: 16, y: 0 } }), null)).toBeNull();
    });

    it('respects the transfer cooldown', () => {
      const e = new Positioned({ x: 0, y: 0 });
      const p = peers({ a: { x: 30, y: 0 }, b: { x: 1, y: 0 } });
      expect(strategy.proposeOwner(e, 'a', p, null, { msSinceLastTransfer: 100, msSinceLastContactClaim: Infinity })).toBeNull();
      expect(strategy.proposeOwner(e, 'a', p, null, { msSinceLastTransfer: 2000, msSinceLastContactClaim: Infinity })).toBe('b');
    });

    it('moves a Free entity off a peer with no position right away, and never to one', () => {
      const e = new Positioned({ x: 0, y: 0 });
      expect(strategy.proposeOwner(e, 'a', peers({ a: null, b: { x: 3, y: 0 }, c: null }), null)).toBe('b');
      expect(strategy.proposeOwner(e, '', peers({ a: null, b: null }), null)).toBeNull();
    });

    it('contact: claims on a hard hit by a possessed body, never on resting contact or within the cooldown', () => {
      const evt = (impulse: number) => ({ otherBody: null, position: {}, normal: {}, relativeVelocity: {}, impulse }) as any;
      const e = new Positioned({ x: 0, y: 0 });
      const ctx = { msSinceLastTransfer: Infinity, msSinceLastContactClaim: Infinity, localSpeed: 0, foreignSpeed: 0, estimatedImpulse: 0 };
      expect(strategy.onContact(e, evt(5), true, ctx)).toBe(true);
      expect(strategy.onContact(e, evt(0.1), true, ctx)).toBe(false);
      expect(strategy.onContact(e, evt(5), false, ctx)).toBe(false); // free body, not faster
      expect(strategy.onContact(e, evt(5), false, { ...ctx, localSpeed: 3, foreignSpeed: 1 })).toBe(true);
      expect(strategy.onContact(e, evt(5), true, { ...ctx, msSinceLastContactClaim: 10 })).toBe(false);
      // an adapter reporting no impulse on first contact falls back to the estimate
      expect(strategy.onContact(e, evt(0), true, { ...ctx, estimatedImpulse: 5 })).toBe(true);
    });
  });

  it('AlwaysServerOwnership always proposes the server', () => {
    const s = new AlwaysServerOwnership<any>('server');
    expect(s.proposeOwner(new Positioned({ x: 0, y: 0 }), 'a')).toBe('server');
    expect(s.proposeOwner(new Positioned({ x: 0, y: 0 }), 'server')).toBeNull();
    expect(s.onContact()).toBe(false);
  });
});

describe('LinkConditioner', () => {
  it('delays delivery and drops unreliable messages at the configured rate', () => {
    const s = new VirtualScheduler();
    let r = 0;
    const c = new LinkConditioner(s, () => [0.1, 0.9][r++ % 2]);
    const got: string[] = [];
    c.pass('reliable', () => got.push('direct'));
    expect(got).toEqual(['direct']);
    c.latencyMs = 100;
    c.lossRate = 0.5;
    c.pass('unreliable', () => got.push('dropped')); // random 0.1 < 0.5
    c.pass('unreliable', () => got.push('kept')); // random 0.9
    c.pass('reliable', () => got.push('reliable'));
    s.advance(99);
    expect(got).toEqual(['direct']);
    s.advance(1);
    expect(got).toEqual(['direct', 'kept', 'reliable']);
  });
});
