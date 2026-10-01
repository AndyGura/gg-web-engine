import { Observable } from 'rxjs';

/** A WebRTC session description or ICE candidate, relayed between two peers by a signaling channel. */
export type SdpOrIce =
  { kind: 'offer' | 'answer'; sdp: string } | { kind: 'ice'; candidate: RTCIceCandidateInit | null };

/** One peer present in a room, with the zoning cell it last published ('' = no cell). */
export interface PresenceEntry {
  peerId: string;
  cell: string;
}

/**
 * The rendezvous `WebRtcMeshTransport` uses to find the room's peers and exchange SDP/ICE with
 * them. `FirebaseSignaling` (Firebase Realtime Database) is the default; `BroadcastChannelSignaling`
 * connects tabs of one browser with no backend at all, for local development.
 */
export interface ISignalingChannel {
  /** Create a new room; returns its id (a UUID v4). */
  createRoom(): Promise<string>;

  /** Enter `roomId` as `localPeerId`: publish presence and start receiving signals addressed to it. */
  join(roomId: string, localPeerId: string): Promise<void>;

  /** Relay `payload` to peer `to`. */
  publish(to: string, payload: SdpOrIce): Promise<void>;

  /** signals addressed to the local peer */
  readonly incoming$: Observable<{ from: string; payload: SdpOrIce }>;

  /** every peer currently present in the room (the local one included) */
  readonly presence$: Observable<ReadonlyArray<PresenceEntry>>;

  /** Publish the local peer's zoning cell. */
  setCell(cell: string): Promise<void>;

  /**
   * Optional: how long a joining peer should keep listening for presence before deciding who is
   * already in the room - for a channel where peers announce themselves only in response to a
   * newcomer (`BroadcastChannelSignaling`). Absent means the first presence snapshot is complete.
   */
  readonly discoveryDelayMs?: number;

  /** Leave the room: remove presence and everything this peer wrote. */
  leave(): Promise<void>;
}
