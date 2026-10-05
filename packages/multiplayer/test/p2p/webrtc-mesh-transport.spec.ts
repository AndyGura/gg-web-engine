import {
  buildRoomUrl,
  generatePeerId,
  generateRoomId,
  getRoomIdFromUrl,
  isValidRoomId,
  VirtualScheduler,
  WebRtcMeshTransport,
  WireMessage,
  withinRing,
  ZoneTracker,
} from '../../src';
import { FakeRTCPeerConnection, InMemorySignalingHub, settle } from './fakes';

const makeTransport = (
  hub: InMemorySignalingHub,
  id: string,
  extra: Partial<ConstructorParameters<typeof WebRtcMeshTransport>[0]> = {},
) =>
  new WebRtcMeshTransport({
    signaling: hub.create(),
    roomId: 'room',
    localPeerId: id,
    rtcPeerConnection: FakeRTCPeerConnection as any,
    connectTimeoutMs: 1000,
    ...extra,
  });

describe('room URL helpers', () => {
  it('generates and validates UUID v4 room ids', () => {
    const id = generateRoomId();
    expect(isValidRoomId(id)).toBe(true);
    expect(isValidRoomId('not-a-room')).toBe(false);
    expect(generatePeerId()).toMatch(/^[0-9a-z]{8}$/);
  });

  it('reads and writes ?room= without touching the rest of the URL', () => {
    const id = generateRoomId();
    const url = buildRoomUrl(id, 'room', 'https://example.com/sub/path/?mode=mp#x');
    expect(url).toBe(`https://example.com/sub/path/?mode=mp&room=${id}#x`);
    expect(getRoomIdFromUrl('room', url)).toBe(id);
    expect(getRoomIdFromUrl('room', 'https://example.com/?room=garbage')).toBeNull();
  });
});

describe('zoning', () => {
  it('maps positions to cells with hysteresis at the boundaries', () => {
    const z = new ZoneTracker({ cellSize: 100, hysteresis: 0.1, connectRadius: 2, streamRadius: 1, ageOutMs: 0 });
    expect(z.update({ x: 50, y: 50 })).toBe('0:0');
    expect(z.update({ x: 105, y: 50 })).toBe('0:0'); // inside the 10 m margin
    expect(z.update({ x: 111, y: 50 })).toBe('1:0');
    expect(z.update({ x: 95, y: 50 })).toBe('1:0');
    expect(z.update({ x: 89, y: -1 })).toBe('0:-1');
    expect(z.update(null)).toBe('0:-1'); // no position (hidden, spectating): stays where last seen
    expect(new ZoneTracker().update(null)).toBe(''); // never placed: in every ring
  });

  it('rings use Chebyshev distance; an unknown cell is in every ring', () => {
    expect(withinRing('0:0', '2:-2', 2)).toBe(true);
    expect(withinRing('0:0', '3:0', 2)).toBe(false);
    expect(withinRing('0:0', '1:1', 1)).toBe(true);
    expect(withinRing('', '50:50', 1)).toBe(true);
  });
});

describe('WebRtcMeshTransport', () => {
  beforeEach(() => {
    FakeRTCPeerConnection.instances = [];
  });

  it('connects a full mesh, the smaller id offering, and delivers on both channels', async () => {
    const hub = new InMemorySignalingHub();
    const a = makeTransport(hub, 'a');
    const b = makeTransport(hub, 'b');
    const c = makeTransport(hub, 'c');
    await a.connect();
    await Promise.all([b.connect(), c.connect()]);
    await settle();
    expect([...a.peers].sort()).toEqual(['b', 'c']);
    expect([...b.peers].sort()).toEqual(['a', 'c']);
    expect([...c.peers].sort()).toEqual(['a', 'b']);
    expect(FakeRTCPeerConnection.instances).toHaveLength(6); // 3 pairs x 2 ends

    const got: { from: string; msg: WireMessage }[] = [];
    b.messages$.subscribe(m => got.push(m));
    a.send('b', 'reliable', { t: 'app', data: 1 });
    a.send('all', 'unreliable', { t: 'state', items: [] });
    await settle();
    expect(got).toEqual([
      { from: 'a', msg: { t: 'app', data: 1 } },
      { from: 'a', msg: { t: 'state', items: [] } },
    ]);
    expect(b.setupTimes.has('a')).toBe(true);
  });

  it('drops an unreliable message while the channel send buffer is backed up, never a reliable one', async () => {
    const hub = new InMemorySignalingHub();
    const a = makeTransport(hub, 'a', { unreliableBufferLimit: 1000 });
    const b = makeTransport(hub, 'b');
    await a.connect();
    await b.connect();
    await settle();
    const got: WireMessage[] = [];
    b.messages$.subscribe(m => got.push(m.msg));
    // the offering side (a) created the channels
    const channels = FakeRTCPeerConnection.instances.flatMap(pc => pc.channels).filter(c => c.sent !== undefined);
    const backUp = (bytes: number) => channels.forEach(c => (c.bufferedAmount = bytes));
    backUp(1001);
    a.send('b', 'unreliable', { t: 'state', items: [] });
    a.send('b', 'unreliable', { t: 'ping', t0: 1 });
    a.send('b', 'reliable', { t: 'app', data: 1 });
    await settle();
    expect(got).toEqual([{ t: 'app', data: 1 }]);
    expect(a.droppedUnreliable).toBe(2);
    backUp(1000);
    a.send('b', 'unreliable', { t: 'ping', t0: 2 });
    await settle();
    expect(got).toEqual([
      { t: 'app', data: 1 },
      { t: 'ping', t0: 2 },
    ]);
  });

  it('sends to a list of peers, serializing the message once', async () => {
    const hub = new InMemorySignalingHub();
    const a = makeTransport(hub, 'a');
    const b = makeTransport(hub, 'b');
    const c = makeTransport(hub, 'c');
    const d = makeTransport(hub, 'd');
    await a.connect();
    await Promise.all([b.connect(), c.connect(), d.connect()]);
    await settle();
    const got: string[] = [];
    for (const t of [b, c, d]) {
      t.messages$.subscribe(() => got.push(t.localPeerId));
    }
    const stringify = jest.spyOn(JSON, 'stringify');
    a.send(['b', 'c'], 'unreliable', { t: 'state', items: [] });
    expect(stringify).toHaveBeenCalledTimes(1);
    stringify.mockRestore();
    await settle();
    expect(got.sort()).toEqual(['b', 'c']);
  });

  it('chunks large reliable messages and splits large state messages by items', async () => {
    const hub = new InMemorySignalingHub();
    const a = makeTransport(hub, 'a', { chunkSize: 200 });
    const b = makeTransport(hub, 'b', { chunkSize: 200 });
    await a.connect();
    await b.connect();
    await settle();
    const got: WireMessage[] = [];
    b.messages$.subscribe(({ msg }) => got.push(msg));
    const big: WireMessage = { t: 'app', data: 'x'.repeat(2000) };
    a.send('b', 'reliable', big);
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      owner: 'a',
      epoch: 0,
      seq: 1,
      ts: 0,
      s: { p: i },
    }));
    a.send('b', 'unreliable', { t: 'state', items, n: 7 });
    await settle(60);
    expect(got[0]).toEqual(big);
    const stateMsgs = got.slice(1) as Extract<WireMessage, { t: 'state' }>[];
    expect(stateMsgs.length).toBeGreaterThan(1);
    expect(stateMsgs.flatMap(m => m.items)).toEqual(items);
    expect(stateMsgs.every(m => m.n === 7)).toBe(true); // every part keeps the message counter
  });

  it('reports a peer that leaves the room', async () => {
    const hub = new InMemorySignalingHub();
    const a = makeTransport(hub, 'a');
    const b = makeTransport(hub, 'b');
    await a.connect();
    await b.connect();
    await settle();
    const left: string[] = [];
    a.peerLeft$.subscribe(id => left.push(id));
    b.disconnect();
    await settle(40);
    expect(left).toEqual(['b']);
    expect(a.peers).toEqual([]);
  });

  it('a failed signaling join leaves the transport disconnected, so connect() can be retried', async () => {
    const hub = new InMemorySignalingHub();
    const a = makeTransport(hub, 'a');
    await a.connect();
    const signaling = hub.create();
    const join = signaling.join.bind(signaling);
    signaling.join = jest.fn().mockRejectedValueOnce(new Error('sign-in failed')).mockImplementation(join);
    const b = makeTransport(hub, 'b', { signaling });
    await expect(b.connect()).rejects.toThrow('sign-in failed');
    await b.connect();
    await settle();
    expect(signaling.join).toHaveBeenCalledTimes(2);
    expect(b.peers).toEqual(['a']);
  });

  it('disconnect() while connecting resolves connect() without waiting for its timeout', async () => {
    const hub = new InMemorySignalingHub();
    const scheduler = new VirtualScheduler();
    await hub.create().join('room', 'z'); // present, but never answers an offer
    const b = makeTransport(hub, 'b', { scheduler });
    let done = false;
    const connecting = b.connect().then(() => (done = true));
    await settle();
    expect(done).toBe(false);
    b.disconnect();
    await connecting;
    expect(b.peers).toEqual([]);
  });

  it('reconnects with exponential backoff while the peer is still present', async () => {
    const hub = new InMemorySignalingHub();
    const scheduler = new VirtualScheduler();
    const a = makeTransport(hub, 'a', { scheduler, reconnectBaseDelayMs: 1000 });
    const b = makeTransport(hub, 'b', { scheduler, reconnectBaseDelayMs: 1000 });
    const connecting = Promise.all([a.connect(), b.connect()]);
    await settle();
    scheduler.advance(10);
    await connecting;
    await settle();
    expect(a.peers).toEqual(['b']);
    const pc = FakeRTCPeerConnection.instances.find(p => p.remote)!;
    pc.fail();
    await settle();
    expect(a.peers).toEqual([]);
    scheduler.advance(999);
    await settle();
    expect(a.peers).toEqual([]);
    scheduler.advance(1);
    await settle(40);
    expect(a.peers).toEqual(['b']);
    expect(b.peers).toEqual(['a']);
  });

  it('with zoning, reconnects to a peer that left the connect ring before its retry and came back', async () => {
    const hub = new InMemorySignalingHub();
    const scheduler = new VirtualScheduler();
    const zoning = { cellSize: 100, ageOutMs: 10_000 };
    const a = makeTransport(hub, 'a', { scheduler, zoning, reconnectBaseDelayMs: 1000 });
    const b = makeTransport(hub, 'b', { scheduler, zoning, reconnectBaseDelayMs: 1000 });
    a.updateLocalPosition({ x: 50, y: 50 });
    b.updateLocalPosition({ x: 150, y: 50 });
    const all = Promise.all([a.connect(), b.connect()]);
    for (let i = 0; i < 5; i++) {
      await settle();
      scheduler.advance(10);
    }
    await all;
    await settle(40);
    expect(a.peers).toEqual(['b']);
    FakeRTCPeerConnection.instances.find(p => p.remote)!.fail();
    await settle();
    b.updateLocalPosition({ x: 900, y: 50 }); // out of a's connect ring before the retry fires
    await settle(40);
    scheduler.advance(1000);
    await settle(40);
    expect(a.peers).toEqual([]);
    b.updateLocalPosition({ x: 150, y: 50 });
    await settle(40);
    expect(a.peers).toEqual(['b']);
  });

  it('with zoning, connects within the 5x5 ring, streams within 3x3, and ages out far peers', async () => {
    const hub = new InMemorySignalingHub();
    const scheduler = new VirtualScheduler();
    const zoning = { cellSize: 100, ageOutMs: 10_000 };
    const mk = (id: string) => makeTransport(hub, id, { scheduler, zoning });
    const a = mk('a');
    const b = mk('b');
    const c = mk('c');
    a.updateLocalPosition({ x: 50, y: 50 }); // 0:0
    b.updateLocalPosition({ x: 150, y: 50 }); // 1:0 - stream ring
    c.updateLocalPosition({ x: 250, y: 50 }); // 2:0 - connect ring only
    const all = Promise.all([a.connect(), b.connect(), c.connect()]);
    for (let i = 0; i < 5; i++) {
      await settle();
      scheduler.advance(10);
    }
    await all;
    await settle(40);
    expect([...a.peers].sort()).toEqual(['b', 'c']);
    expect([...(a.streamTargets() ?? [])].sort()).toEqual(['b']);
    expect(a.inStreamRange('b')).toBe(true);
    expect(a.inStreamRange('c')).toBe(false);
    expect(a.inStreamRange('nobody')).toBe(true); // not in the room: not a matter of distance
    const left: string[] = [];
    a.peerLeft$.subscribe(id => left.push(id));

    c.updateLocalPosition({ x: 900, y: 50 }); // 9:0 - outside a's connect ring
    await settle(40);
    scheduler.advance(5000);
    await settle(40);
    expect([...a.peers].sort()).toEqual(['b', 'c']); // not aged out yet
    scheduler.advance(6000);
    await settle(40);
    expect(a.peers).toEqual(['b']);
    expect(left).toEqual([]); // out of range, still in the room

    c.disconnect(); // leaving the room while out of range is still a departure
    await settle(40);
    expect(left).toEqual(['c']);
  });
});
