import { map, Observable } from 'rxjs';
import { generatePeerId } from '../p2p/room-url';
import { ILobbyBackend, LobbyRoomSnapshot } from './lobby-backend';
import { Lobby } from './lobby';

/** A room as a room list shows it, see {@link RoomDirectory.rooms$}. */
export interface RoomListing<M = unknown> {
  roomId: string;
  name: string;
  capacity: number;
  memberCount: number;
  meta: M;
  /** backend time the room was created, ms */
  createdAt: number;
  /** whether a match is in progress (the room admits nobody then) */
  started: boolean;
  /** not started and not full */
  joinable: boolean;
}

/** Options of {@link RoomDirectory.createRoom}. */
export interface CreateRoomOptions<D, M> {
  /** shown in room lists, up to 64 characters */
  name: string;
  /** most members at once, an integer 1..32 */
  capacity: number;
  /** app data about the room (any JSON), fixed for its lifetime */
  meta?: M;
  /** the creator's own member data */
  member?: D;
}

/** Options of {@link RoomDirectory.joinRoom}. */
export interface JoinRoomOptions<D> {
  /** the joining member's own data */
  member?: D;
}

const MAX_CAPACITY = 32;
const MAX_NAME_LENGTH = 64;

const toListing = <M>(room: LobbyRoomSnapshot): RoomListing<M> => {
  const started = room.match !== null;
  return {
    roomId: room.roomId,
    name: room.info.name,
    capacity: room.info.capacity,
    memberCount: room.members.length,
    meta: room.info.meta as M,
    createdAt: room.info.createdAt,
    started,
    joinable: !started && room.members.length < room.info.capacity,
  };
};

/**
 * Rooms above signaling: a list of rooms with names, capacities and member counts, and joining or
 * creating one, which gives a {@link Lobby}. A room's id is a UUID v4, so it doubles as the
 * `roomId` of a `WebRtcMeshTransport`, and the lobby's {@link Lobby.localPeerId} as its
 * `localPeerId`:
 *
 * ```typescript
 * const directory = new RoomDirectory<Player>(new FirebaseLobbyBackend());
 * directory.rooms$.subscribe(rooms => showRoomList(rooms));
 * const lobby = await directory.joinRoom(roomId, { member: { name: 'Ann' } });
 * const transport = new WebRtcMeshTransport({ signaling, roomId: lobby.roomId, localPeerId: lobby.localPeerId });
 * ```
 *
 * The local peer is in one room at most: joining or creating another leaves the current one first,
 * and operations run one at a time in call order - a second join of the same room (a double click)
 * waits for the first and returns the same lobby. Every join gets a fresh peer id. The directory
 * doesn't own the backend: dispose that yourself after {@link dispose}.
 */
export class RoomDirectory<D = unknown, S = unknown, M = unknown> {
  private current: Lobby<D, S, M> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(public readonly backend: ILobbyBackend) {}

  /** every room with a member, oldest first */
  get rooms$(): Observable<ReadonlyArray<RoomListing<M>>> {
    return this.backend.rooms$.pipe(
      map(rooms => rooms.map(r => toListing<M>(r)).sort((a, b) => a.createdAt - b.createdAt)),
    );
  }

  /** the room the local peer is in, `null` when none */
  get lobby(): Lobby<D, S, M> | null {
    return this.current;
  }

  /** Create a room and enter it as its first member (and host); leaves the current room first. */
  createRoom(options: CreateRoomOptions<D, M>): Promise<Lobby<D, S, M>> {
    if (!Number.isInteger(options.capacity) || options.capacity < 1 || options.capacity > MAX_CAPACITY) {
      return Promise.reject(new Error(`RoomDirectory: capacity must be an integer 1..${MAX_CAPACITY}`));
    }
    if (typeof options.name !== 'string' || options.name.length > MAX_NAME_LENGTH) {
      return Promise.reject(new Error(`RoomDirectory: name must be a string of up to ${MAX_NAME_LENGTH} characters`));
    }
    return this.enqueue(async () => {
      await this.leaveCurrent();
      const peerId = generatePeerId();
      const roomId = await this.backend.createRoom(
        { name: options.name, capacity: options.capacity, meta: options.meta ?? null },
        { peerId, data: options.member ?? null },
      );
      return this.open(roomId, peerId);
    });
  }

  /**
   * Join `roomId`, leaving the current room first (joining the current room again returns its lobby).
   * @throws {@link LobbyJoinError} when the room doesn't exist, is full or has a match in progress
   */
  joinRoom(roomId: string, options: JoinRoomOptions<D> = {}): Promise<Lobby<D, S, M>> {
    return this.enqueue(async () => {
      if (this.current && this.current.roomId === roomId && this.current.closed === null) {
        return this.current;
      }
      await this.leaveCurrent();
      const peerId = generatePeerId();
      await this.backend.joinRoom(roomId, { peerId, data: options.member ?? null });
      return this.open(roomId, peerId);
    });
  }

  /** Leave the current room, if any. */
  leave(): Promise<void> {
    return this.enqueue(() => this.leaveCurrent());
  }

  /** Leave the current room. The backend stays usable (and undisposed). */
  dispose(): void {
    void this.leave();
  }

  private open(roomId: string, peerId: string): Lobby<D, S, M> {
    const lobby = new Lobby<D, S, M>(this.backend, roomId, peerId, closed => {
      if (this.current === closed) {
        this.current = null;
      }
    });
    if (lobby.closed === null) {
      this.current = lobby;
    }
    return lobby;
  }

  private async leaveCurrent(): Promise<void> {
    const lobby = this.current;
    this.current = null;
    await lobby?.leave();
  }

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = this.queue.catch(() => undefined).then(op);
    this.queue = run;
    return run;
  }
}
