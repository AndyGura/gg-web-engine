import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ISignalingChannel, PresenceEntry, SdpOrIce } from './signaling';
import { generateRoomId } from './room-url';

type ChannelMessage =
  | { kind: 'presence'; peerId: string; cell: string }
  | { kind: 'bye'; peerId: string }
  | { kind: 'signal'; from: string; to: string; payload: SdpOrIce };

/**
 * `ISignalingChannel` over the browser's `BroadcastChannel`: connects tabs of one browser (same
 * origin) with no backend at all - open the same `?room=` URL in two tabs to test multiplayer
 * locally. Presence is a heartbeat every second; a tab silent for 3 seconds drops out.
 */
export class BroadcastChannelSignaling implements ISignalingChannel {
  /** peers answer a newcomer's first announcement; give them a moment */
  public readonly discoveryDelayMs = 300;
  private channel: BroadcastChannel | null = null;
  private localPeerId: string | null = null;
  private cell = '';
  private readonly lastSeen = new Map<string, { cell: string; at: number }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly _incoming$ = new Subject<{ from: string; payload: SdpOrIce }>();
  private readonly _presence$ = new BehaviorSubject<ReadonlyArray<PresenceEntry>>([]);

  constructor(private readonly prefix: string = 'gg-web-engine-room') {}

  get incoming$(): Observable<{ from: string; payload: SdpOrIce }> {
    return this._incoming$.asObservable();
  }

  get presence$(): Observable<ReadonlyArray<PresenceEntry>> {
    return this._presence$.asObservable();
  }

  async createRoom(): Promise<string> {
    return generateRoomId();
  }

  async join(roomId: string, localPeerId: string): Promise<void> {
    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('BroadcastChannelSignaling: BroadcastChannel is not available in this environment');
    }
    this.localPeerId = localPeerId;
    this.channel = new BroadcastChannel(`${this.prefix}:${roomId}`);
    this.channel.onmessage = event => this.onMessage(event.data as ChannelMessage);
    this.lastSeen.set(localPeerId, { cell: this.cell, at: Date.now() });
    this.announce();
    this.timer = setInterval(() => {
      this.announce();
      const now = Date.now();
      for (const [peerId, seen] of this.lastSeen) {
        if (peerId !== localPeerId && now - seen.at > 3000) {
          this.lastSeen.delete(peerId);
        }
      }
      this.publishPresence();
    }, 1000);
    this.publishPresence();
  }

  async publish(to: string, payload: SdpOrIce): Promise<void> {
    if (this.channel && this.localPeerId) {
      this.post({ kind: 'signal', from: this.localPeerId, to, payload });
    }
  }

  async setCell(cell: string): Promise<void> {
    this.cell = cell;
    if (this.localPeerId) {
      this.lastSeen.set(this.localPeerId, { cell, at: Date.now() });
      this.announce();
      this.publishPresence();
    }
  }

  async leave(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.channel && this.localPeerId) {
      this.post({ kind: 'bye', peerId: this.localPeerId });
      this.channel.close();
    }
    this.channel = null;
    this.lastSeen.clear();
    this._presence$.next([]);
  }

  private announce(): void {
    if (this.localPeerId) {
      this.lastSeen.set(this.localPeerId, { cell: this.cell, at: Date.now() });
      this.post({ kind: 'presence', peerId: this.localPeerId, cell: this.cell });
    }
  }

  private post(msg: ChannelMessage): void {
    this.channel?.postMessage(JSON.parse(JSON.stringify(msg)));
  }

  private onMessage(msg: ChannelMessage): void {
    if (!this.localPeerId) {
      return;
    }
    switch (msg.kind) {
      case 'presence': {
        const known = this.lastSeen.get(msg.peerId);
        this.lastSeen.set(msg.peerId, { cell: msg.cell, at: Date.now() });
        if (!known) {
          this.announce(); // let the newcomer see us right away
        }
        if (!known || known.cell !== msg.cell) {
          this.publishPresence();
        }
        break;
      }
      case 'bye':
        this.lastSeen.delete(msg.peerId);
        this.publishPresence();
        break;
      case 'signal':
        if (msg.to === this.localPeerId) {
          this._incoming$.next({ from: msg.from, payload: msg.payload });
        }
        break;
    }
  }

  private publishPresence(): void {
    this._presence$.next([...this.lastSeen.entries()].map(([peerId, seen]) => ({ peerId, cell: seen.cell })));
  }
}
