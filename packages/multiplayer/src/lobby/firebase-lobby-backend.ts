import { FirebaseApp } from 'firebase/app';
import {
  Database,
  get,
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { generateRoomId } from '../p2p/room-url';
import { FirebaseConnectionOptions, resolveFirebaseApp, signInToFirebase } from '../p2p/firebase-signaling';
import {
  ILobbyBackend,
  LobbyJoinError,
  LobbyMemberRecord,
  LobbyResultRecord,
  LobbyRoomInfo,
  LobbyRoomSnapshot,
  LobbyWrite,
} from './lobby-backend';

/** Options of {@link FirebaseLobbyBackend}. */
export interface FirebaseLobbyBackendOptions extends FirebaseConnectionOptions {
  /** database path all lobby rooms live under. Default `'gg-lobby'`. */
  rootPath?: string;
}

const SUBJECT = /^[0-9A-Za-z_-]{1,64}$/;

const parseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const toJson = (value: unknown): string => JSON.stringify(value ?? null);

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** The database returns an array, or an object with index keys when it is sparse. */
const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []).filter(
    (v): v is string => typeof v === 'string',
  );

/** a seat counts when its key is an index below the capacity and its member record is the seat holder's */
const seatHolders = (room: any, capacity: number): Map<string, string> => {
  const holders = new Map<string, string>();
  for (const [key, seat] of Object.entries<any>(room?.seats ?? {})) {
    const index = Number(key);
    const member = room?.members?.[seat?.peer];
    if (String(index) === key && index >= 0 && index < capacity && member && member.uid === seat.uid) {
      holders.set(seat.peer, key);
    }
  }
  return holders;
};

/** a room as the database holds it, see the class doc */
function parseFirebaseLobbyRoom(roomId: string, room: any): LobbyRoomSnapshot | null {
  if (!room?.info) {
    return null;
  }
  const info: LobbyRoomInfo = {
    name: str(room.info.name),
    capacity: num(room.info.capacity),
    meta: parseJson(room.info.meta),
    createdAt: num(room.info.createdAt),
  };
  const members: LobbyMemberRecord[] = [...seatHolders(room, info.capacity).keys()].map(peerId => {
    const m = room.members[peerId];
    return {
      peerId,
      joinedAt: num(m.joinedAt),
      data: parseJson(m.data),
      ready: typeof m.ready === 'string' ? m.ready : null,
    };
  });
  const results: LobbyResultRecord[] = Object.entries<any>(room.results ?? {})
    .filter(([, r]) => r && typeof r.round === 'string')
    .map(([subject, r]) => ({ subject, round: r.round, value: parseJson(r.value), by: str(r.by) }));
  return {
    roomId,
    info,
    members,
    state:
      room.state && typeof room.state.value === 'string'
        ? { value: parseJson(room.state.value), by: str(room.state.by) }
        : null,
    match: room.match ? { id: str(room.match.id), roster: strings(room.match.roster), by: str(room.match.by) } : null,
    start:
      room.start && typeof room.start.round === 'string'
        ? { round: room.start.round, at: num(room.start.at), by: str(room.start.by) }
        : null,
    results,
  };
}

/**
 * `ILobbyBackend` on Firebase Realtime Database, next to `FirebaseSignaling` in the same project
 * (same anonymous auth, same app). Data layout, all under `rootPath` (default `gg-lobby`):
 *
 * - `{room}/info` - `{ name, capacity, meta, createdAt, uid }`, written once by the creator
 * - `{room}/members/{peerId}` - `{ uid, joinedAt, data, ready? }`, written by that member only
 * - `{room}/seats/{index}` - `{ peer, uid }`: one per admitted member, taken by a transaction, so
 *   two joins never take the same place; `index < capacity`
 * - `{room}/state` - `{ by, value }`, `{room}/match` - `{ by, id, roster }`, `{room}/start` -
 *   `{ by, round, at }`: the host's records
 * - `{room}/results/{subject}` - `{ by, round, value }`, written by a transaction that commits only
 *   when the subject has no result of that round yet
 *
 * App values (`meta`, `data`, `state`, results) are stored as JSON strings, so any JSON survives the
 * database (which drops empty objects and `null`s and refuses some key characters). A member counts
 * only with a seat whose holder is its record; a record without one is a join in progress or one
 * that failed. Both nodes are removed by `onDisconnect()`: the member record's removal is
 * registered before the record is written, the seat's as soon as the transaction took it - a seat
 * left behind in between (its member record gone) is free for the next join, which removes it. A room
 * left without member records is removed by whoever lists the rooms. The rules the client relies on
 * are in the package README.
 */
export class FirebaseLobbyBackend implements ILobbyBackend {
  private readonly app: FirebaseApp;
  private readonly db: Database;
  private readonly rootPath: string;
  private uid: string | null = null;
  private infoUnsubscribers: (() => void)[] | null = null;
  /** `roomId/peerId` → seat key, of the members joined from here */
  private readonly ownSeats = new Map<string, string>();
  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  private readonly _serverTimeOffset$ = new BehaviorSubject<number>(0);

  constructor(options: FirebaseLobbyBackendOptions = {}) {
    this.app = resolveFirebaseApp(options, 'FirebaseLobbyBackend');
    this.db = getDatabase(this.app);
    this.rootPath = options.rootPath ?? 'gg-lobby';
  }

  get rooms$(): Observable<ReadonlyArray<LobbyRoomSnapshot>> {
    return this.listen(this.rootPath, value => {
      const rooms: LobbyRoomSnapshot[] = [];
      for (const [roomId, room] of Object.entries<any>(value ?? {})) {
        const parsed = parseFirebaseLobbyRoom(roomId, room);
        if (parsed && parsed.members.length > 0) {
          rooms.push(parsed);
        } else if (room && !room.members) {
          // abandoned (the last member's tab closed): the rules let anybody remove a room without members
          void remove(ref(this.db, `${this.rootPath}/${roomId}`)).catch(() => undefined);
        }
      }
      return rooms;
    });
  }

  room$(roomId: string): Observable<LobbyRoomSnapshot | null> {
    return this.listen(`${this.rootPath}/${roomId}`, value => parseFirebaseLobbyRoom(roomId, value));
  }

  get connected$(): Observable<boolean> {
    this.watchInfo();
    return this._connected$.asObservable();
  }

  get serverTimeOffset$(): Observable<number> {
    this.watchInfo();
    return this._serverTimeOffset$.asObservable();
  }

  async createRoom(info: Omit<LobbyRoomInfo, 'createdAt'>, member: { peerId: string; data: unknown }): Promise<string> {
    const uid = await this.signIn();
    const roomId = generateRoomId();
    const base = `${this.rootPath}/${roomId}`;
    // registered before anything is written (removing a node that doesn't exist is allowed): a tab
    // closed in between leaves nothing behind
    await onDisconnect(ref(this.db, `${base}/members/${member.peerId}`)).remove();
    await onDisconnect(ref(this.db, `${base}/seats/0`)).remove();
    // one write: the room is never seen without its creator
    await set(ref(this.db, base), {
      info: { name: info.name, capacity: info.capacity, meta: toJson(info.meta), createdAt: serverTimestamp(), uid },
      members: { [member.peerId]: { uid, joinedAt: serverTimestamp(), data: toJson(member.data) } },
      seats: { 0: { peer: member.peerId, uid } },
    });
    this.ownSeats.set(`${roomId}/${member.peerId}`, '0');
    return roomId;
  }

  async joinRoom(roomId: string, member: { peerId: string; data: unknown }): Promise<void> {
    const uid = await this.signIn();
    const base = `${this.rootPath}/${roomId}`;
    const room = (await get(ref(this.db, base))).val();
    const parsed = parseFirebaseLobbyRoom(roomId, room);
    if (!parsed) {
      throw new LobbyJoinError('not-found');
    }
    if (parsed.match) {
      throw new LobbyJoinError('started');
    }
    const capacity = parsed.info.capacity;
    if (parsed.members.length >= capacity) {
      throw new LobbyJoinError('full');
    }
    // seats whose member record is gone: their holder's tab closed before it armed their removal
    const held = seatHolders(room, capacity);
    await Promise.all(
      Object.entries<any>(room.seats ?? {})
        .filter(([key, seat]) => held.get(seat?.peer) !== key)
        .map(([key]) => remove(ref(this.db, `${base}/seats/${key}`)).catch(() => undefined)),
    );
    const memberRef = ref(this.db, `${base}/members/${member.peerId}`);
    await onDisconnect(memberRef).remove();
    try {
      await set(memberRef, { uid, joinedAt: serverTimestamp(), data: toJson(member.data) });
    } catch (e) {
      throw await this.refusal(roomId, e);
    }
    const taken = new Set(held.values());
    for (let index = 0; index < capacity; index++) {
      if (taken.has(String(index))) {
        continue;
      }
      const seatRef = ref(this.db, `${base}/seats/${index}`);
      let committed: boolean;
      try {
        committed = (
          await runTransaction(seatRef, current => (current === null ? { peer: member.peerId, uid } : undefined))
        ).committed;
      } catch (e) {
        await remove(memberRef).catch(() => undefined);
        throw await this.refusal(roomId, e);
      }
      if (committed) {
        await onDisconnect(seatRef).remove();
        this.ownSeats.set(`${roomId}/${member.peerId}`, String(index));
        return;
      }
    }
    await remove(memberRef).catch(() => undefined);
    throw new LobbyJoinError('full');
  }

  async leaveRoom(roomId: string, peerId: string): Promise<void> {
    const base = `${this.rootPath}/${roomId}`;
    const seat = this.ownSeats.get(`${roomId}/${peerId}`);
    this.ownSeats.delete(`${roomId}/${peerId}`);
    // both removals are sent before anything is awaited: the tab may close right after. The
    // onDisconnect removals stay registered - harmless once the nodes are gone
    await Promise.all([
      remove(ref(this.db, `${base}/members/${peerId}`)),
      seat !== undefined ? remove(ref(this.db, `${base}/seats/${seat}`)) : Promise.resolve(),
    ]);
    const rest = (await get(ref(this.db, `${base}/members`))).val();
    if (!rest) {
      await remove(ref(this.db, base)).catch(() => undefined);
    }
  }

  async write(roomId: string, peerId: string, write: LobbyWrite): Promise<void> {
    const base = `${this.rootPath}/${roomId}`;
    switch (write.kind) {
      case 'member':
        await update(ref(this.db, `${base}/members/${peerId}`), { data: toJson(write.data) });
        break;
      case 'ready':
        await set(ref(this.db, `${base}/members/${peerId}/ready`), write.round);
        break;
      case 'state':
        await set(
          ref(this.db, `${base}/state`),
          write.value == null ? null : { by: peerId, value: toJson(write.value) },
        );
        break;
      case 'match':
        await set(
          ref(this.db, `${base}/match`),
          write.match ? { by: peerId, id: write.match.id, roster: write.match.roster } : null,
        );
        break;
      case 'start':
        await set(ref(this.db, `${base}/start`), write.start ? { by: peerId, ...write.start } : null);
        break;
    }
  }

  async writeResult(roomId: string, peerId: string, round: string, subject: string, value: unknown): Promise<boolean> {
    if (!SUBJECT.test(subject)) {
      throw new Error(`FirebaseLobbyBackend: result subject "${subject}" must match ${SUBJECT}`);
    }
    const result = await runTransaction(ref(this.db, `${this.rootPath}/${roomId}/results/${subject}`), current =>
      current === null || current.round !== round ? { by: peerId, round, value: toJson(value) } : undefined,
    );
    return result.committed;
  }

  dispose(): void {
    for (const key of [...this.ownSeats.keys()]) {
      const [roomId, peerId] = key.split('/');
      void this.leaveRoom(roomId, peerId).catch(() => undefined);
    }
    for (const unsubscribe of this.infoUnsubscribers ?? []) {
      unsubscribe();
    }
    this.infoUnsubscribers = null;
    this._connected$.complete();
    this._serverTimeOffset$.complete();
  }

  /** what a refused write means for a join */
  private async refusal(roomId: string, error: unknown): Promise<unknown> {
    const room = parseFirebaseLobbyRoom(
      roomId,
      (await get(ref(this.db, `${this.rootPath}/${roomId}`)).catch(() => null))?.val(),
    );
    if (!room) {
      return new LobbyJoinError('not-found');
    }
    if (room.match) {
      return new LobbyJoinError('started');
    }
    return error;
  }

  private watchInfo(): void {
    if (this.infoUnsubscribers) {
      return;
    }
    this.infoUnsubscribers = [
      onValue(ref(this.db, '.info/connected'), snapshot => this._connected$.next(snapshot.val() === true)),
      onValue(ref(this.db, '.info/serverTimeOffset'), snapshot => {
        const offset = snapshot.val();
        this._serverTimeOffset$.next(typeof offset === 'number' ? offset : 0);
      }),
    ];
  }

  /** an observable of `path`'s value, signed in first (the rules require auth for every read) */
  private listen<T>(path: string, project: (value: any) => T): Observable<T> {
    return new Observable<T>(subscriber => {
      let unsubscribe: (() => void) | null = null;
      let closed = false;
      this.signIn()
        .then(() => {
          if (!closed) {
            unsubscribe = onValue(
              ref(this.db, path),
              snapshot => subscriber.next(project(snapshot.val())),
              error => subscriber.error(error),
            );
          }
        })
        .catch(error => subscriber.error(error));
      return () => {
        closed = true;
        unsubscribe?.();
      };
    });
  }

  private async signIn(): Promise<string> {
    if (!this.uid) {
      this.uid = await signInToFirebase(this.app);
    }
    return this.uid;
  }
}
