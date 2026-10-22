import { BehaviorSubject, distinctUntilChanged, map, Observable } from 'rxjs';
import { generateRoomId } from '../p2p/room-url';
import {
  ILobbyBackend,
  LobbyJoinError,
  LobbyMemberRecord,
  LobbyRoomInfo,
  LobbyRoomSnapshot,
  LobbyWrite,
} from './lobby-backend';

/** Options of {@link BroadcastChannelLobbyBackend}. */
export interface BroadcastChannelLobbyBackendOptions {
  /** name of the channel every tab of the directory shares. Default `'gg-web-engine-lobby'`. */
  channelName?: string;
  /** how often each tab re-announces its members, ms. Default 1000. */
  heartbeatMs?: number;
  /** a member not heard from for this long is gone, ms. Default 3 heartbeats. */
  expiryMs?: number;
  /**
   * how long a join (and a result write) listens for other tabs before deciding, ms - other tabs
   * answer a newcomer's announcement within it. Default 300.
   */
  settleMs?: number;
}

type Versioned<T> = { value: T; at: number; by: string };
type ResultEntry = { round: string; value: unknown; by: string; at: number };

/** the room's records every tab replicates; merged last-writer-wins (results: first-writer-wins) */
interface SharedRecords {
  info: LobbyRoomInfo | null;
  state: Versioned<unknown> | null;
  match: Versioned<{ id: string; roster: string[] } | null> | null;
  start: Versioned<{ round: string; at: number } | null> | null;
  results: [string, ResultEntry][];
}

interface Replica {
  info: LobbyRoomInfo | null;
  members: Map<string, { record: LobbyMemberRecord; seenAt: number; own: boolean }>;
  /** joins in progress: they count against the capacity of joins that started after them */
  claims: Map<string, { joinedAt: number; seenAt: number }>;
  state: Versioned<unknown> | null;
  match: Versioned<{ id: string; roster: string[] } | null> | null;
  start: Versioned<{ round: string; at: number } | null> | null;
  results: Map<string, ResultEntry>;
}

type ChannelMessage =
  | { kind: 'hello' }
  | { kind: 'room'; roomId: string; shared: SharedRecords; member: LobbyMemberRecord | null }
  | { kind: 'claim'; roomId: string; peerId: string; joinedAt: number }
  | { kind: 'bye'; roomId: string; peerId: string };

const newer = (a: Versioned<unknown> | null, b: Versioned<unknown> | null): boolean =>
  !!a && (!b || a.at > b.at || (a.at === b.at && a.by > b.by));

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * `ILobbyBackend` over the browser's `BroadcastChannel`: rooms shared by the tabs of one browser
 * (same origin) with no backend at all - pair it with `BroadcastChannelSignaling` to test a lobby
 * locally in two tabs. Every tab keeps a replica of every room it hears of; a tab announces its own
 * members every `heartbeatMs` (and says goodbye on `pagehide`), and a member silent for `expiryMs`
 * is gone. Time is the local clock, which every tab of the browser shares (`serverTimeOffset$` is
 * 0). A join announces itself, listens for `settleMs`, and goes in only if the members plus the
 * joins that started before it leave a free place, so two tabs never take the last place both.
 */
export class BroadcastChannelLobbyBackend implements ILobbyBackend {
  private readonly channelName: string;
  private readonly heartbeatMs: number;
  private readonly expiryMs: number;
  private readonly settleMs: number;
  private channel: BroadcastChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private readonly replicas = new Map<string, Replica>();
  private readonly _rooms$ = new BehaviorSubject<ReadonlyArray<LobbyRoomSnapshot>>([]);
  private readonly _connected$ = new BehaviorSubject<boolean>(true);
  private readonly _serverTimeOffset$ = new BehaviorSubject<number>(0);
  private readonly onPageHide = () => this.sayGoodbye();

  constructor(options: BroadcastChannelLobbyBackendOptions = {}) {
    this.channelName = options.channelName ?? 'gg-web-engine-lobby';
    this.heartbeatMs = options.heartbeatMs ?? 1000;
    this.expiryMs = options.expiryMs ?? this.heartbeatMs * 3;
    this.settleMs = options.settleMs ?? 300;
  }

  get rooms$(): Observable<ReadonlyArray<LobbyRoomSnapshot>> {
    this.open();
    return this._rooms$.asObservable();
  }

  room$(roomId: string): Observable<LobbyRoomSnapshot | null> {
    return this.rooms$.pipe(
      map(rooms => rooms.find(r => r.roomId === roomId) ?? null),
      distinctUntilChanged(),
    );
  }

  get connected$(): Observable<boolean> {
    return this._connected$.asObservable();
  }

  get serverTimeOffset$(): Observable<number> {
    return this._serverTimeOffset$.asObservable();
  }

  async createRoom(info: Omit<LobbyRoomInfo, 'createdAt'>, member: { peerId: string; data: unknown }): Promise<string> {
    this.open();
    const roomId = generateRoomId();
    const now = Date.now();
    const replica = this.replica(roomId);
    replica.info = { ...info, createdAt: now };
    replica.members.set(member.peerId, {
      record: { peerId: member.peerId, joinedAt: now, data: member.data, ready: null },
      seenAt: now,
      own: true,
    });
    this.announce(roomId, member.peerId);
    this.publish();
    return roomId;
  }

  async joinRoom(roomId: string, member: { peerId: string; data: unknown }): Promise<void> {
    this.open();
    this.post({ kind: 'hello' });
    await sleep(this.settleMs);
    this.check(roomId);
    const joinedAt = Date.now();
    this.replica(roomId).claims.set(member.peerId, { joinedAt, seenAt: joinedAt });
    this.post({ kind: 'claim', roomId, peerId: member.peerId, joinedAt });
    await sleep(this.settleMs);
    const replica = this.replicas.get(roomId);
    replica?.claims.delete(member.peerId);
    try {
      const room = this.check(roomId);
      const ahead =
        room.members.size +
        [...room.claims].filter(([id, c]) => c.joinedAt < joinedAt || (c.joinedAt === joinedAt && id < member.peerId))
          .length;
      if (ahead >= room.info!.capacity) {
        throw new LobbyJoinError('full');
      }
    } catch (e) {
      this.post({ kind: 'bye', roomId, peerId: member.peerId });
      throw e;
    }
    const now = Date.now();
    replica!.members.set(member.peerId, {
      record: { peerId: member.peerId, joinedAt, data: member.data, ready: null },
      seenAt: now,
      own: true,
    });
    this.announce(roomId, member.peerId);
    this.publish();
  }

  async leaveRoom(roomId: string, peerId: string): Promise<void> {
    const replica = this.replicas.get(roomId);
    if (replica?.members.get(peerId)?.own) {
      replica.members.delete(peerId);
      this.post({ kind: 'bye', roomId, peerId });
      this.prune();
      this.publish();
    }
  }

  async write(roomId: string, peerId: string, write: LobbyWrite): Promise<void> {
    const replica = this.replicas.get(roomId);
    const member = replica?.members.get(peerId);
    if (!replica || !member?.own) {
      return;
    }
    const stamp = <T>(prev: Versioned<unknown> | null, value: T): Versioned<T> => ({
      value,
      at: Math.max(Date.now(), (prev?.at ?? 0) + 1),
      by: peerId,
    });
    switch (write.kind) {
      case 'member':
        member.record = { ...member.record, data: write.data };
        break;
      case 'ready':
        member.record = { ...member.record, ready: write.round };
        break;
      case 'state':
        replica.state = stamp(replica.state, write.value);
        break;
      case 'match':
        replica.match = stamp(replica.match, write.match);
        break;
      case 'start':
        replica.start = stamp(replica.start, write.start);
        break;
    }
    this.announce(roomId, peerId);
    this.publish();
  }

  async writeResult(roomId: string, peerId: string, round: string, subject: string, value: unknown): Promise<boolean> {
    const replica = this.replicas.get(roomId);
    if (!replica?.members.get(peerId)?.own) {
      return false;
    }
    if (replica.results.get(subject)?.round === round) {
      return false;
    }
    const entry: ResultEntry = { round, value, by: peerId, at: Date.now() };
    replica.results.set(subject, entry);
    this.announce(roomId, peerId);
    this.publish();
    // another tab may have written one at the same moment: the earliest wins on every tab
    await sleep(this.settleMs);
    const kept = this.replicas.get(roomId)?.results.get(subject);
    return !!kept && kept.by === entry.by && kept.at === entry.at && kept.round === round;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.sayGoodbye();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (typeof removeEventListener === 'function') {
      removeEventListener('pagehide', this.onPageHide);
    }
    this.channel?.close();
    this.channel = null;
    this.replicas.clear();
    this._rooms$.next([]);
    this._rooms$.complete();
    this._connected$.complete();
    this._serverTimeOffset$.complete();
  }

  private open(): void {
    if (this.channel || this.disposed) {
      return;
    }
    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('BroadcastChannelLobbyBackend: BroadcastChannel is not available in this environment');
    }
    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = event => this.onMessage(event.data as ChannelMessage);
    this.timer = setInterval(() => this.onHeartbeat(), this.heartbeatMs);
    if (typeof addEventListener === 'function') {
      addEventListener('pagehide', this.onPageHide);
    }
    this.post({ kind: 'hello' });
  }

  /** the room as a join sees it: it must exist, have members and no match */
  private check(roomId: string): Replica {
    const replica = this.replicas.get(roomId);
    if (!replica?.info || replica.members.size === 0) {
      throw new LobbyJoinError('not-found');
    }
    if (replica.match?.value) {
      throw new LobbyJoinError('started');
    }
    return replica;
  }

  private onHeartbeat(): void {
    for (const [roomId, replica] of this.replicas) {
      for (const [peerId, m] of replica.members) {
        if (m.own) {
          this.announce(roomId, peerId);
        }
      }
    }
    this.prune();
    this.publish();
  }

  private sayGoodbye(): void {
    for (const [roomId, replica] of this.replicas) {
      for (const [peerId, m] of replica.members) {
        if (m.own) {
          this.post({ kind: 'bye', roomId, peerId });
        }
      }
    }
  }

  /** drop members and joins not heard from for `expiryMs`, and rooms left without members */
  private prune(): void {
    const cutoff = Date.now() - this.expiryMs;
    for (const [roomId, replica] of this.replicas) {
      for (const [peerId, m] of replica.members) {
        if (!m.own && m.seenAt < cutoff) {
          replica.members.delete(peerId);
        }
      }
      for (const [peerId, c] of replica.claims) {
        if (c.seenAt < cutoff) {
          replica.claims.delete(peerId);
        }
      }
      if (replica.members.size === 0 && replica.claims.size === 0) {
        this.replicas.delete(roomId);
      }
    }
  }

  private replica(roomId: string): Replica {
    let replica = this.replicas.get(roomId);
    if (!replica) {
      replica = {
        info: null,
        members: new Map(),
        claims: new Map(),
        state: null,
        match: null,
        start: null,
        results: new Map(),
      };
      this.replicas.set(roomId, replica);
    }
    return replica;
  }

  /** post one own member's record with everything this tab knows of its room */
  private announce(roomId: string, peerId: string): void {
    const replica = this.replicas.get(roomId);
    const member = replica?.members.get(peerId);
    if (!replica || !member) {
      return;
    }
    this.post({
      kind: 'room',
      roomId,
      member: member.record,
      shared: {
        info: replica.info,
        state: replica.state,
        match: replica.match,
        start: replica.start,
        results: [...replica.results],
      },
    });
  }

  private post(msg: ChannelMessage): void {
    this.channel?.postMessage(JSON.parse(JSON.stringify(msg)));
  }

  private onMessage(msg: ChannelMessage): void {
    if (this.disposed) {
      return;
    }
    switch (msg.kind) {
      case 'hello':
        for (const [roomId, replica] of this.replicas) {
          for (const [peerId, m] of replica.members) {
            if (m.own) {
              this.announce(roomId, peerId);
            }
          }
        }
        return;
      case 'room': {
        const replica = this.replica(msg.roomId);
        this.merge(replica, msg.shared);
        if (msg.member && !replica.members.get(msg.member.peerId)?.own) {
          replica.members.set(msg.member.peerId, { record: msg.member, seenAt: Date.now(), own: false });
          replica.claims.delete(msg.member.peerId);
        }
        break;
      }
      case 'claim': {
        const replica = this.replicas.get(msg.roomId);
        if (replica) {
          replica.claims.set(msg.peerId, { joinedAt: msg.joinedAt, seenAt: Date.now() });
        }
        return;
      }
      case 'bye': {
        const replica = this.replicas.get(msg.roomId);
        if (replica && !replica.members.get(msg.peerId)?.own) {
          replica.members.delete(msg.peerId);
          replica.claims.delete(msg.peerId);
          this.prune();
        }
        break;
      }
    }
    this.publish();
  }

  private merge(replica: Replica, shared: SharedRecords): void {
    replica.info = replica.info ?? shared.info;
    if (newer(shared.state, replica.state)) {
      replica.state = shared.state;
    }
    if (newer(shared.match, replica.match)) {
      replica.match = shared.match;
    }
    if (newer(shared.start, replica.start)) {
      replica.start = shared.start;
    }
    for (const [subject, incoming] of shared.results) {
      const known = replica.results.get(subject);
      const wins = !known
        ? true
        : known.round === incoming.round
          ? incoming.at < known.at || (incoming.at === known.at && incoming.by < known.by)
          : incoming.at > known.at;
      if (wins) {
        replica.results.set(subject, incoming);
      }
    }
  }

  private publish(): void {
    if (this.disposed) {
      return;
    }
    const rooms: LobbyRoomSnapshot[] = [];
    for (const [roomId, r] of this.replicas) {
      if (!r.info || r.members.size === 0) {
        continue;
      }
      rooms.push({
        roomId,
        info: r.info,
        members: [...r.members.values()].map(m => m.record),
        state: r.state && r.state.value != null ? { value: r.state.value, by: r.state.by } : null,
        match: r.match?.value ? { ...r.match.value, by: r.match.by } : null,
        start: r.start?.value ? { ...r.start.value, by: r.start.by } : null,
        results: [...r.results].map(([subject, e]) => ({ subject, round: e.round, value: e.value, by: e.by })),
      });
    }
    this._rooms$.next(rooms);
  }
}
