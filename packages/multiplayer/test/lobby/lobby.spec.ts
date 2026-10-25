import { BroadcastChannel as NodeBroadcastChannel } from 'worker_threads';
import { firstValueFrom, skip } from 'rxjs';
import {
  BroadcastChannelLobbyBackend,
  FirebaseLobbyBackend,
  LobbyJoinError,
  RoomDirectory,
  RoomListing,
} from '../../src';
import { fakeFirebase } from '../stubs/firebase';
import { settle } from '../p2p/fakes';

// jsdom has no BroadcastChannel; node's has the browser's semantics (no delivery to the sender)
if (typeof (globalThis as any).BroadcastChannel === 'undefined') {
  (globalThis as any).BroadcastChannel = NodeBroadcastChannel;
}

jest.setTimeout(20_000);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until(condition: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('condition not met in time');
    }
    await sleep(5);
  }
}

type Player = { name: string };

describe('RoomDirectory and Lobby over BroadcastChannelLobbyBackend', () => {
  let channel = 0;
  const backends: BroadcastChannelLobbyBackend[] = [];
  let channelName = '';

  /** one browser tab: its own backend and directory */
  const tab = () => {
    const backend = new BroadcastChannelLobbyBackend({ channelName, heartbeatMs: 40, settleMs: 40 });
    backends.push(backend);
    const directory = new RoomDirectory<Player, { track: string }, { mode: string }>(backend);
    let rooms: ReadonlyArray<RoomListing<{ mode: string }>> = [];
    directory.rooms$.subscribe(r => (rooms = r));
    return { backend, directory, rooms: () => rooms };
  };

  beforeEach(() => {
    channelName = `lobby-test-${++channel}`;
  });

  afterEach(() => {
    backends.splice(0).forEach(b => b.dispose());
  });

  it('lists rooms, admits members and elects the senior one host', async () => {
    const t1 = tab();
    const t2 = tab();
    const host = await t1.directory.createRoom({
      name: 'Night race',
      capacity: 4,
      meta: { mode: 'circuit' },
      member: { name: 'Ann' },
    });
    expect(host.isHost).toBe(true);
    await until(() => t2.rooms().length === 1);
    expect(t2.rooms()[0]).toMatchObject({
      roomId: host.roomId,
      name: 'Night race',
      capacity: 4,
      memberCount: 1,
      meta: { mode: 'circuit' },
      started: false,
      joinable: true,
    });

    const guest = await t2.directory.joinRoom(host.roomId, { member: { name: 'Bob' } });
    expect(guest.localPeerId).not.toBe(host.localPeerId);
    await until(() => host.members.length === 2);
    expect(host.members.map(m => m.data)).toEqual([{ name: 'Ann' }, { name: 'Bob' }]);
    expect(guest.host).toBe(host.localPeerId);
    expect(guest.isHost).toBe(false);
    expect(guest.info).toMatchObject({ name: 'Night race', capacity: 4, meta: { mode: 'circuit' } });
    await until(() => t1.rooms()[0]?.memberCount === 2);

    await guest.setMemberData({ name: 'Bobby' });
    await until(() => host.members[1]?.data?.name === 'Bobby');

    // the host leaves: the next senior member hosts
    const nextHost = firstValueFrom(guest.isHost$.pipe(skip(1)));
    await host.leave();
    expect(host.closed).toBe('left');
    expect(await nextHost).toBe(true);
    expect(guest.members.map(m => m.peerId)).toEqual([guest.localPeerId]);
    expect(t1.directory.lobby).toBeNull();
  });

  it('never admits more than the capacity, also for joins at the same moment', async () => {
    const t1 = tab();
    const host = await t1.directory.createRoom({ name: 'Duel', capacity: 2 });
    const t2 = tab();
    const t3 = tab();
    await until(() => t2.rooms().length === 1 && t3.rooms().length === 1);
    const outcomes = await Promise.allSettled([t2.directory.joinRoom(host.roomId), t3.directory.joinRoom(host.roomId)]);
    const joined = outcomes.filter(o => o.status === 'fulfilled');
    const refused = outcomes.filter(o => o.status === 'rejected') as PromiseRejectedResult[];
    expect(joined).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toBeInstanceOf(LobbyJoinError);
    expect(refused[0].reason.reason).toBe('full');
    await sleep(200);
    expect(host.members).toHaveLength(2);
    expect(t1.rooms()[0]).toMatchObject({ memberCount: 2, joinable: false });
    await expect(tab().directory.joinRoom('3f2b6a4e-1b2c-4d5e-8f90-123456789abc')).rejects.toMatchObject({
      reason: 'not-found',
    });
  });

  it('serializes joins: a double click joins once and returns the same lobby', async () => {
    const t1 = tab();
    const host = await t1.directory.createRoom({ name: 'Room', capacity: 8 });
    const t2 = tab();
    const [a, b] = await Promise.all([t2.directory.joinRoom(host.roomId), t2.directory.joinRoom(host.roomId)]);
    expect(a).toBe(b);
    await until(() => host.members.length === 2);
    await sleep(100);
    expect(host.members).toHaveLength(2);
    // joining another room leaves this one first
    const other = await t1.directory.createRoom({ name: 'Other', capacity: 8 });
    expect(host.closed).toBe('left');
    await until(() => a.members.length === 1);
    expect(a.isHost).toBe(true);
    expect(t1.directory.lobby).toBe(other);
  });

  it('shares host-written state, locks the roster at the start and refuses joins during a match', async () => {
    const t1 = tab();
    const t2 = tab();
    const host = await t1.directory.createRoom({ name: 'Room', capacity: 8 });
    const guest = await t2.directory.joinRoom(host.roomId);
    await until(() => host.members.length === 2);

    expect(await guest.setState({ track: 'guest pick' })).toBe(false);
    expect(await host.setState({ track: 'alpine' })).toBe(true);
    await until(() => guest.state?.track === 'alpine');

    expect(await guest.startMatch()).toBeNull();
    const match = (await host.startMatch())!;
    expect(match.roster).toEqual([host.localPeerId, guest.localPeerId]);
    await until(() => guest.match?.id === match.id);
    expect(guest.match!.roster).toEqual(match.roster);
    const t3 = tab();
    await until(() => t3.rooms()[0]?.started === true);
    expect(t3.rooms()[0].joinable).toBe(false);
    await expect(t3.directory.joinRoom(host.roomId)).rejects.toMatchObject({ reason: 'started' });

    expect(await host.endMatch()).toBe(true);
    await until(() => guest.match === null && t3.rooms()[0]?.started === false);
    const late = await t3.directory.joinRoom(host.roomId);
    await until(() => host.members.length === 3);
    expect(late.state).toEqual({ track: 'alpine' });
  });

  it('ready barrier over the roster, start time on the shared clock, results written once', async () => {
    const t1 = tab();
    const t2 = tab();
    const t3 = tab();
    const host = await t1.directory.createRoom({ name: 'Room', capacity: 8 });
    const b = await t2.directory.joinRoom(host.roomId);
    const c = await t3.directory.joinRoom(host.roomId);
    await until(() => host.members.length === 3 && b.members.length === 3);
    const match = (await host.startMatch())!;
    const round = `${match.id}:0`;
    await until(() => b.match !== null && c.match !== null);

    const allReady = host.waitForReady(round, 5000);
    await host.setReady(round);
    await b.setReady('previous round');
    await c.setReady(round);
    await until(() => host.readiness(round).ready.length === 2);
    expect(host.readiness(round)).toEqual({
      ready: [host.localPeerId, c.localPeerId],
      waiting: [b.localPeerId],
      complete: false,
    });
    await b.setReady(round);
    expect(await allReady).toMatchObject({ complete: true, waiting: [] });

    // a roster member that leaves is no longer waited for
    const round2 = `${match.id}:1`;
    await host.setReady(round2);
    await b.setReady(round2);
    await c.leave();
    expect(await host.waitForReady(round2, 2000)).toMatchObject({ complete: true });
    expect(await host.waitForReady('never', 50)).toMatchObject({ complete: false, ready: [] });

    expect(host.serverNow()).toBeCloseTo(Date.now(), -2);
    const at = host.serverNow() + 3000;
    expect(await b.scheduleStart(round, at)).toBe(false);
    const startsAt = firstValueFrom(b.startsAt$(round).pipe(skip(1)));
    expect(await host.scheduleStart(round, at)).toBe(true);
    expect(await startsAt).toBe(Math.round(at));
    expect(b.serverTimeOffset).toBe(0);

    // two members record the same racer at once: one write counts, on every tab
    const writes = await Promise.all([
      host.writeResult(round, b.localPeerId, { time: 61.2 }),
      b.writeResult(round, b.localPeerId, { time: 99 }),
    ]);
    expect(writes.filter(Boolean)).toHaveLength(1);
    await sleep(100);
    expect(host.results(round)).toEqual(b.results(round));
    expect(await host.writeResult(round, b.localPeerId, { time: 1 })).toBe(false);
    // the next round replaces it
    expect(await host.writeResult(round2, b.localPeerId, { dnf: true })).toBe(true);
    await until(() => b.results(round2)[b.localPeerId] !== undefined);
    expect(b.results(round)).toEqual({});
  });

  it('drops a member whose tab went silent, and ends a match nobody of its roster is left in', async () => {
    const t1 = tab();
    const t2 = tab();
    const host = await t1.directory.createRoom({ name: 'Room', capacity: 8 });
    const guest = await t2.directory.joinRoom(host.roomId);
    await until(() => host.members.length === 2);
    await host.startMatch();
    await until(() => guest.match !== null);
    // the host's tab freezes for good: no goodbye, no heartbeat
    clearInterval((t1.backend as any).timer);
    (t1.backend as any).channel.close();
    (t1.backend as any).channel = null;
    await until(() => guest.members.length === 1, 2000);
    // the guest hosts now; the match's roster still has it, so the match stays
    expect(guest.isHost).toBe(true);
    expect(guest.match).not.toBeNull();

    // a room whose roster is gone entirely is a lobby again
    const t3 = tab();
    const t4 = tab();
    const room = await t3.directory.createRoom({ name: 'Other', capacity: 8 });
    const late = await t4.directory.joinRoom(room.roomId);
    await until(() => room.members.length === 2);
    await (room as any).backend.write(room.roomId, room.localPeerId, {
      kind: 'match',
      match: { id: 'old', roster: ['gone1', 'gone2'] },
    });
    await until(() => late.match === null && room.match === null, 2000);
  });
});

describe('FirebaseLobbyBackend (fake Firebase)', () => {
  const config = { apiKey: 'k', projectId: 'p', databaseURL: 'https://p.firebaseio.com' };

  beforeEach(() => {
    fakeFirebase.reset();
    fakeFirebase.write('.info/connected', true);
    fakeFirebase.write('.info/serverTimeOffset', 250);
  });

  /** a client: its own uid, backend and directory */
  const client = () => {
    const uid = fakeFirebase.asNewClient();
    const backend = new FirebaseLobbyBackend({ config });
    const directory = new RoomDirectory<Player>(backend);
    return { uid, backend, directory };
  };

  it('creates a room in one write, with the removal of its records registered on disconnect', async () => {
    const a = client();
    fakeFirebase.state.serverTime = 1000;
    const lobby = await a.directory.createRoom({
      name: 'Room',
      capacity: 2,
      meta: { mode: 'x' },
      member: { name: 'Ann' },
    });
    await settle();
    const room = fakeFirebase.read(`gg-lobby/${lobby.roomId}`);
    expect(room.info).toEqual({ name: 'Room', capacity: 2, meta: '{"mode":"x"}', createdAt: 1000, uid: a.uid });
    expect(room.members[lobby.localPeerId]).toEqual({ uid: a.uid, joinedAt: 1000, data: '{"name":"Ann"}' });
    expect(room.seats).toEqual({ 0: { peer: lobby.localPeerId, uid: a.uid } });
    expect(lobby.isHost).toBe(true);
    expect(lobby.serverNow() - Date.now()).toBeGreaterThanOrEqual(249);

    let rooms: ReadonlyArray<RoomListing> = [];
    a.directory.rooms$.subscribe(r => (rooms = r));
    await settle();
    expect(rooms).toMatchObject([{ roomId: lobby.roomId, name: 'Room', memberCount: 1, meta: { mode: 'x' } }]);

    // the tab closes without leaving: the server removes its records, a viewer removes the empty room
    fakeFirebase.disconnect(a.uid);
    await settle();
    expect(fakeFirebase.read(`gg-lobby/${lobby.roomId}/members`)).toBeNull();
    expect(fakeFirebase.read(`gg-lobby/${lobby.roomId}`)).toBeNull();
    expect(rooms).toEqual([]);
  });

  it('takes seats by transaction within the capacity, and frees a seat whose holder is gone', async () => {
    const a = client();
    fakeFirebase.state.serverTime = 1000;
    const host = await a.directory.createRoom({ name: 'Room', capacity: 2 });
    const b = client();
    fakeFirebase.state.serverTime = 2000;
    const guest = await b.directory.joinRoom(host.roomId, { member: { name: 'Bob' } });
    await settle();
    expect(fakeFirebase.read(`gg-lobby/${host.roomId}/seats/1`)).toEqual({ peer: guest.localPeerId, uid: b.uid });
    expect(host.members.map(m => m.peerId)).toEqual([host.localPeerId, guest.localPeerId]);
    expect(guest.host).toBe(host.localPeerId);

    const c = client();
    await expect(c.directory.joinRoom(host.roomId)).rejects.toMatchObject({ reason: 'full' });

    // b's tab closes without leaving: the server removes its member record and its seat
    fakeFirebase.disconnect(b.uid);
    await settle();
    expect(fakeFirebase.read(`gg-lobby/${host.roomId}/seats/1`)).toBeNull();
    expect(host.members).toHaveLength(1);
    expect(guest.closed).toBe('lost');

    // a seat left behind by a tab that closed before it registered the seat's removal: nobody
    // counts it, and the next join frees it
    fakeFirebase.write(`gg-lobby/${host.roomId}/seats/1`, { peer: 'ghost', uid: 'uid-gone' });
    await settle();
    expect(host.members).toHaveLength(1);
    const d = client();
    const late = await d.directory.joinRoom(host.roomId);
    await settle();
    expect(fakeFirebase.read(`gg-lobby/${host.roomId}/seats/1`)).toEqual({ peer: late.localPeerId, uid: d.uid });
    expect(host.members.map(m => m.peerId)).toEqual([host.localPeerId, late.localPeerId]);
  });

  it('a member record without a seat is not a member: a join the room refuses removes it', async () => {
    const a = client();
    const host = await a.directory.createRoom({ name: 'Room', capacity: 3 });
    await host.startMatch();
    await settle();
    const b = client();
    await expect(b.directory.joinRoom(host.roomId)).rejects.toMatchObject({ reason: 'started' });
    await host.endMatch();
    await settle();
    // the rules refuse the seat: the member record written first is not listed, and is removed
    fakeFirebase.state.denyTransactions = true;
    const memberCounts: number[] = [];
    host.members$.subscribe(m => memberCounts.push(m.length));
    await expect(b.directory.joinRoom(host.roomId)).rejects.toThrow('PERMISSION_DENIED');
    await settle();
    expect(Object.keys(fakeFirebase.read(`gg-lobby/${host.roomId}/members`))).toEqual([host.localPeerId]);
    expect(memberCounts.every(n => n === 1)).toBe(true);
    expect(b.directory.lobby).toBeNull();
  });

  it('writes a result once per round by transaction, and leaves removing its records', async () => {
    const a = client();
    fakeFirebase.state.serverTime = 1000;
    const host = await a.directory.createRoom({ name: 'Room', capacity: 3 });
    const b = client();
    fakeFirebase.state.serverTime = 2000;
    const guest = await b.directory.joinRoom(host.roomId);
    await settle();
    expect(await guest.writeResult('m:0', guest.localPeerId, { time: 70 })).toBe(true);
    expect(await host.writeResult('m:0', guest.localPeerId, { time: 1 })).toBe(false);
    await settle();
    expect(host.results('m:0')).toEqual({ [guest.localPeerId]: { time: 70 } });
    expect(await host.writeResult('m:1', guest.localPeerId, { dnf: true })).toBe(true);
    await expect(host.writeResult('m:1', 'bad/subject', 1)).rejects.toThrow('subject');

    expect(await host.scheduleStart('m:1', 5000)).toBe(true);
    await settle();
    expect(await firstValueFrom(guest.startsAt$('m:1'))).toBe(5000);

    await guest.leave();
    await settle();
    expect(fakeFirebase.read(`gg-lobby/${host.roomId}/members/${guest.localPeerId}`)).toBeNull();
    expect(fakeFirebase.read(`gg-lobby/${host.roomId}/seats/1`)).toBeNull();
    await host.leave();
    await settle();
    expect(fakeFirebase.read(`gg-lobby/${host.roomId}`)).toBeNull();
  });

  it('a lost connection closes the lobby and makes it stop hosting', async () => {
    const a = client();
    const host = await a.directory.createRoom({ name: 'Room', capacity: 3 });
    await settle();
    expect(host.isHost).toBe(true);
    let reason: string | null = null;
    host.closed$.subscribe(r => (reason = r));
    fakeFirebase.write('.info/connected', false);
    await settle();
    expect(reason).toBe('lost');
    expect(host.isHost).toBe(false);
    expect(await host.setState({})).toBe(false);
    expect(a.directory.lobby).toBeNull();
  });
});
