import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ISignalingChannel, PresenceEntry, SdpOrIce } from '../../src';

const flush = (fn: () => void) => queueMicrotask(fn);

/** In-memory signaling hub: every channel it creates shares rooms, presence and inboxes. */
export class InMemorySignalingHub {
  readonly rooms = new Map<string, Map<string, { cell: string; channel: InMemorySignaling }>>();
  published = 0;

  create(): InMemorySignaling {
    return new InMemorySignaling(this);
  }

  /** @internal */
  broadcastPresence(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    const entries: PresenceEntry[] = [...room.entries()].map(([peerId, v]) => ({ peerId, cell: v.cell }));
    for (const { channel } of room.values()) {
      flush(() => channel._presence$.next(entries));
    }
  }
}

export class InMemorySignaling implements ISignalingChannel {
  private roomId: string | null = null;
  private peerId: string | null = null;
  readonly _incoming$ = new Subject<{ from: string; payload: SdpOrIce }>();
  readonly _presence$ = new BehaviorSubject<ReadonlyArray<PresenceEntry>>([]);

  constructor(private readonly hub: InMemorySignalingHub) {}

  get incoming$(): Observable<{ from: string; payload: SdpOrIce }> {
    return this._incoming$.asObservable();
  }

  get presence$(): Observable<ReadonlyArray<PresenceEntry>> {
    return this._presence$.asObservable();
  }

  async createRoom(): Promise<string> {
    return 'room';
  }

  async join(roomId: string, localPeerId: string): Promise<void> {
    this.roomId = roomId;
    this.peerId = localPeerId;
    if (!this.hub.rooms.has(roomId)) {
      this.hub.rooms.set(roomId, new Map());
    }
    this.hub.rooms.get(roomId)!.set(localPeerId, { cell: '', channel: this });
    this.hub.broadcastPresence(roomId);
  }

  async publish(to: string, payload: SdpOrIce): Promise<void> {
    const target = this.hub.rooms.get(this.roomId!)?.get(to);
    this.hub.published++;
    if (target) {
      const from = this.peerId!;
      const copy = JSON.parse(JSON.stringify(payload));
      flush(() => target.channel._incoming$.next({ from, payload: copy }));
    }
  }

  async setCell(cell: string): Promise<void> {
    const entry = this.hub.rooms.get(this.roomId!)?.get(this.peerId!);
    if (entry) {
      entry.cell = cell;
      this.hub.broadcastPresence(this.roomId!);
    }
  }

  async leave(): Promise<void> {
    if (this.roomId && this.peerId) {
      this.hub.rooms.get(this.roomId)?.delete(this.peerId);
      this.hub.broadcastPresence(this.roomId);
    }
    this.roomId = null;
  }
}

class FakeDataChannel {
  readyState: 'connecting' | 'open' | 'closing' | 'closed' = 'connecting';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  twin: FakeDataChannel | null = null;
  sent: string[] = [];

  constructor(public readonly label: string) {}

  send(data: string): void {
    if (this.readyState !== 'open') {
      throw new Error('channel not open');
    }
    this.sent.push(data);
    const twin = this.twin;
    flush(() => {
      if (twin && twin.readyState === 'open') {
        twin.onmessage?.({ data });
      }
    });
  }

  close(): void {
    if (this.readyState === 'closed') {
      return;
    }
    this.readyState = 'closed';
    const twin = this.twin;
    flush(() => {
      if (twin && twin.readyState !== 'closed') {
        twin.readyState = 'closed';
        twin.onclose?.();
      }
    });
  }

  /** @internal */
  open(): void {
    this.readyState = 'open';
    this.onopen?.();
  }
}

let tokenCounter = 0;

/**
 * Minimal in-memory stand-in for `RTCPeerConnection`: SDP strings carry a token identifying the
 * connection; once the offerer applies the answer, both sides' data channels are paired and opened.
 */
export class FakeRTCPeerConnection {
  static readonly registry = new Map<string, FakeRTCPeerConnection>();
  static instances: FakeRTCPeerConnection[] = [];
  readonly token = `t${tokenCounter++}`;
  connectionState: 'new' | 'connecting' | 'connected' | 'failed' | 'closed' = 'new';
  onicecandidate: ((e: { candidate: any }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((e: { channel: FakeDataChannel }) => void) | null = null;
  readonly channels: FakeDataChannel[] = [];
  remote: FakeRTCPeerConnection | null = null;
  private remoteToken: string | null = null;
  readonly addedCandidates: any[] = [];

  constructor(public readonly config: any) {
    FakeRTCPeerConnection.registry.set(this.token, this);
    FakeRTCPeerConnection.instances.push(this);
  }

  createDataChannel(label: string): FakeDataChannel {
    const dc = new FakeDataChannel(label);
    this.channels.push(dc);
    return dc;
  }

  async createOffer(): Promise<{ type: 'offer'; sdp: string }> {
    return { type: 'offer', sdp: `fake:${this.token}` };
  }

  async createAnswer(): Promise<{ type: 'answer'; sdp: string }> {
    return { type: 'answer', sdp: `fake:${this.token}` };
  }

  async setLocalDescription(): Promise<void> {
    flush(() => {
      this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: `cand-${this.token}`, sdpMid: '0' }) } });
      this.onicecandidate?.({ candidate: null });
    });
  }

  async setRemoteDescription(desc: { type: string; sdp: string }): Promise<void> {
    this.remoteToken = desc.sdp.slice('fake:'.length);
    if (desc.type === 'answer') {
      const answerer = FakeRTCPeerConnection.registry.get(this.remoteToken)!;
      this.pair(answerer);
    }
  }

  async addIceCandidate(candidate: any): Promise<void> {
    this.addedCandidates.push(candidate);
  }

  close(): void {
    if (this.connectionState === 'closed') {
      return;
    }
    this.connectionState = 'closed';
    this.channels.forEach(c => c.close());
  }

  /** simulate a network failure of this connection (both ends) */
  fail(): void {
    for (const pc of [this, this.remote]) {
      if (pc && pc.connectionState !== 'closed') {
        pc.connectionState = 'failed';
        pc.onconnectionstatechange?.();
      }
    }
  }

  private pair(answerer: FakeRTCPeerConnection): void {
    this.remote = answerer;
    answerer.remote = this;
    flush(() => {
      for (const dc of this.channels) {
        const twin = new FakeDataChannel(dc.label);
        answerer.channels.push(twin);
        dc.twin = twin;
        twin.twin = dc;
        answerer.ondatachannel?.({ channel: twin });
        twin.open();
        dc.open();
      }
      this.connectionState = answerer.connectionState = 'connected';
    });
  }
}

export const settle = async (rounds = 20) => {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
};
