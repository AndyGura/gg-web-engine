import { BehaviorSubject, NEVER, Observable, Subject, Subscription } from 'rxjs';
import { ITransport } from '../sync/transport';
import { WireChannel, WireMessage } from '../sync/wire';
import { ChunkAssembler, DEFAULT_CHUNK_SIZE, frameMessage } from '../sync/chunking';
import { NetScheduler, realScheduler } from '../sync/scheduler';
import { ISignalingChannel, PresenceEntry, SdpOrIce } from './signaling';
import { DEFAULT_ZONING, withinRing, ZoneTracker, ZoningOptions } from './zoning';
import { generatePeerId } from './room-url';

export interface WebRtcMeshTransportOptions {
  signaling: ISignalingChannel;
  roomId: string;
  /** Default: a random 8-character id. */
  localPeerId?: string;
  /** ICE servers; add a TURN server for peers behind symmetric NATs. Default: one public STUN server. */
  iceServers?: RTCIceServer[];
  /** `'relay'` forces every connection through TURN (hides peer IPs from each other). Default `'all'`. */
  iceTransportPolicy?: RTCIceTransportPolicy;
  /**
   * Zoning (interest management): connect only to peers within `connectRadius` cells, stream state
   * only to those within `streamRadius`. Omit (or `null`) for a full mesh.
   */
  zoning?: Partial<ZoningOptions> | null;
  /**
   * Position zoning places this peer by; defaults to whatever the network controller reports as the
   * local player position. Set it for a spectator whose controller reports `null` but whose camera
   * still moves around (then it still connects to the peers near the camera).
   */
  zonePosition?: () => { x: number; y: number } | null;
  /** `connect()` waits this long at most for the connections to the peers already present. Default 10000. */
  connectTimeoutMs?: number;
  /** reliable-channel messages above this many characters are chunked. Default 16 KB. */
  chunkSize?: number;
  /** a failed connection to a still-present peer is retried with exponential backoff from this. Default 1000. */
  reconnectBaseDelayMs?: number;
  /** Default 30000. */
  reconnectMaxDelayMs?: number;
  /** `RTCPeerConnection` implementation, for non-browser hosts (e.g. node with a WebRTC package). */
  rtcPeerConnection?: typeof RTCPeerConnection;
  scheduler?: NetScheduler;
}

interface PeerLink {
  id: string;
  pc: RTCPeerConnection;
  offerer: boolean;
  reliable: RTCDataChannel | null;
  unreliable: RTCDataChannel | null;
  open: boolean;
  assembler: ChunkAssembler;
  pendingIce: RTCIceCandidateInit[];
  remoteDescriptionSet: boolean;
  startedAt: number;
}

/**
 * `ITransport` over a full mesh of WebRTC peer connections, one per pair of peers, each with two
 * data channels: `reliable` (ordered) and `unreliable` (unordered, `maxRetransmits: 0`). Peers find
 * each other and exchange SDP/ICE through an `ISignalingChannel`; the lexically smaller peer id of a
 * pair makes the offer, so two peers never offer to each other at once. Reliable messages above
 * `chunkSize` travel as `chunk` frames and are reassembled; oversized unreliable `state` messages are
 * split by items. A failed connection to a peer that is still present is retried with exponential
 * backoff; a peer that leaves the room's presence is reported on `peerLeft$`.
 *
 * Note that P2P exposes peers' IP addresses to each other (ICE candidates); use
 * `iceTransportPolicy: 'relay'` with your own TURN server where that matters.
 */
export class WebRtcMeshTransport implements ITransport {
  public readonly localPeerId: string;
  private readonly signaling: ISignalingChannel;
  private readonly roomId: string;
  private readonly scheduler: NetScheduler;
  private readonly opts: {
    iceServers: RTCIceServer[];
    iceTransportPolicy: RTCIceTransportPolicy;
    connectTimeoutMs: number;
    chunkSize: number;
    reconnectBaseDelayMs: number;
    reconnectMaxDelayMs: number;
  };
  private readonly zoning: ZoningOptions | null;
  private readonly zoneTracker: ZoneTracker | null;
  private readonly zonePosition: (() => { x: number; y: number } | null) | null;
  private readonly Rtc: typeof RTCPeerConnection;
  private readonly links = new Map<string, PeerLink>();
  private presence: ReadonlyArray<PresenceEntry> = [];
  private readonly outOfRingSince = new Map<string, number>();
  private readonly retries = new Map<string, { attempt: number; timer: unknown }>();
  private readonly subscriptions: Subscription[] = [];
  // peers reported on peers$ at some point and not yet reported on peerLeft$
  private readonly announced = new Set<string>();
  private connected = false;
  /** bumped by every `connect()` and `disconnect()`, so a connect still in flight notices it was cancelled */
  private connectGeneration = 0;
  private ageTimer: unknown = null;
  private readonly _peers$ = new BehaviorSubject<ReadonlyArray<string>>([]);
  private readonly _messages$ = new Subject<{ from: string; msg: WireMessage }>();
  private readonly _peerLeft$ = new Subject<string>();
  private readonly disconnected$ = new Subject<void>();
  /** time (scheduler ms) each link took from creation to both channels open - for diagnostics, e.g. checking zoning cell sizes */
  public readonly setupTimes = new Map<string, number>();

  constructor(options: WebRtcMeshTransportOptions) {
    this.signaling = options.signaling;
    this.roomId = options.roomId;
    this.localPeerId = options.localPeerId ?? generatePeerId();
    this.scheduler = options.scheduler ?? realScheduler;
    this.opts = {
      iceServers: options.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
      iceTransportPolicy: options.iceTransportPolicy ?? 'all',
      connectTimeoutMs: options.connectTimeoutMs ?? 10_000,
      chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE,
      reconnectBaseDelayMs: options.reconnectBaseDelayMs ?? 1000,
      reconnectMaxDelayMs: options.reconnectMaxDelayMs ?? 30_000,
    };
    this.zoning = options.zoning ? { ...DEFAULT_ZONING, ...options.zoning } : null;
    this.zoneTracker = this.zoning ? new ZoneTracker(this.zoning) : null;
    this.zonePosition = options.zonePosition ?? null;
    const Rtc = options.rtcPeerConnection ?? (globalThis as any).RTCPeerConnection;
    if (!Rtc) {
      throw new Error(
        'WebRtcMeshTransport: no RTCPeerConnection available (pass `rtcPeerConnection` on non-browser hosts)',
      );
    }
    this.Rtc = Rtc;
  }

  get peers$(): Observable<ReadonlyArray<string>> {
    return this._peers$.asObservable();
  }

  get peers(): ReadonlyArray<string> {
    return this._peers$.getValue();
  }

  get messages$(): Observable<{ from: string; msg: WireMessage }> {
    return this._messages$.asObservable();
  }

  get peerLeft$(): Observable<string> {
    return this._peerLeft$.asObservable();
  }

  /** the local peer's zoning cell ('' without zoning or position) */
  get localCell(): string {
    return this.zoneTracker?.cell ?? '';
  }

  /**
   * Join the room through the signaling channel and open connections to every peer already present
   * (within the connect ring, with zoning). Resolves once those are open, or after
   * `connectTimeoutMs` with whatever opened by then.
   * A `disconnect()` meanwhile cancels it: `connect()` then resolves right away.
   * @throws if joining the room through the signaling channel fails - the transport is then
   * disconnected again and `connect()` may be retried
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    this.connected = true;
    const generation = ++this.connectGeneration;
    const cancelled = () => generation !== this.connectGeneration;
    this.subscriptions.push(
      this.signaling.incoming$.subscribe(({ from, payload }) => void this.onSignal(from, payload)),
      this.signaling.presence$.subscribe(entries => this.onPresence(entries)),
    );
    try {
      await this.signaling.join(this.roomId, this.localPeerId);
      if (this.localCell) {
        // a position reported before joining couldn't be published yet
        await this.signaling.setCell(this.localCell);
      }
    } catch (e) {
      if (cancelled()) {
        return;
      }
      this.disconnect();
      throw e;
    }
    if (cancelled()) {
      return;
    }
    if (this.zoning) {
      this.ageTimer = this.scheduler.setInterval(() => this.reconcile(), 1000);
    }
    // don't decide whom to wait for before the room's presence is actually known
    await this.waitFor(
      this.signaling.presence$,
      () => this.presence.some(p => p.peerId === this.localPeerId),
      this.opts.connectTimeoutMs,
    );
    if (this.signaling.discoveryDelayMs && !cancelled()) {
      await this.waitFor(NEVER, () => false, this.signaling.discoveryDelayMs);
    }
    const expected = cancelled() ? [] : this.desiredPeers();
    if (expected.length === 0) {
      return;
    }
    await this.waitFor(
      this._peers$,
      () => expected.every(id => this.peers.includes(id) || !this.presence.some(p => p.peerId === id)),
      this.opts.connectTimeoutMs,
    );
  }

  /** resolves once `condition()` holds (checked whenever `trigger$` emits), after `timeoutMs`, or on `disconnect()` */
  private waitFor(trigger$: Observable<unknown>, condition: () => boolean, timeoutMs: number): Promise<void> {
    if (condition()) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      let done = false;
      const subscriptions: Subscription[] = [];
      const finish = () => {
        if (!done) {
          done = true;
          this.scheduler.clearTimeout(timeout);
          queueMicrotask(() => subscriptions.forEach(s => s.unsubscribe()));
          resolve();
        }
      };
      const timeout = this.scheduler.setTimeout(finish, timeoutMs);
      subscriptions.push(
        trigger$.subscribe(() => {
          if (condition()) {
            finish();
          }
        }),
        this.disconnected$.subscribe(finish),
      );
    });
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.connectGeneration++;
    for (const s of this.subscriptions) {
      s.unsubscribe();
    }
    this.subscriptions.length = 0;
    if (this.ageTimer !== null) {
      this.scheduler.clearInterval(this.ageTimer);
      this.ageTimer = null;
    }
    for (const retry of this.retries.values()) {
      this.scheduler.clearTimeout(retry.timer);
    }
    this.retries.clear();
    for (const id of [...this.links.keys()]) {
      this.closeLink(id, false);
    }
    this.announced.clear();
    this._peers$.next([]);
    this.disconnected$.next();
    void this.signaling.leave();
  }

  send(to: string | 'all', channel: WireChannel, msg: WireMessage): void {
    const targets =
      to === 'all' ? [...this.links.values()].filter(l => l.open) : [this.links.get(to)].filter(l => l?.open);
    if (targets.length === 0) {
      return;
    }
    const frames = channel === 'reliable' ? frameMessage(msg, this.opts.chunkSize) : this.splitUnreliable(msg);
    for (const link of targets) {
      const dc = channel === 'reliable' ? link!.reliable : link!.unreliable;
      if (!dc || dc.readyState !== 'open') {
        continue;
      }
      for (const frame of frames) {
        try {
          dc.send(frame);
        } catch {
          // buffer full / closing - an unreliable message may drop; a broken reliable link is reconnected
        }
      }
    }
  }

  streamTargets(): ReadonlyArray<string> | undefined {
    if (!this.zoning) {
      return undefined;
    }
    const local = this.localCell;
    return this.peers.filter(id => withinRing(local, this.cellOf(id), this.zoning!.streamRadius));
  }

  updateLocalPosition(position: unknown | null): void {
    if (!this.zoneTracker) {
      return;
    }
    const p = this.zonePosition ? this.zonePosition() : (position as { x: number; y: number } | null);
    const before = this.zoneTracker.cell;
    const after = this.zoneTracker.update(p);
    if (after !== before) {
      void this.signaling.setCell(after);
      this.reconcile();
    }
  }

  // -------------------------------------------------------------------------------------------

  private cellOf(peerId: string): string {
    return this.presence.find(p => p.peerId === peerId)?.cell ?? '';
  }

  private desiredPeers(): string[] {
    const local = this.localCell;
    return this.presence
      .filter(p => p.peerId !== this.localPeerId)
      .filter(p => !this.zoning || withinRing(local, p.cell, this.zoning.connectRadius))
      .map(p => p.peerId);
  }

  private onPresence(entries: ReadonlyArray<PresenceEntry>): void {
    const before = new Set(this.presence.map(p => p.peerId));
    this.presence = entries;
    const now = new Set(entries.map(p => p.peerId));
    for (const id of before) {
      if (!now.has(id) && id !== this.localPeerId) {
        // left the room for good
        const retry = this.retries.get(id);
        if (retry) {
          this.scheduler.clearTimeout(retry.timer);
          this.retries.delete(id);
        }
        this.closeLink(id, true);
        this.reportLeft(id);
      }
    }
    this.reconcile();
  }

  /** open links to desired peers we offer to; age out links outside the connect ring */
  private reconcile(): void {
    if (!this.connected) {
      return;
    }
    const desired = new Set(this.desiredPeers());
    const now = this.scheduler.now();
    for (const id of desired) {
      this.outOfRingSince.delete(id);
      if (!this.links.has(id) && !this.retries.has(id) && this.localPeerId < id) {
        void this.startOffer(id);
      }
    }
    if (this.zoning) {
      for (const id of [...this.links.keys()]) {
        if (desired.has(id)) {
          continue;
        }
        const since = this.outOfRingSince.get(id) ?? now;
        this.outOfRingSince.set(id, since);
        if (now - since >= this.zoning.ageOutMs) {
          // out of range, not gone: drop the connection without reporting a departure
          this.outOfRingSince.delete(id);
          this.closeLink(id, false);
          this.announced.delete(id);
        }
      }
    }
  }

  private createLink(id: string, offerer: boolean): PeerLink {
    const pc = new this.Rtc({ iceServers: this.opts.iceServers, iceTransportPolicy: this.opts.iceTransportPolicy });
    const link: PeerLink = {
      id,
      pc,
      offerer,
      reliable: null,
      unreliable: null,
      open: false,
      assembler: new ChunkAssembler(),
      pendingIce: [],
      remoteDescriptionSet: false,
      startedAt: this.scheduler.now(),
    };
    this.links.set(id, link);
    pc.onicecandidate = event => {
      void this.signaling.publish(id, { kind: 'ice', candidate: event.candidate ? event.candidate.toJSON() : null });
    };
    pc.onconnectionstatechange = () => {
      if (this.links.get(id) !== link) {
        return;
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.onLinkFailed(id);
      }
    };
    pc.ondatachannel = event => this.attachChannel(link, event.channel);
    return link;
  }

  private attachChannel(link: PeerLink, dc: RTCDataChannel): void {
    if (dc.label === 'reliable') {
      link.reliable = dc;
    } else if (dc.label === 'unreliable') {
      link.unreliable = dc;
    } else {
      return;
    }
    dc.onopen = () => this.checkOpen(link);
    dc.onclose = () => {
      if (this.links.get(link.id) === link && link.open) {
        this.onLinkFailed(link.id);
      }
    };
    dc.onmessage = event => this.onFrame(link, event.data);
    if (dc.readyState === 'open') {
      this.checkOpen(link);
    }
  }

  private checkOpen(link: PeerLink): void {
    if (link.open || link.reliable?.readyState !== 'open' || link.unreliable?.readyState !== 'open') {
      return;
    }
    link.open = true;
    this.retries.delete(link.id);
    this.setupTimes.set(link.id, this.scheduler.now() - link.startedAt);
    this.publishPeers();
  }

  private async startOffer(id: string): Promise<void> {
    const link = this.createLink(id, true);
    this.attachChannel(link, link.pc.createDataChannel('reliable', { ordered: true }));
    this.attachChannel(link, link.pc.createDataChannel('unreliable', { ordered: false, maxRetransmits: 0 }));
    try {
      const offer = await link.pc.createOffer();
      await link.pc.setLocalDescription(offer);
      await this.signaling.publish(id, { kind: 'offer', sdp: offer.sdp ?? '' });
    } catch (e) {
      console.warn(`WebRtcMeshTransport: offer to ${id} failed`, e);
      this.onLinkFailed(id);
    }
  }

  private async onSignal(from: string, payload: SdpOrIce): Promise<void> {
    if (!this.connected || from === this.localPeerId) {
      return;
    }
    try {
      if (payload.kind === 'offer') {
        const existing = this.links.get(from);
        if (existing) {
          // the remote side restarted the connection - start over
          this.closeLink(from, false);
        }
        const link = this.createLink(from, false);
        await link.pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
        link.remoteDescriptionSet = true;
        await this.flushIce(link);
        const answer = await link.pc.createAnswer();
        await link.pc.setLocalDescription(answer);
        await this.signaling.publish(from, { kind: 'answer', sdp: answer.sdp ?? '' });
      } else if (payload.kind === 'answer') {
        const link = this.links.get(from);
        if (link && link.offerer && !link.remoteDescriptionSet) {
          await link.pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
          link.remoteDescriptionSet = true;
          await this.flushIce(link);
        }
      } else if (payload.kind === 'ice') {
        const link = this.links.get(from);
        if (!link || !payload.candidate) {
          return;
        }
        if (link.remoteDescriptionSet) {
          await link.pc.addIceCandidate(payload.candidate);
        } else {
          link.pendingIce.push(payload.candidate);
        }
      }
    } catch (e) {
      console.warn(`WebRtcMeshTransport: handling ${payload.kind} from ${from} failed`, e);
    }
  }

  private async flushIce(link: PeerLink): Promise<void> {
    const pending = link.pendingIce.splice(0);
    for (const candidate of pending) {
      await link.pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  private onFrame(link: PeerLink, data: unknown): void {
    if (typeof data !== 'string') {
      return;
    }
    let frame: WireMessage;
    try {
      frame = JSON.parse(data);
    } catch {
      return;
    }
    const msg = link.assembler.accept(frame, this.scheduler.now());
    if (msg) {
      this._messages$.next({ from: link.id, msg });
    }
  }

  private onLinkFailed(id: string): void {
    const wasOpen = this.links.get(id)?.open ?? false;
    this.closeLink(id, false);
    if (!this.connected || !this.presence.some(p => p.peerId === id)) {
      if (wasOpen) {
        this.reportLeft(id);
      }
      return;
    }
    if (this.localPeerId > id) {
      return; // the other side offers; it retries
    }
    const attempt = (this.retries.get(id)?.attempt ?? 0) + 1;
    const delay = Math.min(this.opts.reconnectMaxDelayMs, this.opts.reconnectBaseDelayMs * 2 ** (attempt - 1));
    const timer = this.scheduler.setTimeout(() => {
      const retry = this.retries.get(id);
      if (retry) {
        retry.timer = null;
      }
      if (this.connected && !this.links.has(id) && this.desiredPeers().includes(id)) {
        void this.startOffer(id);
      }
    }, delay);
    this.retries.set(id, { attempt, timer });
  }

  private closeLink(id: string, notifyLeft: boolean): void {
    const link = this.links.get(id);
    if (!link) {
      return;
    }
    this.links.delete(id);
    const wasOpen = link.open;
    link.open = false;
    for (const dc of [link.reliable, link.unreliable]) {
      if (dc) {
        dc.onopen = dc.onclose = dc.onmessage = null;
        try {
          dc.close();
        } catch {
          // already closed
        }
      }
    }
    link.pc.onicecandidate = link.pc.onconnectionstatechange = link.pc.ondatachannel = null;
    try {
      link.pc.close();
    } catch {
      // already closed
    }
    if (wasOpen) {
      this.publishPeers();
      if (notifyLeft) {
        this.reportLeft(id);
      }
    }
  }

  private reportLeft(id: string): void {
    if (this.announced.delete(id)) {
      this._peerLeft$.next(id);
    }
  }

  private publishPeers(): void {
    const open = [...this.links.values()].filter(l => l.open).map(l => l.id);
    open.forEach(id => this.announced.add(id));
    this._peers$.next(open);
  }

  /** an oversized `state` message is split by items (an unreliable message can't be chunked - a lost chunk loses it all) */
  private splitUnreliable(msg: WireMessage): string[] {
    const serialized = JSON.stringify(msg);
    if (serialized.length <= this.opts.chunkSize || msg.t !== 'state' || msg.items.length < 2) {
      return [serialized];
    }
    const half = Math.ceil(msg.items.length / 2);
    return [
      ...this.splitUnreliable({ t: 'state', items: msg.items.slice(0, half) }),
      ...this.splitUnreliable({ t: 'state', items: msg.items.slice(half) }),
    ];
  }
}
