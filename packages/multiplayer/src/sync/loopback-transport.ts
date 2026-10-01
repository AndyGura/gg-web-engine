import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ITransport } from './transport';
import { WireChannel, WireMessage } from './wire';
import { NetScheduler, realScheduler } from './scheduler';

/** Simulated link conditions of a {@link LoopbackHub}. */
export interface LoopbackConditions {
  /** one-way delay, ms. Default 0 (delivered on the next scheduler turn). */
  latencyMs: number;
  /** extra random delay in [0, jitterMs], ms. Unreliable messages may reorder; reliable ones never do. */
  jitterMs: number;
  /** probability (0..1) an unreliable message is dropped. Reliable messages are never dropped. */
  lossRate: number;
}

/**
 * An in-process "network" joining several {@link LoopbackTransport}s - every message is a deep JSON
 * copy delivered through the shared {@link NetScheduler} after the configured latency, so peers never
 * share object references, exactly as over a real wire. Used by tests and the in-process harness.
 */
export class LoopbackHub {
  public conditions: LoopbackConditions;
  private readonly transports = new Map<string, LoopbackTransport>();
  // per directed link: when the last reliable message is delivered, so reliable stays ordered
  private readonly reliableTail = new Map<string, number>();
  private random: () => number;

  constructor(
    public readonly scheduler: NetScheduler = realScheduler,
    conditions: Partial<LoopbackConditions> = {},
    random: () => number = Math.random,
  ) {
    this.conditions = { latencyMs: 0, jitterMs: 0, lossRate: 0, ...conditions };
    this.random = random;
  }

  /** Create a transport for `peerId` on this hub (not connected until `connect()`). */
  createTransport(peerId: string): LoopbackTransport {
    return new LoopbackTransport(this, peerId);
  }

  /** ids of connected transports */
  get connectedPeers(): string[] {
    return [...this.transports.keys()];
  }

  /**
   * Cut `peerId` off without a clean disconnect: its messages stop flowing both ways and nobody is
   * told, like a crashed tab or closed laptop - other peers only notice through heartbeat timeouts.
   */
  partition(peerId: string): void {
    this.transports.get(peerId)?.setPartitioned(true);
  }

  /** Undo {@link partition}. */
  heal(peerId: string): void {
    this.transports.get(peerId)?.setPartitioned(false);
  }

  /** @internal */
  _attach(transport: LoopbackTransport): void {
    this.transports.set(transport.localPeerId, transport);
    for (const other of this.transports.values()) {
      other._refreshPeers();
    }
  }

  /** @internal */
  _detach(transport: LoopbackTransport): void {
    if (this.transports.get(transport.localPeerId) !== transport) {
      return;
    }
    this.transports.delete(transport.localPeerId);
    for (const other of this.transports.values()) {
      other._refreshPeers();
      other._peerLeft(transport.localPeerId);
    }
  }

  /** @internal */
  _peersOf(peerId: string): string[] {
    return [...this.transports.keys()].filter(id => id !== peerId);
  }

  /** @internal */
  _deliver(from: string, to: string | 'all', channel: WireChannel, msg: WireMessage): void {
    const sender = this.transports.get(from);
    if (!sender || sender.partitioned) {
      return;
    }
    const targets = to === 'all' ? this._peersOf(from) : [to];
    const payload = JSON.stringify(msg);
    for (const target of targets) {
      if (channel === 'unreliable' && this.random() < this.conditions.lossRate) {
        continue;
      }
      let delay = this.conditions.latencyMs + this.random() * this.conditions.jitterMs;
      if (channel === 'reliable') {
        const key = `${from}->${target}`;
        const due = Math.max(this.scheduler.now() + delay, this.reliableTail.get(key) ?? 0);
        this.reliableTail.set(key, due);
        delay = due - this.scheduler.now();
      }
      this.scheduler.setTimeout(() => {
        const receiver = this.transports.get(target);
        if (receiver && !receiver.partitioned && this.transports.get(from)?.partitioned !== true) {
          receiver._receive(from, JSON.parse(payload));
        }
      }, delay);
    }
  }
}

/** One peer's end of a {@link LoopbackHub}. */
export class LoopbackTransport implements ITransport {
  private readonly _peers$ = new BehaviorSubject<ReadonlyArray<string>>([]);
  private readonly _messages$ = new Subject<{ from: string; msg: WireMessage }>();
  private readonly _peerLeft$ = new Subject<string>();
  private connected = false;
  /** @internal */
  partitioned = false;

  constructor(
    private readonly hub: LoopbackHub,
    public readonly localPeerId: string,
  ) {}

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

  async connect(): Promise<void> {
    this.connected = true;
    this.hub._attach(this);
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.hub._detach(this);
    this._peers$.next([]);
  }

  send(to: string | 'all', channel: WireChannel, msg: WireMessage): void {
    if (this.connected) {
      this.hub._deliver(this.localPeerId, to, channel, msg);
    }
  }

  /** @internal */
  setPartitioned(value: boolean): void {
    this.partitioned = value;
  }

  /** @internal */
  _refreshPeers(): void {
    if (this.connected) {
      this._peers$.next(this.hub._peersOf(this.localPeerId));
    }
  }

  /** @internal */
  _peerLeft(peerId: string): void {
    this._peerLeft$.next(peerId);
  }

  /** @internal */
  _receive(from: string, msg: WireMessage): void {
    if (this.connected) {
      this._messages$.next({ from, msg });
    }
  }
}
