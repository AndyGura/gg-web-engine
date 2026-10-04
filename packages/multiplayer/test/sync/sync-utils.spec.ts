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
    const hub = new LoopbackHub(
      s,
      { latencyMs: 10, jitterMs: 100, lossRate: 0.5 },
      () => randoms[r++ % randoms.length],
    );
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
  const TRUE_OFFSET = 5000;
  // one exchange: ping sent at local `t0`, legs taking `out` and `back` ms
  const exchange = (clock: ClockSync, t0: number, out: number, back: number) =>
    clock.addSample(t0, t0 + out + TRUE_OFFSET, t0 + out + TRUE_OFFSET, t0 + out + back);
  const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it('estimates offset and rtt from four timestamps', () => {
    const clock = new ClockSync();
    // remote clock runs 1000 ms ahead, 20 ms each way, 2 ms processing
    clock.addSample(0, 1020, 1022, 42);
    expect(clock.offset).toBeCloseTo(1000);
    expect(clock.rtt).toBeCloseTo(40);
    expect(clock.toLocal(1500)).toBeCloseTo(500);
    expect(clock.toRemote(500)).toBeCloseTo(1500);
  });

  it('is ready only after the minimum number of samples', () => {
    const clock = new ClockSync({ minSamples: 3 });
    exchange(clock, 0, 20, 20);
    exchange(clock, 100, 20, 20);
    expect(clock.ready).toBe(false);
    exchange(clock, 200, 20, 20);
    expect(clock.ready).toBe(true);
    expect(clock.samples).toBe(3);
  });

  it('ignores a sample with one leg delayed by 400 ms', () => {
    const clock = new ClockSync();
    for (let i = 0; i < 5; i++) {
      exchange(clock, i * 150, 40, 40);
    }
    const before = clock.offset;
    exchange(clock, 2000, 440, 40); // would read 200 ms off
    clock.advance(4000);
    expect(Math.abs(clock.offset - before)).toBeLessThan(2);
    expect(clock.rtt).toBeCloseTo(80);
    exchange(clock, 4000, 40, 440);
    clock.advance(6000);
    expect(Math.abs(clock.offset - TRUE_OFFSET)).toBeLessThan(2);
  });

  it('corrects a first sample that is 150 ms off within the connect burst', () => {
    const clock = new ClockSync();
    exchange(clock, 0, 340, 40); // the handler stamping t1 was stalled for 300 ms
    expect(Math.abs(clock.offset - TRUE_OFFSET)).toBeCloseTo(150);
    for (let i = 1; i < 5; i++) {
      exchange(clock, i * 150, 40, 40);
    }
    expect(clock.ready).toBe(true);
    expect(Math.abs(clock.offset - TRUE_OFFSET)).toBeLessThan(1);
  });

  it('slews toward a changed estimate once ready, never steps', () => {
    const clock = new ClockSync({ slewMsPerSecond: 5 });
    for (let i = 0; i < 3; i++) {
      exchange(clock, i * 150, 60, 20); // every sample reads 20 ms off
    }
    expect(clock.offset).toBeCloseTo(TRUE_OFFSET + 20);
    exchange(clock, 1000, 20, 20); // a better sample: the estimate moves by 20 ms
    expect(clock.targetOffset).toBeCloseTo(TRUE_OFFSET);
    expect(clock.offset).toBeCloseTo(TRUE_OFFSET + 20);
    clock.advance(2040);
    expect(clock.offset).toBeCloseTo(TRUE_OFFSET + 15);
    clock.advance(10_000);
    expect(clock.offset).toBeCloseTo(TRUE_OFFSET);
  });

  it('applies a gross error at once', () => {
    const clock = new ClockSync();
    for (let i = 0; i < 5; i++) {
      exchange(clock, i * 150, 20, 20);
    }
    // the remote clock jumped an hour ahead (its machine slept)
    clock.addSample(5000, 5020 + TRUE_OFFSET + 3_600_000, 5020 + TRUE_OFFSET + 3_600_000, 5040);
    expect(clock.offset).toBeCloseTo(TRUE_OFFSET + 3_600_000);
  });

  it('takes late, reordered and duplicate pongs', () => {
    const clock = new ClockSync();
    exchange(clock, 300, 20, 20);
    exchange(clock, 0, 20, 20); // the pong of an earlier ping arrives after a later one
    exchange(clock, 0, 20, 20); // twice
    expect(clock.samples).toBe(2);
    clock.addSample(600, NaN, NaN, 640);
    clock.addSample(900, 0, 0, 800); // "received" before it was sent
    expect(clock.samples).toBe(2);
    expect(clock.offset).toBeCloseTo(TRUE_OFFSET);
  });

  it('stays within a few ms of the true offset under jitter and loss, moving no faster than the slew rate', () => {
    const slew = 5;
    const clock = new ClockSync({ slewMsPerSecond: slew });
    const s = new VirtualScheduler();
    const random = mulberry32(7);
    const leg = () => 40 + (random() * 2 - 1) * 15;
    const ping = () => {
      if (random() < 0.02) {
        return; // lost on the way out
      }
      const t0 = s.now();
      const out = leg();
      const back = leg();
      const lostBack = random() < 0.02;
      s.setTimeout(() => {
        const t1 = s.now() + TRUE_OFFSET;
        if (!lostBack) {
          s.setTimeout(() => clock.addSample(t0, t1, t1, s.now()), back);
        }
      }, out);
    };
    for (let i = 0; i < 5; i++) {
      s.setTimeout(ping, i * 150);
    }
    s.advance(1000);
    expect(clock.ready).toBe(true);
    s.setInterval(ping, 2000);
    let worst = 0;
    clock.advance(s.now());
    let last = clock.offset;
    for (let t = 0; t < 300_000; t += 100) {
      s.advance(100);
      clock.advance(s.now());
      expect(Math.abs(clock.offset - last)).toBeLessThanOrEqual((slew * 100) / 1000 + 1e-6);
      last = clock.offset;
      worst = Math.max(worst, Math.abs(clock.offset - TRUE_OFFSET));
    }
    expect(clock.samples).toBeGreaterThan(100);
    expect(worst).toBeLessThan(8);
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
      expect(
        strategy.proposeOwner(e, 'a', p, null, { msSinceLastTransfer: 100, msSinceLastContactClaim: Infinity }),
      ).toBeNull();
      expect(
        strategy.proposeOwner(e, 'a', p, null, { msSinceLastTransfer: 2000, msSinceLastContactClaim: Infinity }),
      ).toBe('b');
    });

    it('moves a Free entity off a peer with no position right away, and never to one', () => {
      const e = new Positioned({ x: 0, y: 0 });
      expect(strategy.proposeOwner(e, 'a', peers({ a: null, b: { x: 3, y: 0 }, c: null }), null)).toBe('b');
      expect(strategy.proposeOwner(e, '', peers({ a: null, b: null }), null)).toBeNull();
    });

    it('contact: claims on a hard hit by a possessed body, never on resting contact or within the cooldown', () => {
      const evt = (impulse: number) =>
        ({ otherBody: null, position: {}, normal: {}, relativeVelocity: {}, impulse }) as any;
      const e = new Positioned({ x: 0, y: 0 });
      const ctx = {
        msSinceLastTransfer: Infinity,
        msSinceLastContactClaim: Infinity,
        localSpeed: 0,
        foreignSpeed: 0,
        estimatedImpulse: 0,
      };
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

  it('jitters the delay around the latency', () => {
    const s = new VirtualScheduler();
    let r = 0;
    const c = new LinkConditioner(s, () => [0, 1, 0.5][r++ % 3]);
    c.latencyMs = 40;
    c.jitterMs = 15;
    const at: number[] = [];
    for (let i = 0; i < 3; i++) {
      c.pass('unreliable', () => at.push(s.now()));
    }
    s.advance(100);
    expect(at).toEqual([25, 40, 55]);
    expect(c.describe()).toBe('40 ms, 0% loss, +-15 ms jitter');
  });

  it('holds everything back during a stall and delivers it in one burst', () => {
    const s = new VirtualScheduler();
    const c = new LinkConditioner(s);
    c.stallMs = 300;
    c.stallIntervalMs = 1000;
    const at: number[] = [];
    s.advance(900);
    for (let i = 0; i < 5; i++) {
      c.pass(i % 2 ? 'reliable' : 'unreliable', () => at.push(s.now())); // at 900, 1000, 1100, 1200, 1300
      s.advance(100);
    }
    s.advance(1000);
    expect(at).toEqual([900, 1300, 1300, 1300, 1300]);
  });

  it('delays some reliable messages, holding back the later ones of that sender only', () => {
    const s = new VirtualScheduler();
    let r = 0;
    const c = new LinkConditioner(s, () => [0.01, 0.9, 0.9, 0.9][r++ % 4]);
    c.reliableDelayRate = 0.05;
    c.reliableDelayMs = 400;
    const got: string[] = [];
    c.pass('reliable', () => got.push('a1'), 'a'); // delayed
    c.pass('reliable', () => got.push('a2'), 'a');
    c.pass('reliable', () => got.push('b1'), 'b');
    c.pass('unreliable', () => got.push('a-state'), 'a');
    expect(got).toEqual(['b1', 'a-state']);
    c.reset(); // a clean link again still keeps the order of what is in flight
    c.pass('reliable', () => got.push('a3'), 'a');
    s.advance(399);
    expect(got).toEqual(['b1', 'a-state']);
    s.advance(1);
    expect(got).toEqual(['b1', 'a-state', 'a1', 'a2', 'a3']);
    c.pass('reliable', () => got.push('a4'), 'a');
    expect(got[got.length - 1]).toBe('a4');
    expect((c as any).reliableTail.size).toBe(0); // nothing is remembered about a sender with nothing in flight
  });
});
