import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  ReplaySubject,
  Subscription,
} from 'rxjs';
import { generatePeerId } from '../p2p/room-url';
import {
  ILobbyBackend,
  LobbyMatchRecord,
  LobbyMemberRecord,
  LobbyRoomInfo,
  LobbyRoomSnapshot,
  LobbyWrite,
} from './lobby-backend';

/** A member of a {@link Lobby}. */
export type LobbyMember<D = unknown> = LobbyMemberRecord<D>;

/** A started match: its id and the roster the host locked. */
export type LobbyMatch = LobbyMatchRecord;

/** Who is ready for a round, see {@link Lobby.readiness}. */
export interface LobbyReadiness {
  /** expected peers that declared themselves ready for the round */
  ready: string[];
  /** expected peers that didn't (yet) */
  waiting: string[];
  /** nobody is waiting (and somebody is expected) */
  complete: boolean;
}

/**
 * Why a lobby closed: `'left'` - {@link Lobby.leave} (or the backend was disposed); `'lost'` - the
 * local member is no longer in the room without having left it (the connection to the backend
 * dropped, so the backend removed the member, or the room is gone).
 */
export type LobbyCloseReason = 'left' | 'lost';

const sameJson = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

const bySeniority = (a: LobbyMemberRecord, b: LobbyMemberRecord): number =>
  a.joinedAt - b.joinedAt || (a.peerId < b.peerId ? -1 : a.peerId > b.peerId ? 1 : 0);

/**
 * The room the local peer is in, made by {@link RoomDirectory.createRoom}/`joinRoom`: who else is
 * in it, who hosts, the host's shared state, the match roster, a ready barrier, a start time every
 * member sees at the same moment, and results written once.
 *
 * - **Host** = the senior member: earliest `joinedAt` (backend time), ties by peer id. Every member
 *   computes it from the same records, so they agree without electing anything; when the host leaves,
 *   the next senior member is host. {@link isHost} is pessimistic: `false` while the backend is
 *   unreachable.
 * - **Shared state** is host-written: {@link setState} succeeds on the host only and replaces the whole
 *   value; everybody reads it on {@link state$}. A member's own data (a name, a pick) goes in its
 *   member record ({@link setMemberData}), which only that member writes.
 * - **Match**: {@link startMatch} (host) locks the roster - the members right now, senior first - and
 *   from then on the room admits nobody until {@link endMatch}. Build the game from `match.roster`,
 *   never from the live member list, which a join or leave racing the start would make differ
 *   between peers. A roster peer that is no longer a member has left.
 * - **Rounds**: readiness, the scheduled start and results are keyed by a round string the game
 *   chooses (e.g. `` `${match.id}:${raceIndex}` ``), so nothing of a previous round is ever taken for
 *   the current one.
 *
 * Every write made after the lobby closed is ignored.
 */
export class Lobby<D = unknown, S = unknown, M = unknown> {
  private readonly snapshot$ = new BehaviorSubject<LobbyRoomSnapshot | null>(null);
  private readonly connectedSubject$ = new BehaviorSubject<boolean>(false);
  private readonly _closed$ = new ReplaySubject<LobbyCloseReason>(1);
  private readonly subscriptions: Subscription[] = [];
  private serverOffset = 0;
  private present = false;
  private closedReason: LobbyCloseReason | null = null;
  private endingStaleMatch: string | null = null;

  /**
   * Made by {@link RoomDirectory}; construct one directly only over a membership the backend already
   * admitted.
   * @param onClose called once when the lobby closes
   */
  constructor(
    private readonly backend: ILobbyBackend,
    public readonly roomId: string,
    public readonly localPeerId: string,
    private readonly onClose?: (lobby: Lobby<D, S, M>) => void,
  ) {
    this.subscriptions.push(
      backend.connected$.subscribe(connected => {
        const was = this.connectedSubject$.getValue();
        this.connectedSubject$.next(connected);
        if (was && !connected) {
          // the backend removes a member whose connection dropped (onDisconnect): this one is gone
          this.close('lost');
        }
      }),
      backend.serverTimeOffset$.subscribe(offset => (this.serverOffset = offset)),
      backend.room$(roomId).subscribe({
        next: snapshot => this.onSnapshot(snapshot),
        complete: () => this.close('left'),
      }),
    );
  }

  /** emits once, when the lobby closes */
  get closed$(): Observable<LobbyCloseReason> {
    return this._closed$.asObservable();
  }

  /** why the lobby closed, `null` while open */
  get closed(): LobbyCloseReason | null {
    return this.closedReason;
  }

  /** the room's name, capacity and metadata (`null` until the first snapshot) */
  get info(): LobbyRoomInfo<M> | null {
    return (this.snapshot$.getValue()?.info as LobbyRoomInfo<M>) ?? null;
  }

  /** the members, senior (host) first */
  get members$(): Observable<ReadonlyArray<LobbyMember<D>>> {
    return this.derive(s => this.sortedMembers(s));
  }

  get members(): ReadonlyArray<LobbyMember<D>> {
    return this.sortedMembers(this.snapshot$.getValue());
  }

  /** peer id of the host, the senior member */
  get host$(): Observable<string | null> {
    return this.derive(s => this.sortedMembers(s)[0]?.peerId ?? null);
  }

  get host(): string | null {
    return this.members[0]?.peerId ?? null;
  }

  /** whether the local peer is host and the backend is reachable */
  get isHost$(): Observable<boolean> {
    return combineLatest([this.host$, this.connectedSubject$]).pipe(
      map(([host, connected]) => connected && host === this.localPeerId && this.closedReason === null),
      distinctUntilChanged(),
    );
  }

  get isHost(): boolean {
    return this.closedReason === null && this.connectedSubject$.getValue() && this.host === this.localPeerId;
  }

  /** the host's shared state, `null` until it writes one */
  get state$(): Observable<S | null> {
    return this.derive(s => (s?.state?.value ?? null) as S | null);
  }

  get state(): S | null {
    return (this.snapshot$.getValue()?.state?.value ?? null) as S | null;
  }

  /** the match in progress, `null` while the room is a lobby */
  get match$(): Observable<LobbyMatch | null> {
    return this.derive(s => s?.match ?? null);
  }

  get match(): LobbyMatch | null {
    return this.snapshot$.getValue()?.match ?? null;
  }

  /** Current backend (server) time, ms: the timeline {@link scheduleStart} uses, the same for every member. */
  serverNow(): number {
    return Date.now() + this.serverOffset;
  }

  /** backend time minus the local `Date.now()`, ms */
  get serverTimeOffset(): number {
    return this.serverOffset;
  }

  /** Replace the local member's own data (any JSON). */
  async setMemberData(data: D): Promise<void> {
    await this.write({ kind: 'member', data });
  }

  /** Declare the local member ready for `round` (`null`: not ready). */
  async setReady(round: string | null): Promise<void> {
    await this.write({ kind: 'ready', round });
  }

  /**
   * Host only: replace the shared state (any JSON).
   * @returns `false` when the local peer isn't host (nothing is written)
   */
  async setState(state: S): Promise<boolean> {
    if (!this.isHost) {
      return false;
    }
    await this.write({ kind: 'state', value: state });
    return true;
  }

  /**
   * Host only: start a match - lock the roster to the current members, senior first. The room
   * admits nobody until {@link endMatch}.
   * @returns the match, or `null` when the local peer isn't host
   */
  async startMatch(): Promise<LobbyMatch | null> {
    if (!this.isHost) {
      return null;
    }
    const capacity = this.info?.capacity ?? Infinity;
    const roster = this.members.slice(0, capacity).map(m => m.peerId);
    const id = Math.round(this.serverNow()).toString(36) + generatePeerId();
    await this.write({ kind: 'match', match: { id, roster } });
    return { id, roster, by: this.localPeerId };
  }

  /**
   * Host only: end the match - the room is a lobby again and admits new members. A match whose
   * roster has nobody left in the room is ended by the host on its own.
   * @returns `false` when the local peer isn't host
   */
  async endMatch(): Promise<boolean> {
    if (!this.isHost) {
      return false;
    }
    await this.write({ kind: 'match', match: null });
    return true;
  }

  /**
   * Host only: schedule `round` to start at `at`, in backend time ({@link serverNow}; e.g.
   * `lobby.serverNow() + 5000`). Every member sees it on {@link startsAt$}.
   * @returns `false` when the local peer isn't host
   */
  async scheduleStart(round: string, at: number): Promise<boolean> {
    if (!this.isHost) {
      return false;
    }
    await this.write({ kind: 'start', start: { round, at: Math.round(at) } });
    return true;
  }

  /**
   * When `round` starts, in backend time (`null` until the host schedules it). `at - serverNow()` is
   * how long until then on any member's clock.
   */
  startsAt$(round: string): Observable<number | null> {
    return this.derive(s => (s?.start?.round === round ? s.start.at : null));
  }

  /**
   * Who is ready for `round`: the expected peers are the match roster members still in the room
   * (every member while there is no match).
   */
  readiness(round: string): LobbyReadiness {
    return this.readinessOf(this.snapshot$.getValue(), round);
  }

  ready$(round: string): Observable<LobbyReadiness> {
    return this.derive(s => this.readinessOf(s, round));
  }

  /**
   * Resolve once every expected peer is ready for `round` ({@link readiness}), or after `timeoutMs`
   * (or when the lobby closes) with whoever is ready by then - the game decides whether to start
   * without the rest.
   */
  waitForReady(round: string, timeoutMs: number): Promise<LobbyReadiness> {
    return new Promise(resolve => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let subscription: Subscription | null = null;
      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        if (timer !== null) {
          clearTimeout(timer);
        }
        subscription?.unsubscribe();
        resolve(this.readiness(round));
      };
      if (Number.isFinite(timeoutMs)) {
        timer = setTimeout(finish, Math.max(0, timeoutMs));
      }
      subscription = this.ready$(round).subscribe({
        next: r => r.complete && finish(),
        complete: finish,
      });
      if (done) {
        subscription.unsubscribe();
      }
    });
  }

  /**
   * Record `subject`'s result of `round` (any JSON) unless it already has one: the first write
   * wins, whichever member made it - so several members may report the same outcome safely.
   * @param subject what the result is about, e.g. a racer's peer id (`[0-9A-Za-z_-]`, up to 64)
   * @returns whether this write is the one that counts
   */
  async writeResult<R>(round: string, subject: string, value: R): Promise<boolean> {
    if (this.closedReason !== null) {
      return false;
    }
    return this.backend.writeResult(this.roomId, this.localPeerId, round, subject, value);
  }

  /** results of `round` by subject */
  results$<R = unknown>(round: string): Observable<Readonly<Record<string, R>>> {
    return this.derive(s => this.resultsOf<R>(s, round));
  }

  results<R = unknown>(round: string): Readonly<Record<string, R>> {
    return this.resultsOf<R>(this.snapshot$.getValue(), round);
  }

  /**
   * Leave the room. The local state is closed at once; the backend write may complete later (it is
   * sent before anything else is awaited, so a tab closed right after still leaves).
   */
  async leave(): Promise<void> {
    if (this.closedReason !== null) {
      return;
    }
    // closed first: the backend may report the member gone before `leaveRoom` returns
    this.close('left', false);
    await this.backend.leaveRoom(this.roomId, this.localPeerId).catch(() => undefined);
  }

  private async write(write: LobbyWrite): Promise<void> {
    if (this.closedReason === null) {
      await this.backend.write(this.roomId, this.localPeerId, write);
    }
  }

  private onSnapshot(snapshot: LobbyRoomSnapshot | null): void {
    if (this.closedReason !== null) {
      return;
    }
    this.snapshot$.next(snapshot);
    const inRoom = !!snapshot?.members.some(m => m.peerId === this.localPeerId);
    if (inRoom) {
      this.present = true;
    } else if (this.present) {
      this.close('lost');
      return;
    }
    const match = snapshot?.match;
    if (match && this.isHost && !match.roster.some(id => snapshot!.members.some(m => m.peerId === id))) {
      // everybody who played left: nothing else would ever end it, and the room would stay closed
      if (this.endingStaleMatch !== match.id) {
        this.endingStaleMatch = match.id;
        void this.write({ kind: 'match', match: null }).catch(() => undefined);
      }
    }
  }

  private close(reason: LobbyCloseReason, removeMember: boolean = true): void {
    if (this.closedReason !== null) {
      return;
    }
    this.closedReason = reason;
    for (const s of this.subscriptions) {
      s.unsubscribe();
    }
    this.subscriptions.length = 0;
    if (reason === 'lost' && removeMember) {
      // the record may still be there (a short drop the backend didn't notice): never leave a ghost
      void this.backend.leaveRoom(this.roomId, this.localPeerId).catch(() => undefined);
    }
    this._closed$.next(reason);
    this._closed$.complete();
    this.snapshot$.complete();
    this.connectedSubject$.complete();
    this.onClose?.(this);
  }

  private derive<T>(project: (snapshot: LobbyRoomSnapshot | null) => T): Observable<T> {
    return this.snapshot$.pipe(map(project), distinctUntilChanged<T>(sameJson));
  }

  private sortedMembers(snapshot: LobbyRoomSnapshot | null): ReadonlyArray<LobbyMember<D>> {
    return [...(snapshot?.members ?? [])].sort(bySeniority) as LobbyMember<D>[];
  }

  private readinessOf(snapshot: LobbyRoomSnapshot | null, round: string): LobbyReadiness {
    const members = this.sortedMembers(snapshot);
    const present = new Map(members.map(m => [m.peerId, m]));
    const expected = snapshot?.match ? snapshot.match.roster.filter(id => present.has(id)) : members.map(m => m.peerId);
    const ready = expected.filter(id => present.get(id)!.ready === round);
    const waiting = expected.filter(id => present.get(id)!.ready !== round);
    return { ready, waiting, complete: expected.length > 0 && waiting.length === 0 };
  }

  private resultsOf<R>(snapshot: LobbyRoomSnapshot | null, round: string): Readonly<Record<string, R>> {
    const out: Record<string, R> = {};
    for (const r of snapshot?.results ?? []) {
      if (r.round === round) {
        out[r.subject] = r.value as R;
      }
    }
    return out;
  }
}
