import { Observable } from 'rxjs';

/** What a room is created with; fixed for the room's lifetime. */
export interface LobbyRoomInfo<M = unknown> {
  /** shown in a room list */
  name: string;
  /** most members the room admits at once, 1..32 */
  capacity: number;
  /** app data about the room (a mode, a map, rules), any JSON */
  meta: M;
  /** backend time the room was created, ms */
  createdAt: number;
}

/** One admitted member of a room, as the backend stores it. */
export interface LobbyMemberRecord<D = unknown> {
  peerId: string;
  /** backend time the member joined, ms: what decides seniority (earliest first, ties by `peerId`) */
  joinedAt: number;
  /** the member's own app data (a name, a chosen car), any JSON; only that member writes it */
  data: D;
  /** the round the member declared itself ready for, `null` while not ready */
  ready: string | null;
}

/** The roster of a started match, as the host locked it. */
export interface LobbyMatchRecord {
  /** tells matches apart */
  id: string;
  /** peer ids taking part, senior first - fixed for the whole match */
  roster: string[];
  /** the peer that started it */
  by: string;
}

/** A round's scheduled start. */
export interface LobbyStartRecord {
  round: string;
  /** backend (server) time, ms */
  at: number;
  by: string;
}

/** One result of a round, written once. */
export interface LobbyResultRecord<R = unknown> {
  /** what the result is about (a racer's peer id, a team) */
  subject: string;
  round: string;
  value: R;
  by: string;
}

/** Everything a backend knows about one room. */
export interface LobbyRoomSnapshot {
  roomId: string;
  info: LobbyRoomInfo;
  /** admitted members only, any order (a join still in progress or refused is never listed) */
  members: ReadonlyArray<LobbyMemberRecord>;
  /** the host's shared state, `null` when none was written */
  state: { value: unknown; by: string } | null;
  match: LobbyMatchRecord | null;
  start: LobbyStartRecord | null;
  results: ReadonlyArray<LobbyResultRecord>;
}

/** A write a member makes to a room through {@link ILobbyBackend.write}. */
export type LobbyWrite =
  | { kind: 'member'; data: unknown }
  | { kind: 'ready'; round: string | null }
  | { kind: 'state'; value: unknown }
  | { kind: 'match'; match: { id: string; roster: string[] } | null }
  | { kind: 'start'; start: { round: string; at: number } | null };

/** Why a join was refused, see {@link LobbyJoinError}. */
export type LobbyJoinFailure = 'not-found' | 'full' | 'started';

/** Thrown by a join (or {@link ILobbyBackend.joinRoom}) the room refused. */
export class LobbyJoinError extends Error {
  constructor(public readonly reason: LobbyJoinFailure) {
    super(
      reason === 'full'
        ? 'Cannot join: the room is full'
        : reason === 'started'
          ? 'Cannot join: the match has started'
          : 'Cannot join: no such room',
    );
    this.name = 'LobbyJoinError';
  }
}

/**
 * Storage behind {@link RoomDirectory} and {@link Lobby}: where rooms, their members and the
 * lobby's shared records live. `FirebaseLobbyBackend` (Realtime Database) is the one for real
 * games; `BroadcastChannelLobbyBackend` connects tabs of one browser with no backend at all, for
 * local development. The backend stores and enforces; host election, the ready barrier and the
 * roster rules are computed from its snapshots by `Lobby`, the same way for every backend.
 *
 * What a backend must guarantee:
 * - a room is never listed without a member: the creator is in it from the first moment;
 * - admission is atomic: two peers joining the last free place at once never both get in, and a
 *   room with a match never admits anyone;
 * - a member that goes away without leaving (a closed tab, a lost connection) is removed by the
 *   backend itself;
 * - {@link writeResult} writes a subject's result of a round once: the first write wins.
 */
export interface ILobbyBackend {
  /** every room in the directory, with at least one member */
  readonly rooms$: Observable<ReadonlyArray<LobbyRoomSnapshot>>;

  /** one room (`null` while it doesn't exist) */
  room$(roomId: string): Observable<LobbyRoomSnapshot | null>;

  /** whether the backend is reachable now: a member that loses it has to be treated as gone */
  readonly connected$: Observable<boolean>;

  /** backend time minus local `Date.now()`, ms - 0 for a backend running on the local clock */
  readonly serverTimeOffset$: Observable<number>;

  /** Create a room with `member` as its first member; returns its id (a UUID v4). */
  createRoom(info: Omit<LobbyRoomInfo, 'createdAt'>, member: { peerId: string; data: unknown }): Promise<string>;

  /**
   * Admit `member` to `roomId` within the room's capacity.
   * @throws {@link LobbyJoinError} when the room doesn't exist, is full or has a match
   */
  joinRoom(roomId: string, member: { peerId: string; data: unknown }): Promise<void>;

  /** Remove `peerId` from the room (a room left without members is removed too). */
  leaveRoom(roomId: string, peerId: string): Promise<void>;

  /** Write a member's own record or one of the room's shared records, as `peerId`. */
  write(roomId: string, peerId: string, write: LobbyWrite): Promise<void>;

  /**
   * Write `subject`'s result of `round`, unless that round already has one for it (a result of
   * another round is replaced).
   * @returns whether this write is the one that counts
   */
  writeResult(roomId: string, peerId: string, round: string, subject: string, value: unknown): Promise<boolean>;

  /** Stop every subscription and timer; rooms the local peer is still in are left first. */
  dispose(): void;
}
