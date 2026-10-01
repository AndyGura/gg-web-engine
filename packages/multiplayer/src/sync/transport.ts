import { Observable } from 'rxjs';
import { WireChannel, WireMessage } from './wire';

/**
 * The seam between the transport-agnostic sync layer (`NetworkController`) and whatever moves
 * bytes: the P2P `WebRtcMeshTransport`, the in-process `LoopbackTransport`, or a future websocket
 * transport to a dedicated server. A transport with a single channel kind satisfies the interface by
 * ignoring the channel hint.
 */
export interface ITransport {
  readonly localPeerId: string;

  /** ids of currently connected peers */
  readonly peers$: Observable<ReadonlyArray<string>>;

  /** snapshot of `peers$` */
  readonly peers: ReadonlyArray<string>;

  /**
   * Send `msg` to one peer or every connected peer. `reliable` = ordered and guaranteed (ownership,
   * spawns, join dumps, ...); `unreliable` = unordered, may drop (the state stream).
   */
  send(to: string | 'all', channel: WireChannel, msg: WireMessage): void;

  readonly messages$: Observable<{ from: string; msg: WireMessage }>;

  /** emits a peer id once its connection is gone for good */
  readonly peerLeft$: Observable<string>;

  connect(): Promise<void>;

  disconnect(): void;

  /**
   * Optional interest management: the connected peers state should be streamed to (e.g. the
   * zoning 3×3 ring). Absent, or returning `undefined`, means every connected peer.
   */
  streamTargets?(): ReadonlyArray<string> | undefined;

  /**
   * Optional: tell the transport where the local player is, so a zoning transport can publish its
   * cell. Called by `NetworkController` every heartbeat with `localPosition()`.
   */
  updateLocalPosition?(position: unknown | null): void;
}
