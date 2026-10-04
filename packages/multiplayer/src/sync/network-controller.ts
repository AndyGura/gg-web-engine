import {
  BlueprintJson,
  CollisionEvent,
  CorrectionTuning,
  DEFAULT_CORRECTION_TUNING,
  EntityJson,
  GgWorld,
  GroupEntity,
  IEntity,
  INetworkSyncable,
  isNetworkInputDriven,
  isNetworkSyncable,
  LevelJson,
  LevelLoader,
  TickOrder,
  warnOnce,
} from '@gg-web-engine/core';
import { BehaviorSubject, filter, Observable, ReplaySubject, Subject, Subscription } from 'rxjs';
import { ITransport } from './transport';
import { channelOf, SpawnItem, StateItem, WireChannel, WireMessage } from './wire';
import { NetScheduler, realScheduler } from './scheduler';
import { ClockSync } from './clock-sync';
import {
  DEFAULT_NEAREST_PEER_OWNERSHIP,
  distanceSq,
  IOwnershipStrategy,
  NearestPeerOwnership,
  positionOf,
} from './ownership';
import { LinkConditioner } from './link-conditioner';
import { NetDebugPanel } from './net-debug-panel';

/** What the network layer reports about one connected peer. */
export interface PeerInfo {
  peerId: string;
  /** last position the peer reported (`null` = spectating), `undefined` until its first heartbeat */
  position: unknown | null | undefined;
  /** lowest round-trip time among the latest clock-sync samples, ms */
  rttMs: number;
  /** clock offset remote timestamps are converted with (peer clock minus local clock), ms */
  offsetMs: number;
  /** whether the peer announced it is away (hidden tab) */
  away: boolean;
}

/** Cumulative traffic counters. `bytes` (serialized characters) only grow while {@link NetworkController.measureTraffic} is on. */
export interface NetTrafficCounters {
  messages: number;
  stateItems: number;
  bytes: number;
}

/** Live numbers about one connected peer, see {@link NetworkController.netStats}. */
export interface NetPeerStats extends PeerInfo {
  /** the clock offset estimate `offsetMs` is slewing toward, ms */
  targetOffsetMs: number;
  clockSamples: number;
  /** whether the peer's timestamps are converted yet (they count as "now" until then) */
  clockReady: boolean;
  /** time since anything was heard from the peer, ms */
  silentMs: number;
  /** networked entities the peer owns */
  owned: number;
  received: NetTrafficCounters;
  /**
   * cumulative age of the peer's state snapshots when they arrived (and how many), counted once its
   * clock is ready: the one-way latency as the synced clocks see it
   */
  stateAgeSumMs: number;
  stateAgeCount: number;
  /** state messages of the peer that arrived, and that never did (gaps in its message counter) */
  stateMessages: number;
  stateMessagesLost: number;
  /** times a replica of one of the peer's entities was teleported because it was beyond `snapDistance` */
  snaps: number;
  /**
   * how far, in total, a new snapshot of the peer moved the point its replica was being steered to
   * (the old snapshot and the new one, both extrapolated to the moment of arrival), over how many
   * snapshots: near zero for steady motion on a good link, whatever the latency
   */
  targetJumpSum: number;
  targetJumpCount: number;
  /** how many of those jumps were lunges: above a quarter of `snapDistance` */
  lunges: number;
}

/** A reading of the controller's live numbers; counters are cumulative, so rates are the difference of two readings. */
export interface NetStats {
  sessionState: NetworkSessionState;
  localPeerId: string;
  sendRate: number | 'tick';
  keepaliveRate: number;
  /** networked entities, and how many of them the local peer owns / possesses / corrects as replicas */
  entities: number;
  owned: number;
  possessed: number;
  replicas: number;
  /** messages handed to the transport, counted once per target peer */
  sent: NetTrafficCounters;
  received: NetTrafficCounters;
  /** unreliable messages the transport dropped over a backed-up send buffer, `null` if it doesn't count them */
  droppedUnreliable: number | null;
  /** the `net_lag` conditions, `null` when the link isn't conditioned */
  simulatedLag: string | null;
  peers: NetPeerStats[];
}

const newTrafficCounters = (): NetTrafficCounters => ({ messages: 0, stateItems: 0, bytes: 0 });

const countTraffic = (counters: NetTrafficCounters, msg: WireMessage, times: number, measureBytes: boolean): void => {
  counters.messages += times;
  if (msg.t === 'state') {
    counters.stateItems += msg.items.length * times;
  }
  if (measureBytes) {
    counters.bytes += JSON.stringify(msg).length * times;
  }
};

export type NetworkSessionState = 'idle' | 'connecting' | 'joined' | 'away' | 'left';

export interface NetworkControllerOptions<D> {
  /** what moves the messages - `WebRtcMeshTransport` for P2P, `LoopbackTransport` in-process */
  transport: ITransport;
  /**
   * The level loader runtime spawns are serialized with and rebuilt by - use the one the game
   * registers its own entity classes on. `Network2dController`/`Network3dController` default to the
   * world's own `loader` (a `Gg2dLevelLoader`/`Gg3dLevelLoader`).
   */
  levelLoader?: LevelLoader<any, any, any>;
  /** named blueprint graphs a spawned entity's `events` bindings may reference */
  blueprints?: Record<string, BlueprintJson>;
  /** Free-entity arbitration. Default `NearestPeerOwnership`, its distances scaled by `unitScale`. */
  ownership?: IOwnershipStrategy<D>;
  /**
   * World units per meter, so the defaults (correction deadzone/snap distance, the ownership floor
   * and contact impulse threshold) mean the same physical thing in every world. Default 1; the 2D
   * controller defaults to 100, the pixel scale every 2D physics adapter works in. Explicitly passed
   * `tuning`/`ownership` are used as given.
   */
  unitScale?: number;
  /** state broadcasts per second, or `'tick'` for every world tick; never above the tick rate. Default 30. */
  sendRate?: number | 'tick';
  /** broadcasts per second of an entity whose state hasn't changed (e.g. asleep). Default 2. */
  keepaliveRate?: number;
  /** replica correction tuning; entities may override per instance via `networkTuning` */
  tuning?: Partial<CorrectionTuning>;
  /** Free-entity arbitration runs every N world ticks. Default 15. */
  arbitrationIntervalTicks?: number;
  /** Default 1000. */
  heartbeatIntervalMs?: number;
  /**
   * a peer silent this long is taken over. Default 4000 (3+ missed heartbeats). Silence is never
   * measured across a stall of the local peer (a frozen main thread, a throttled timer): when neither
   * a world tick nor the heartbeat timer ran for over two heartbeat intervals, every peer and remote
   * owner counts as heard from just now.
   */
  heartbeatTimeoutMs?: number;
  /**
   * how often every peer is pinged for clock sync once its link is settled. Default 2000. A link that
   * just opened gets a burst first: `clockSyncBurstCount` pings `clockSyncBurstIntervalMs` apart.
   */
  clockSyncIntervalMs?: number;
  /** Default 5. */
  clockSyncBurstCount?: number;
  /** Default 150. */
  clockSyncBurstIntervalMs?: number;
  /** how long `connect()` waits for join dumps. Default 5000. */
  joinTimeoutMs?: number;
  /** state for an id with no local entity yet is held this long, then dropped. Default 2000. */
  unknownStateHoldMs?: number;
  /** a shared entity nobody answered a `stateRequest` for is claimed after this long. Default 1000. */
  stateRequestTimeoutMs?: number;
  /** a remote owner silent about one entity this long loses it to the nearest peer. Default 3000. */
  ownerSilenceTimeoutMs?: number;
  /** hand everything over when the tab is hidden, resync when it's back. Default true. */
  takeoverOnHidden?: boolean;
  /**
   * Whether the entities a departed (or away) peer possesses are taken over along with the Free ones
   * it owns. Default true: the taker owns them and their possession is cleared. `false`: a possessed
   * entity never changes hands - it stays owned and possessed by its peer, frozen with neutral input
   * on every other peer, until that peer is back or releases it. Must be the same on every peer.
   */
  takeoverPossessed?: boolean;
  /** after a resync, re-possess what was possessed before going away. Default true. */
  repossessOnReturn?: boolean;
  /**
   * Prefix auto-generated entity names with the local peer id while the controller is in a world,
   * so runtime spawns of different peers never share a name. The default-name middleware is
   * process-wide, so only one controller per process can prefix (a second one warns and doesn't).
   * Default true.
   */
  prefixEntityNames?: boolean;
  /** tint replicas' physics debug view (`debug_view`). Default true. */
  tintReplicas?: boolean;
  /** debug-view color of a replica body. Default 0xff6ec7. */
  replicaTint?: number;
  /** time source and timers. Default `realScheduler`. */
  scheduler?: NetScheduler;
}

/** One networked entity, as the controller tracks it. */
interface NetRecord {
  id: string;
  entity: IEntity & INetworkSyncable;
  shared: boolean;
  /** '' while unknown (a shared entity nobody has vouched for yet) */
  owner: string;
  /** -1 while unknown */
  epoch: number;
  possessor: string | null;
  lastSeq: number;
  latest: { s: unknown; i: unknown; localTs: number; snap: boolean; inputPending: boolean } | null;
  lastStateAt: number;
  lastSentJson: string | null;
  lastSentAt: number;
  lastTransferAt: number;
  lastContactClaimAt: number;
  acquiredByContactAt: number;
  expiresAt: number | null;
  inputDriven: boolean;
  requestedAt: number | null;
  /** linear velocity from the latest snapshot (sent or received) - pre-impact, for contact claims */
  snapshotVelocity: any | null;
  subscriptions: Subscription[];
}

interface PeerRecord {
  id: string;
  position: unknown | null | undefined;
  lastHeard: number;
  clock: ClockSync;
  /** clock-sync pings sent to this peer since its link opened, and when the last one went out */
  pingsSent: number;
  lastPingAt: number;
  away: boolean;
  received: NetTrafficCounters;
  stateAgeSumMs: number;
  stateAgeCount: number;
  /** counter (`n`) of the latest state message received, null before the first */
  lastStateN: number | null;
  stateMessages: number;
  stateMessagesLost: number;
  snaps: number;
  targetJumpSum: number;
  targetJumpCount: number;
  lunges: number;
}

interface PendingJoin {
  waitingFor: Set<string>;
  dumps: Extract<WireMessage, { t: 'joinDump' }>[];
  resolve: () => void;
}

/** `lv` of a `RigidBodyNetState`-shaped payload (any syncable whose state carries one), else null */
/**
 * where a replica of a snapshot `ageMs` old is steered to, the way the correction helpers extrapolate
 * it - for a state carrying a position `p` and a velocity (`lv` of a rigid body, `v` of a mover),
 * else null
 */
function extrapolatedPosition(
  s: unknown,
  ageMs: number,
  tuning: CorrectionTuning,
): { x: number; y: number; z?: number } | null {
  const p = (s as any)?.p;
  const v = (s as any)?.lv ?? (s as any)?.v;
  if (!p || typeof p.x !== 'number' || !v || typeof v.x !== 'number') {
    return null;
  }
  const ageS = (s as any).s === true ? 0 : Math.max(0, Math.min(ageMs, tuning.extrapolateMaxMs)) / 1000;
  return {
    x: p.x + v.x * ageS,
    y: p.y + v.y * ageS,
    z: typeof p.z === 'number' ? p.z + (v.z ?? 0) * ageS : undefined,
  };
}

function velocityOfState(s: unknown): any | null {
  const lv = (s as any)?.lv;
  return lv && typeof lv.x === 'number' ? lv : null;
}

const SESSION_HOOK_REJECTION =
  'not available in a multiplayer session (a local-only edit of shared state desyncs peers)';
const CHAIN_BLOCK_MS = 2000;
// a longer gap in a peer's state message counter is a paused stream, not that many lost messages
const MAX_LOSS_GAP = 100;

/**
 * The world entity that makes a `GgWorld` multiplayer: it discovers every `INetworkSyncable` entity,
 * broadcasts the state of the ones the local peer owns, corrects the replicas of the rest, arbitrates
 * ownership of Free entities, and keeps runtime spawns, despawns, late joiners and departed peers in
 * step. Ticks at `TickOrder.NETWORK_IN` (remote input and corrections land before movers move);
 * captures and sends right after the physics step. Everything that must keep running while the world
 * clock is paused (heartbeats, clock sync, join handshakes) runs on the injected `NetScheduler`.
 *
 * Core has no notion of peers; possession exists only here: `possess(entity)` pins ownership of an
 * entity to the local peer until `release(entity)` - what a player can possess is game logic.
 *
 * Use `Network2dController`/`Network3dController` (they default the level loader); add the controller
 * to the world, then `await connect()`.
 */
export class NetworkController<D = any, R = any> extends IEntity<D, R> {
  static readonly entityTypeName: string = 'NetworkController';
  public readonly tickOrder = TickOrder.NETWORK_IN;

  public readonly transport: ITransport;
  public readonly ownership: IOwnershipStrategy<D>;
  public sendRate: number | 'tick';
  public keepaliveRate: number;
  /** correction tuning in effect (entity `networkTuning` overrides on top). Mutable, e.g. via `net_tuning`. */
  public readonly tuning: CorrectionTuning;
  public readonly conditioner: LinkConditioner;
  /**
   * Whether {@link netStats} also counts bytes: every message is serialized once more for it, so it is
   * off unless something reads them (the `net_panel` overlay turns it on while shown).
   */
  public measureTraffic = false;

  /**
   * Where the local player "is", for distance arbitration and zoning: return `null` while spectating
   * or dead (the peer then never claims nor holds Free entities). Defaults to the position of the
   * first locally possessed entity that has one.
   */
  public localPosition: () => D | null = () => {
    for (const rec of this.records.values()) {
      if (rec.possessor === this.localPeerId) {
        const p = positionOf<D>(rec.entity);
        if (p) {
          return p;
        }
      }
    }
    return null;
  };

  /** Game-level state for late joiners - the room's most senior peer's value arrives on `joinState$`. */
  public joinState: (() => unknown) | null = null;

  protected levelLoader: LevelLoader<any, any, any> | null;
  protected readonly blueprints: Record<string, BlueprintJson> | undefined;
  protected readonly scheduler: NetScheduler;
  private readonly opts: Required<
    Omit<
      NetworkControllerOptions<D>,
      | 'transport'
      | 'levelLoader'
      | 'blueprints'
      | 'ownership'
      | 'tuning'
      | 'scheduler'
      | 'sendRate'
      | 'keepaliveRate'
      | 'unitScale'
    >
  >;

  private readonly records = new Map<string, NetRecord>();
  private readonly recordsByEntity = new Map<IEntity, NetRecord>();
  private readonly pendingAdded = new Set<IEntity>();
  private readonly excluded = new WeakSet<IEntity>();
  private readonly markedShared = new WeakSet<IEntity>();
  private readonly sharedLevelGroups = new Set<IEntity>();
  private readonly sharedLevelNames = new Set<string>();
  private readonly sharedSources = new Set<string>();
  private readonly networkSpawned = new WeakSet<IEntity>();
  private readonly suppressRemoval = new WeakSet<IEntity>();
  private readonly lifetimes = new WeakMap<IEntity, number>();
  private readonly tombstones = new Set<string>();
  private readonly spawning = new Map<string, { from: string; msg: WireMessage }[]>();
  private readonly heldState = new Map<string, { item: StateItem; from: string; at: number }>();
  private readonly heldSpawnItems = new Map<string, { item: SpawnItem; from: string; at: number }>();
  /** connected peers */
  private readonly peers = new Map<string, PeerRecord>();
  /**
   * peers that left the room (transport `peerLeft$`) or went silent while connected - unlike a peer
   * merely out of zoning range (not connected, but still in the room and still owning its things)
   */
  private readonly departed = new Set<string>();
  /** last known position of every peer ever heard from, for takeover elections */
  private readonly lastPositions = new Map<string, unknown | null>();
  private readonly pendingStateRequests = new Set<string>();
  private desiredPossessions = new Set<IEntity>();
  private _roomSharedLevels: string[] = [];
  private seq = 0;
  private stateMessagesSent = 0;
  private joinedAt = 0;
  private tickCount = 0;
  private lastDelta = 16;
  /** when a world tick or the heartbeat timer last ran, see {@link checkStall} */
  private lastAliveAt = 0;
  private sendAccumulator = 0;
  private pendingJoin: PendingJoin | null = null;
  /** bumped by every `connect()` and `leave()`, so a join still in flight notices it was cancelled */
  private sessionGeneration = 0;
  private pausedForJoin = false;
  private previousEventAuthority: GgWorld<any, any>['eventAuthority'] | null = null;
  private previousCommandGuard: GgWorld<any, any>['commandGuard'] | null | undefined = undefined;
  private possessedBeforeAway: IEntity[] = [];
  /** whether a session was ever joined - a later `connect()` is a rejoin of entities this peer already holds */
  private everJoined = false;
  private contactPairsThisTick = new Set<string>();
  private readonly timers: unknown[] = [];
  private readonly subscriptions: Subscription[] = [];
  private readonly transportSubscriptions: Subscription[] = [];
  // sender of each received join dump, for clock conversion of its timestamps
  private readonly dumpSenders = new WeakMap<object, string>();
  private unregisterNameMiddleware: (() => void) | null = null;
  /** the controller whose peer id the process-wide default-name middleware currently prefixes */
  private static prefixingController: NetworkController | null = null;
  private readonly registeredCommands: string[] = [];
  private readonly sentCounters = newTrafficCounters();
  private readonly receivedCounters = newTrafficCounters();
  private readonly debugPanel = new NetDebugPanel(() => this.netStats);

  private readonly _sessionState$ = new BehaviorSubject<NetworkSessionState>('idle');
  private readonly _peers$ = new BehaviorSubject<ReadonlyArray<PeerInfo>>([]);
  private readonly _possessionChanged$ = new Subject<{ entity: IEntity; from: string | null; to: string | null }>();
  private readonly _ownershipChanged$ = new Subject<{ entity: IEntity; from: string; to: string; epoch: number }>();
  private readonly _appMessages$ = new Subject<{ from: string; data: unknown }>();
  private readonly _joinState$ = new ReplaySubject<unknown>(1);
  private readonly _spawnFailed$ = new Subject<{ entity: IEntity; reason: string }>();
  private readonly _resynced$ = new Subject<void>();

  constructor(options: NetworkControllerOptions<D>) {
    super();
    this.transport = options.transport;
    this.levelLoader = options.levelLoader ?? null;
    this.blueprints = options.blueprints;
    const unit = options.unitScale ?? 1;
    this.ownership =
      options.ownership ??
      new NearestPeerOwnership<D>({
        floor: DEFAULT_NEAREST_PEER_OWNERSHIP.floor * unit,
        contactImpulseThreshold: DEFAULT_NEAREST_PEER_OWNERSHIP.contactImpulseThreshold * unit,
      });
    this.sendRate = options.sendRate ?? 30;
    this.keepaliveRate = options.keepaliveRate ?? 2;
    this.tuning = {
      ...DEFAULT_CORRECTION_TUNING,
      deadzone: DEFAULT_CORRECTION_TUNING.deadzone * unit,
      snapDistance: DEFAULT_CORRECTION_TUNING.snapDistance * unit,
      ...(options.tuning ?? {}),
    };
    this.scheduler = options.scheduler ?? realScheduler;
    this.conditioner = new LinkConditioner(this.scheduler);
    this.opts = {
      arbitrationIntervalTicks: options.arbitrationIntervalTicks ?? 15,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 1000,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 4000,
      clockSyncIntervalMs: options.clockSyncIntervalMs ?? 2000,
      clockSyncBurstCount: options.clockSyncBurstCount ?? 5,
      clockSyncBurstIntervalMs: options.clockSyncBurstIntervalMs ?? 150,
      joinTimeoutMs: options.joinTimeoutMs ?? 5000,
      unknownStateHoldMs: options.unknownStateHoldMs ?? 2000,
      stateRequestTimeoutMs: options.stateRequestTimeoutMs ?? 1000,
      ownerSilenceTimeoutMs: options.ownerSilenceTimeoutMs ?? 3000,
      takeoverOnHidden: options.takeoverOnHidden ?? true,
      takeoverPossessed: options.takeoverPossessed ?? true,
      repossessOnReturn: options.repossessOnReturn ?? true,
      prefixEntityNames: options.prefixEntityNames ?? true,
      tintReplicas: options.tintReplicas ?? true,
      replicaTint: options.replicaTint ?? 0xff6ec7,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // public API
  // ---------------------------------------------------------------------------------------------

  get localPeerId(): string {
    return this.transport.localPeerId;
  }

  get sessionState(): NetworkSessionState {
    return this._sessionState$.getValue();
  }

  get sessionState$(): Observable<NetworkSessionState> {
    return this._sessionState$.asObservable();
  }

  get peers$(): Observable<ReadonlyArray<PeerInfo>> {
    return this._peers$.asObservable();
  }

  get peerInfos(): ReadonlyArray<PeerInfo> {
    return this._peers$.getValue();
  }

  /** Live network numbers (what the `net_panel` overlay shows), for an app's own HUD or logging. */
  get netStats(): NetStats {
    const now = this.now;
    const records = [...this.records.values()];
    const owned = records.filter(r => r.owner === this.localPeerId).length;
    const dropped = (this.transport as { droppedUnreliable?: unknown }).droppedUnreliable;
    return {
      sessionState: this.sessionState,
      localPeerId: this.localPeerId,
      sendRate: this.sendRate,
      keepaliveRate: this.keepaliveRate,
      entities: records.length,
      owned,
      possessed: records.filter(r => r.possessor === this.localPeerId).length,
      replicas: records.length - owned,
      sent: { ...this.sentCounters },
      received: { ...this.receivedCounters },
      droppedUnreliable: typeof dropped === 'number' ? dropped : null,
      simulatedLag: this.conditioner.active ? this.conditioner.describe() : null,
      peers: [...this.peers.values()].map(p => ({
        peerId: p.id,
        position: p.position,
        rttMs: p.clock.rtt,
        offsetMs: p.clock.offset,
        away: p.away,
        targetOffsetMs: p.clock.targetOffset,
        clockSamples: p.clock.samples,
        clockReady: p.clock.ready,
        silentMs: Math.max(0, now - p.lastHeard),
        owned: records.filter(r => r.owner === p.id).length,
        received: { ...p.received },
        stateAgeSumMs: p.stateAgeSumMs,
        stateAgeCount: p.stateAgeCount,
        stateMessages: p.stateMessages,
        stateMessagesLost: p.stateMessagesLost,
        snaps: p.snaps,
        targetJumpSum: p.targetJumpSum,
        targetJumpCount: p.targetJumpCount,
        lunges: p.lunges,
      })),
    };
  }

  /** Whether the live network stats overlay (the `net_panel` console command) is shown. Browser only. */
  get showNetPanel(): boolean {
    return this.debugPanel.shown;
  }

  set showNetPanel(value: boolean) {
    this.debugPanel.shown = value;
    this.measureTraffic = this.debugPanel.shown;
  }

  get possessionChanged$(): Observable<{ entity: IEntity; from: string | null; to: string | null }> {
    return this._possessionChanged$.asObservable();
  }

  get ownershipChanged$(): Observable<{ entity: IEntity; from: string; to: string; epoch: number }> {
    return this._ownershipChanged$.asObservable();
  }

  /** game-level reliable messages sent by other peers via {@link send} */
  get appMessages$(): Observable<{ from: string; data: unknown }> {
    return this._appMessages$.asObservable();
  }

  /** the room's most senior peer's `joinState()` value, once, after joining */
  get joinState$(): Observable<unknown> {
    return this._joinState$.asObservable();
  }

  /** a locally spawned syncable entity the level loader can't serialize - it stays local-only */
  get spawnFailed$(): Observable<{ entity: IEntity; reason: string }> {
    return this._spawnFailed$.asObservable();
  }

  /** emits after returning from away (hidden tab) and finishing the resync */
  get resynced$(): Observable<void> {
    return this._resynced$.asObservable();
  }

  /** shared level sources the room reported on join (load these before registering your own) */
  get roomSharedLevels(): ReadonlyArray<string> {
    return this._roomSharedLevels;
  }

  /**
   * Connect the transport and join the room: alone, the local peer owns everything; otherwise the
   * world clock is paused while every peer's join dump arrives (runtime spawns are built, shared
   * entities snapped, possession and epochs adopted), then resumed.
   * A {@link leave} while connecting cancels the join: `connect()` then resolves without joining.
   * @throws if the transport fails to connect, or the room has shared levels and one registered
   * locally isn't among them - the controller is then back to `'idle'` and `connect()` may be retried
   */
  async connect(): Promise<void> {
    if (!this.world) {
      throw new Error('Add the NetworkController to a world before connecting');
    }
    if (this.sessionState !== 'idle' && this.sessionState !== 'left') {
      return;
    }
    this._sessionState$.next('connecting');
    const generation = ++this.sessionGeneration;
    try {
      this.subscribeTransport();
      await this.transport.connect();
      if (generation !== this.sessionGeneration) {
        return;
      }
      this.joinedAt = this.now;
      this.startTimers();
      const others = [...this.transport.peers];
      if (others.length > 0) {
        await this.requestDumps(others, this.everJoined ? 'rejoin' : 'join');
      }
    } catch (e) {
      if (generation !== this.sessionGeneration) {
        return; // left while connecting - whatever failed belongs to the cancelled join
      }
      this.teardownSession();
      this._sessionState$.next('idle');
      throw e;
    }
    if (generation !== this.sessionGeneration) {
      return;
    }
    this.installSessionHooks();
    this.everJoined = true;
    this._sessionState$.next('joined');
    this.processPending();
    this.possessDesired();
  }

  /**
   * Leave the room: disconnect the transport (peers take over what this peer owned) and restore
   * single-player hooks. Alone again, the local peer owns every entity and keeps its possessions; a
   * later {@link connect} adopts the room's ownership and re-possesses them at once.
   */
  leave(): void {
    if (this.sessionState === 'idle' || this.sessionState === 'left') {
      return;
    }
    for (const rec of this.records.values()) {
      if (rec.possessor === this.localPeerId) {
        this.desiredPossessions.add(rec.entity);
      }
    }
    for (const entity of this.possessedBeforeAway) {
      this.desiredPossessions.add(entity);
    }
    this.possessedBeforeAway = [];
    this.sessionGeneration++;
    this.teardownSession();
    for (const rec of this.records.values()) {
      if (rec.possessor !== null && rec.possessor !== this.localPeerId) {
        this.setPossessor(rec, null);
      }
      if (rec.owner !== this.localPeerId) {
        this.setOwner(rec, this.localPeerId, Math.max(rec.epoch, 0));
      }
    }
    this.departed.clear();
    this.lastPositions.clear();
    this.heldState.clear();
    this.heldSpawnItems.clear();
    this.pendingStateRequests.clear();
    this._sessionState$.next('left');
  }

  /**
   * Make the local peer possessor (and owner) of `entity`: its state is broadcast from here, its
   * input forwarded, and nobody else takes it until {@link release} (or a takeover after this peer
   * goes away). Possessing a Free entity another peer owns transfers it in the same message.
   * Outside a joined session (connecting, away, left), or while the entity can't be registered yet
   * (a remote spawn is still being built), the possession is queued and taken as soon as it can be.
   * @returns `false` when another peer possesses it - the game decides what to show
   */
  possess(entity: IEntity): boolean {
    if (this.sessionState !== 'joined') {
      this.desiredPossessions.add(entity);
      return true;
    }
    const rec = this.ensureRecord(entity);
    if (!rec && this.pendingAdded.has(entity)) {
      this.desiredPossessions.add(entity);
      return true;
    }
    if (!rec) {
      warnOnce(`NetworkController: cannot possess "${entity.name}" - it isn't a networked entity`);
      return false;
    }
    if (rec.possessor && rec.possessor !== this.localPeerId) {
      return false;
    }
    if (rec.possessor === this.localPeerId) {
      return true;
    }
    const epoch = rec.epoch + 1;
    this.setOwner(rec, this.localPeerId, epoch);
    this.setPossessor(rec, this.localPeerId);
    this.broadcast({ t: 'possess', entityId: rec.id, epoch, peerId: this.localPeerId });
    return true;
  }

  /** Clear the local peer's possession of `entity`; it re-enters Free arbitration at once. */
  release(entity: IEntity): void {
    this.desiredPossessions.delete(entity);
    const rec = this.recordsByEntity.get(entity);
    if (!rec || rec.possessor !== this.localPeerId) {
      return;
    }
    rec.epoch += 1;
    this.setPossessor(rec, null);
    this.broadcast({ t: 'release', entityId: rec.id, epoch: rec.epoch });
  }

  possessorOf(entity: IEntity): string | null {
    return this.recordsByEntity.get(entity)?.possessor ?? null;
  }

  isLocallyPossessed(entity: IEntity): boolean {
    return this.possessorOf(entity) === this.localPeerId;
  }

  /** current owner ('' while unknown); a non-networked entity is reported as locally owned */
  ownerOf(entity: IEntity): string {
    const rec = this.recordsByEntity.get(entity);
    return rec ? rec.owner : this.localPeerId;
  }

  isLocallyOwned(entity: IEntity): boolean {
    return this.ownerOf(entity) === this.localPeerId;
  }

  /** whether `entity` takes part in networking */
  isNetworked(entity: IEntity): boolean {
    return this.recordsByEntity.has(entity);
  }

  /** Keep `entity` (and anything under it) out of networking, e.g. purely local debris. */
  exclude(entity: IEntity): void {
    this.excluded.add(entity);
    this.pendingAdded.delete(entity);
    const rec = this.recordsByEntity.get(entity);
    if (rec) {
      this.unregister(rec);
    }
  }

  /**
   * Declare entities shared content: built locally by every peer from the same source with the same
   * deterministic names (a chunk's cars, a seeded spawn). Shared entities never travel as spawn
   * descriptors - only their state does; a peer that loads one asks the room for its current state.
   * Name them explicitly: auto-generated names differ between peers (see `prefixEntityNames`).
   * Call right after creating them (before the next world tick).
   */
  markShared(entities: IEntity | IEntity[]): void {
    for (const entity of Array.isArray(entities) ? entities : [entities]) {
      this.markedShared.add(entity);
    }
  }

  /**
   * Declare a level shared content (every peer loads it itself). Pass the level's group, or - to
   * cover entities while the level is still loading - its `levelName` before calling `loadLevel`.
   * `source` identifies the level document: levels registered before `connect()` are checked
   * against the room's when joining (a joiner with a different level is refused); one registered
   * later is new content the room moves on to (the next round, the next area).
   */
  registerSharedLevel(levelOrName: IEntity | string, source: string): void {
    this.sharedSources.add(source);
    if (typeof levelOrName === 'string') {
      this.sharedLevelNames.add(levelOrName);
    } else {
      this.sharedLevelGroups.add(levelOrName);
      this.sharedLevelNames.add(levelOrName.name);
    }
  }

  /** Load a level JSON as shared content: registers it, then loads it through the level loader. */
  async loadSharedLevel(levelJson: LevelJson, levelName: string, source: string = levelName): Promise<GroupEntity> {
    this.registerSharedLevel(levelName, source);
    const level = await this.requireLoader().loadLevel(levelJson, levelName);
    this.sharedLevelGroups.add(level);
    return level as GroupEntity;
  }

  /**
   * Remove `entity` on every peer (a coin picked up, a sign destroyed) - a plain `removeEntity` of a
   * shared entity is only a local unload. Works for a networked entity and for any shared entity
   * (networked or not - e.g. a trigger in a shared level), which peers that load it later remove
   * too. Only the peer holding event authority should call it.
   */
  despawn(entity: IEntity): void {
    const rec = this.ensureRecord(entity);
    if (rec) {
      if (rec.shared) {
        this.tombstones.add(rec.id);
      }
      this.broadcast({ t: 'despawn', entityId: rec.id, epoch: rec.epoch, ...(rec.shared ? { shared: true } : {}) });
    } else if (this.isShared(entity)) {
      // shared content that isn't itself networked (a trigger, a decoration): removed by name
      this.tombstones.add(entity.name);
      this.broadcast({ t: 'despawn', entityId: entity.name, epoch: 0, shared: true });
    }
    this.removeLocally(entity);
  }

  /** Despawn `entity` everywhere after `ms` (its owner removes it; replicas time out as a fallback). */
  setLifetime(entity: IEntity, ms: number): void {
    const rec = this.recordsByEntity.get(entity);
    if (rec) {
      rec.expiresAt = this.now + ms;
    } else {
      this.lifetimes.set(entity, ms);
    }
  }

  /** Broadcast a game-level reliable message (scores, round timer, ...). Arrives on peers' `appMessages$`. */
  send(data: unknown): void {
    this.broadcast({ t: 'app', data });
  }

  /**
   * Whether the local peer holds authority over an event: a trigger enter/exit belongs to the owner
   * of the entering entity; a collision between two networked entities to the owner with the
   * lexically smaller peer id; an event with no networked participant runs locally. A peer that
   * doesn't know the owner of a participant yet (a shared entity awaiting its state) defers to the
   * peers that do. Installed as `world.eventAuthority` while joined, so level JSON `events`
   * bindings run once across the room.
   */
  hasAuthority(entity: IEntity, _eventName: string, payload: unknown): boolean {
    if (this.sessionState !== 'joined' && this.sessionState !== 'away') {
      return true;
    }
    const owners: string[] = [];
    let unknownOwner = false;
    const consider = (e: unknown) => {
      if (!(e instanceof IEntity)) {
        return;
      }
      const rec = this.recordOfDescendant(e);
      if (rec && rec.owner) {
        owners.push(rec.owner);
      } else if (rec) {
        unknownOwner = true;
      }
    };
    consider(entity);
    consider(payload);
    if (payload && typeof payload === 'object' && !(payload instanceof IEntity)) {
      consider((payload as any).entity);
      consider((payload as any).otherBody?.entity);
    }
    if (unknownOwner) {
      return false;
    }
    if (owners.length === 0) {
      return true;
    }
    owners.sort();
    return owners[0] === this.localPeerId;
  }

  // ---------------------------------------------------------------------------------------------
  // entity lifecycle
  // ---------------------------------------------------------------------------------------------

  onSpawned(world: GgWorld<D, R>): void {
    super.onSpawned(world);
    this.installNamePrefix();
    if (!this.levelLoader) {
      this.levelLoader = this.createDefaultLevelLoader(world);
    }
    this.subscriptions.push(
      world.entityAdded$.subscribe(e => this.pendingAdded.add(e)),
      world.entityRemoved$.subscribe(e => this.onEntityRemoved(e)),
      world.visibility$.subscribe(visible => this.onVisibility(visible)),
      world.tickForwardedTo$.pipe(filter(x => x === 'PHYSICS_WORLD')).subscribe(() => this.afterPhysics()),
    );
    const scan = (entities: IEntity[]) => {
      for (const e of entities) {
        this.pendingAdded.add(e);
        scan(e.children);
      }
    };
    scan(world.children);
    this.tick$.subscribe(([, delta]) => this.networkIn(delta));
    this.registerConsoleCommands(world);
  }

  onRemoved(): void {
    const world = this.world;
    this.leave();
    for (const s of this.subscriptions) {
      s.unsubscribe();
    }
    this.subscriptions.length = 0;
    if (world) {
      this.deregisterConsoleCommands(world);
    }
    this.showNetPanel = false;
    this.uninstallNamePrefix();
    super.onRemoved();
  }

  dispose(): void {
    if (this.world) {
      this.world.removeEntity(this);
    }
    this.leave();
    this.uninstallNamePrefix();
    for (const rec of [...this.records.values()]) {
      this.unregister(rec);
    }
    this._sessionState$.complete();
    this._peers$.complete();
    this._possessionChanged$.complete();
    this._ownershipChanged$.complete();
    this._appMessages$.complete();
    this._joinState$.complete();
    this._spawnFailed$.complete();
    this._resynced$.complete();
    super.dispose();
  }

  private installNamePrefix(): void {
    if (!this.opts.prefixEntityNames || this.unregisterNameMiddleware) {
      return;
    }
    if (NetworkController.prefixingController) {
      warnOnce(
        'NetworkController: another controller already prefixes default entity names in this process - ' +
          'pass `prefixEntityNames: false` to all but one',
      );
      return;
    }
    NetworkController.prefixingController = this;
    const unregister = IEntity.useDefaultNameMiddleware(name => `${this.localPeerId}.${name}`);
    this.unregisterNameMiddleware = () => {
      unregister();
      NetworkController.prefixingController = null;
    };
  }

  private uninstallNamePrefix(): void {
    this.unregisterNameMiddleware?.();
    this.unregisterNameMiddleware = null;
  }

  /** Build the level loader used when none was passed - overridden by the 2D/3D controllers. */
  protected createDefaultLevelLoader(_world: GgWorld<D, R>): LevelLoader<any, any, any> | null {
    return null;
  }

  // ---------------------------------------------------------------------------------------------
  // tick
  // ---------------------------------------------------------------------------------------------

  private get now(): number {
    return this.scheduler.now();
  }

  private get joined(): boolean {
    return this.sessionState === 'joined';
  }

  private networkIn(delta: number): void {
    this.lastDelta = delta;
    this.contactPairsThisTick.clear();
    if (!this.joined && this.sessionState !== 'away') {
      return;
    }
    this.checkStall();
    this.tickCount++;
    if (this.joined) {
      this.processPending();
      this.possessDesired();
    }
    const now = this.now;
    for (const rec of this.records.values()) {
      if (rec.owner === this.localPeerId || !rec.owner || !rec.latest) {
        if (rec.owner === this.localPeerId && rec.expiresAt !== null && now >= rec.expiresAt && this.joined) {
          this.despawn(rec.entity);
        }
        continue;
      }
      if (rec.expiresAt !== null && now >= rec.expiresAt + 1000) {
        // owner should have despawned it by now - fall back to a local removal
        this.removeLocally(rec.entity);
        continue;
      }
      const latest = rec.latest;
      if (latest.inputPending && rec.inputDriven && rec.possessor && rec.possessor !== this.localPeerId) {
        (rec.entity as any).applyRemoteInput(latest.i ?? null);
      }
      latest.inputPending = false;
      try {
        const outcome = rec.entity.applyNetworkState(latest.s, {
          ageMs: Math.max(0, now - latest.localTs),
          dt: delta,
          snap: latest.snap,
          tuning: rec.entity.networkTuning ? { ...this.tuning, ...rec.entity.networkTuning } : this.tuning,
        });
        if (outcome === 'snap' && !latest.snap) {
          // nobody asked for this one: the replica was too far from where its owner says it is
          const owner = this.peers.get(rec.owner);
          if (owner) {
            owner.snaps++;
          }
        }
      } catch (e) {
        warnOnce(`NetworkController: applyNetworkState of "${rec.id}" threw: ${e}`);
      }
      latest.snap = false;
    }
    if (this.joined && this.tickCount % this.opts.arbitrationIntervalTicks === 0) {
      this.arbitrate();
    }
    if (this.pendingStateRequests.size > 0) {
      this.broadcast({ t: 'stateRequest', ids: [...this.pendingStateRequests] });
      this.pendingStateRequests.clear();
    }
    if (this.world && !this.world.physicsWorld) {
      // no physics step to hook the capture onto
      this.afterPhysics();
    }
  }

  private afterPhysics(): void {
    if (!this.joined) {
      return;
    }
    let due: boolean;
    if (this.sendRate === 'tick') {
      due = true;
    } else {
      const interval = 1000 / Math.max(0.001, this.sendRate);
      this.sendAccumulator += this.lastDelta;
      due = this.sendAccumulator >= interval;
      if (due) {
        this.sendAccumulator = Math.min(this.sendAccumulator - interval, interval);
      }
    }
    if (due) {
      this.flushState();
    }
  }

  private flushState(): void {
    if (this.transport.peers.length === 0) {
      return;
    }
    const now = this.now;
    const keepaliveMs = 1000 / Math.max(0.001, this.keepaliveRate);
    const items: StateItem[] = [];
    const seq = ++this.seq;
    for (const rec of this.records.values()) {
      if (rec.owner !== this.localPeerId || rec.epoch < 0) {
        continue;
      }
      let s: unknown;
      let i: unknown = undefined;
      try {
        s = rec.entity.captureNetworkState();
        if (rec.possessor === this.localPeerId && rec.inputDriven) {
          i = (rec.entity as any).captureLocalInput();
        }
      } catch (e) {
        warnOnce(`NetworkController: capturing "${rec.id}" threw: ${e}`);
        continue;
      }
      // compared as a string snapshot, not against the captured objects: an entity may return objects
      // it keeps mutating, and a kept reference would then always equal the next capture
      const json = JSON.stringify([s, i, rec.epoch, rec.possessor]);
      if (json === rec.lastSentJson && now - rec.lastSentAt < keepaliveMs) {
        continue;
      }
      rec.lastSentJson = json;
      rec.lastSentAt = now;
      rec.snapshotVelocity = velocityOfState(s);
      const item: StateItem = { id: rec.id, owner: this.localPeerId, epoch: rec.epoch, seq, ts: now, s };
      if (i !== undefined) {
        item.i = i;
      }
      if (rec.possessor) {
        item.pp = rec.possessor;
      }
      items.push(item);
    }
    if (items.length === 0) {
      return;
    }
    // one send for every stream target, so the message is serialized once
    this.transmit(this.transport.streamTargets?.() ?? 'all', 'unreliable', {
      t: 'state',
      items,
      n: ++this.stateMessagesSent,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // registration
  // ---------------------------------------------------------------------------------------------

  private processPending(): void {
    if (this.pendingAdded.size === 0 || this.spawning.size > 0) {
      // while a remote spawn is being built its generator may already have added the entity to the
      // world (under a provisional name) - classifying now would mistake it for a local spawn
      return;
    }
    const pending = [...this.pendingAdded];
    this.pendingAdded.clear();
    for (const entity of pending) {
      if (entity.world && this.tombstones.has(entity.name) && this.isShared(entity)) {
        this.removeLocally(entity); // shared content despawned before this peer loaded it
        continue;
      }
      this.tryRegister(entity);
    }
  }

  /** take the possessions queued while they couldn't be taken (see {@link possess}) */
  private possessDesired(): void {
    if (this.desiredPossessions.size === 0) {
      return;
    }
    const desired = [...this.desiredPossessions];
    this.desiredPossessions.clear();
    for (const entity of desired) {
      if (entity.world) {
        this.possess(entity);
      }
    }
  }

  private ensureRecord(entity: IEntity): NetRecord | null {
    const existing = this.recordsByEntity.get(entity);
    if (existing) {
      return existing;
    }
    if (this.joined && this.pendingAdded.has(entity) && this.spawning.size === 0) {
      this.pendingAdded.delete(entity);
      return this.tryRegister(entity);
    }
    return null;
  }

  private isNetworkCandidate(entity: IEntity): entity is IEntity & INetworkSyncable {
    return (
      entity !== this &&
      isNetworkSyncable(entity) &&
      (entity as INetworkSyncable).isNetworkSyncEnabled !== false &&
      !this.excluded.has(entity)
    );
  }

  private hasNetworkedAncestor(entity: IEntity): boolean {
    for (let p = entity.parent; p; p = p.parent) {
      if (this.excluded.has(p) || this.isNetworkCandidate(p)) {
        return true;
      }
    }
    return false;
  }

  private isShared(entity: IEntity): boolean {
    if (this.markedShared.has(entity)) {
      return true;
    }
    for (let p: IEntity | null = entity; p; p = p.parent) {
      if (this.sharedLevelGroups.has(p) || (p !== entity && this.sharedLevelNames.has(p.name))) {
        return true;
      }
    }
    return false;
  }

  /** the record of `entity` or of its nearest networked ancestor */
  private recordOfDescendant(entity: IEntity): NetRecord | null {
    for (let e: IEntity | null = entity; e; e = e.parent) {
      const rec = this.recordsByEntity.get(e);
      if (rec) {
        return rec;
      }
    }
    return null;
  }

  private tryRegister(entity: IEntity): NetRecord | null {
    if (!this.world || entity.world !== this.world || this.recordsByEntity.has(entity)) {
      return this.recordsByEntity.get(entity) ?? null;
    }
    if (!this.isNetworkCandidate(entity) || this.hasNetworkedAncestor(entity)) {
      return null;
    }
    if (this.networkSpawned.has(entity)) {
      return null; // registered by the spawn path itself
    }
    const id = entity.name;
    const clash = this.records.get(id);
    if (clash) {
      warnOnce(
        `NetworkController: two networked entities are named "${id}" - names are network ids; ignoring the second`,
      );
      return null;
    }
    const shared = this.isShared(entity);
    if (shared && this.tombstones.has(id)) {
      this.removeLocally(entity);
      return null;
    }
    const rec = this.createRecord(entity, shared);
    const lifetime = this.lifetimes.get(entity);
    if (lifetime !== undefined) {
      rec.expiresAt = this.now + lifetime;
      this.lifetimes.delete(entity);
    }
    if (shared) {
      const held = this.heldSpawnItems.get(id);
      if (held) {
        this.heldSpawnItems.delete(id);
        this.applySpawnItem(rec, held.item, held.from, false);
      } else if (this.transport.peers.length === 0) {
        this.setOwner(rec, this.localPeerId, 0);
      } else {
        rec.requestedAt = this.now;
        this.pendingStateRequests.add(id);
      }
    } else {
      this.setOwner(rec, this.localPeerId, 0);
      if (!this.broadcastSpawn(rec)) {
        this.unregister(rec);
        return null;
      }
    }
    const heldState = this.heldState.get(id);
    if (heldState) {
      this.heldState.delete(id);
      this.acceptStateItem(rec, heldState.item, heldState.from);
      if (rec.latest) {
        rec.latest.snap = true;
      }
    }
    return rec;
  }

  private createRecord(entity: IEntity & INetworkSyncable, shared: boolean): NetRecord {
    const rec: NetRecord = {
      id: entity.name,
      entity,
      shared,
      owner: '',
      epoch: -1,
      possessor: null,
      lastSeq: -1,
      latest: null,
      lastStateAt: this.now,
      lastSentJson: null,
      lastSentAt: -Infinity,
      lastTransferAt: -Infinity,
      lastContactClaimAt: -Infinity,
      acquiredByContactAt: -Infinity,
      expiresAt: null,
      inputDriven: isNetworkInputDriven(entity),
      requestedAt: null,
      snapshotVelocity: null,
      subscriptions: [],
    };
    this.records.set(rec.id, rec);
    this.recordsByEntity.set(entity, rec);
    const body = this.bodyOf(entity);
    if (body?.onCollisionStart) {
      rec.subscriptions.push(
        body.onCollisionStart.subscribe((evt: CollisionEvent<D>) => this.onLocalCollision(rec, evt)),
      );
    }
    return rec;
  }

  private unregister(rec: NetRecord): void {
    for (const s of rec.subscriptions) {
      s.unsubscribe();
    }
    rec.subscriptions.length = 0;
    this.applyTint(rec, true);
    if (this.records.get(rec.id) === rec) {
      this.records.delete(rec.id);
    }
    this.recordsByEntity.delete(rec.entity);
  }

  private onEntityRemoved(entity: IEntity): void {
    this.pendingAdded.delete(entity);
    const rec = this.recordsByEntity.get(entity);
    if (!rec) {
      return;
    }
    this.unregister(rec);
    if (this.suppressRemoval.has(entity)) {
      this.suppressRemoval.delete(entity);
      return;
    }
    if (!this.joined) {
      return;
    }
    if (rec.shared) {
      if (rec.owner === this.localPeerId) {
        this.broadcast({ t: 'relinquish', ids: [rec.id] });
      }
    } else if (rec.owner === this.localPeerId) {
      this.broadcast({ t: 'despawn', entityId: rec.id, epoch: rec.epoch });
    } else {
      console.warn(
        `NetworkController: "${rec.id}" is owned by peer "${rec.owner}" but was removed locally - ` +
          `remote state for it will be ignored; use net.despawn() on the owner to remove it everywhere`,
      );
    }
  }

  private findEntity(name: string): IEntity | null {
    try {
      return this.world?.getEntityByName(name) ?? null;
    } catch {
      return null;
    }
  }

  private removeLocally(entity: IEntity): void {
    if (!entity.world) {
      return;
    }
    this.suppressRemoval.add(entity);
    if (entity.parent) {
      entity.parent.removeChildren([entity], true);
    } else {
      entity.world.removeEntity(entity, true);
    }
    this.suppressRemoval.delete(entity);
  }

  /** the `spawn` message describing `rec`, or undefined when its level loader can't serialize it */
  private spawnMessage(rec: NetRecord): WireMessage | undefined {
    let descriptor: EntityJson | undefined;
    try {
      descriptor = this.requireLoader().serializeEntity(rec.entity);
    } catch (e) {
      descriptor = undefined;
    }
    if (!descriptor) {
      return undefined;
    }
    return {
      t: 'spawn',
      entityId: rec.id,
      descriptor,
      owner: rec.owner,
      epoch: rec.epoch,
      possessor: rec.possessor,
      ts: this.now,
      ...(rec.expiresAt !== null ? { expiresAt: rec.expiresAt } : {}),
      full: this.captureFull(rec),
    };
  }

  private broadcastSpawn(rec: NetRecord): boolean {
    const msg = this.spawnMessage(rec);
    if (!msg) {
      const reason =
        `NetworkController: cannot network the runtime spawn "${rec.id}" - its level loader can't serialize it ` +
        `(register its class on the loader passed to the controller, or mark it shared / exclude it)`;
      console.error(reason);
      this._spawnFailed$.next({ entity: rec.entity, reason });
      return false;
    }
    if (this.transport.peers.length === 0) {
      return true;
    }
    this.broadcast(msg);
    return true;
  }

  private captureFull(rec: NetRecord): unknown {
    return rec.entity.captureFullNetworkState ? rec.entity.captureFullNetworkState() : rec.entity.captureNetworkState();
  }

  private toSpawnItem(rec: NetRecord, withDescriptor: boolean): SpawnItem {
    const item: SpawnItem = {
      entityId: rec.id,
      owner: rec.owner,
      epoch: rec.epoch,
      possessor: rec.possessor,
      ts: this.now,
      full: this.captureFull(rec),
    };
    if (withDescriptor && !rec.shared) {
      const descriptor = this.levelLoader?.serializeEntity(rec.entity);
      if (descriptor) {
        item.descriptor = descriptor;
      }
    }
    if (rec.expiresAt !== null) {
      item.expiresAt = rec.expiresAt;
    }
    return item;
  }

  private requireLoader(): LevelLoader<any, any, any> {
    if (!this.levelLoader) {
      throw new Error('NetworkController needs a levelLoader (pass one in the options)');
    }
    return this.levelLoader;
  }

  private bodyOf(entity: IEntity): any {
    const e = entity as any;
    return e.objectBody ?? e.raycastVehicle?.objectBody ?? null;
  }

  private debugSettingsOf(entity: IEntity): any {
    const e = entity as any;
    return (e.objectBody ?? e.raycastVehicle?.objectBody ?? e.characterController)?.debugBodySettings ?? null;
  }

  private applyTint(rec: NetRecord, clear = false): void {
    if (!this.opts.tintReplicas) {
      return;
    }
    const settings = this.debugSettingsOf(rec.entity);
    if (!settings || !('color' in settings)) {
      return;
    }
    settings.color = clear || rec.owner === this.localPeerId || !rec.owner ? undefined : this.opts.replicaTint;
  }

  // ---------------------------------------------------------------------------------------------
  // ownership
  // ---------------------------------------------------------------------------------------------

  private setOwner(rec: NetRecord, owner: string, epoch: number): void {
    const from = rec.owner;
    rec.owner = owner;
    rec.epoch = epoch;
    rec.lastSeq = -1;
    rec.lastStateAt = this.now;
    if (from === owner) {
      return;
    }
    rec.lastTransferAt = this.now;
    rec.lastSentJson = null;
    if (owner === this.localPeerId) {
      rec.latest = null;
      rec.requestedAt = null;
    }
    this.applyTint(rec);
    this._ownershipChanged$.next({ entity: rec.entity, from, to: owner, epoch });
  }

  private setPossessor(rec: NetRecord, possessor: string | null): void {
    const from = rec.possessor;
    if (from === possessor) {
      return;
    }
    rec.possessor = possessor;
    if (possessor === null && from !== null && from !== this.localPeerId && rec.inputDriven) {
      (rec.entity as any).applyRemoteInput(null);
    }
    this._possessionChanged$.next({ entity: rec.entity, from, to: possessor });
  }

  /**
   * The acceptance rule shared by claims, possessions, takeovers and state items: a higher epoch
   * wins; at an equal epoch a possession beats a plain claim, then the lexically smaller peer id wins.
   */
  private wins(rec: NetRecord, epoch: number, candidate: string, possess: boolean): boolean {
    if (!rec.owner || rec.epoch < 0) {
      return true;
    }
    if (epoch !== rec.epoch) {
      return epoch > rec.epoch;
    }
    if (candidate === rec.owner) {
      return possess && rec.possessor !== candidate;
    }
    const localPossessed = rec.possessor !== null;
    if (possess !== localPossessed) {
      return possess;
    }
    return candidate < rec.owner;
  }

  private transfer(rec: NetRecord, candidate: string): void {
    const epoch = rec.epoch + 1;
    this.setOwner(rec, candidate, epoch);
    this.broadcast({ t: 'claim', entityId: rec.id, epoch, candidate });
  }

  private peerPositions(): Map<string, D | null> {
    const map = new Map<string, D | null>();
    map.set(this.localPeerId, this.sessionState === 'away' ? null : this.localPosition());
    for (const peer of this.peers.values()) {
      if (!peer.away && peer.position !== undefined) {
        map.set(peer.id, peer.position as D | null);
      }
    }
    return map;
  }

  /**
   * a remote owner that can't hold a Free entity: departed, away, or reporting no position. A peer
   * that is merely not connected (out of zoning range, or not connected yet) keeps its entities.
   */
  private ownerUnavailable(owner: string): boolean {
    if (owner === this.localPeerId) {
      return false;
    }
    if (this.departed.has(owner)) {
      return true;
    }
    const peer = this.peers.get(owner);
    return !!peer && (peer.away || peer.position === null);
  }

  /** nearest peer with a position to `entity` (ties: lexically smaller id) */
  private nearestPeer(entity: IEntity, positions: Map<string, D | null>): string | null {
    const p = positionOf<D>(entity);
    let best: string | null = null;
    let bestD = Infinity;
    for (const [id, pos] of positions) {
      if (!pos) {
        continue;
      }
      const d = p ? distanceSq(p, pos) : 0;
      if (d < bestD || (d === bestD && best !== null && id < best)) {
        best = id;
        bestD = d;
      }
    }
    return best;
  }

  private arbitrate(): void {
    const positions = this.peerPositions();
    const local = positions.get(this.localPeerId) ?? null;
    const now = this.now;
    for (const rec of this.records.values()) {
      if (rec.possessor) {
        continue;
      }
      if (rec.owner === this.localPeerId) {
        const proposal = this.ownership.proposeOwner(rec.entity, rec.owner, positions, local, {
          msSinceLastTransfer: now - rec.lastTransferAt,
          msSinceLastContactClaim: now - rec.lastContactClaimAt,
        });
        if (proposal && proposal !== this.localPeerId && this.peers.has(proposal) && !this.ownerUnavailable(proposal)) {
          this.transfer(rec, proposal);
        }
        continue;
      }
      if (rec.owner === '' && rec.requestedAt !== null && now - rec.requestedAt < this.opts.stateRequestTimeoutMs) {
        continue;
      }
      const silent =
        rec.owner !== '' && this.peers.has(rec.owner) && now - rec.lastStateAt > this.opts.ownerSilenceTimeoutMs;
      if (rec.owner === '' || this.ownerUnavailable(rec.owner) || silent) {
        if (local && this.nearestPeer(rec.entity, positions) === this.localPeerId) {
          this.transfer(rec, this.localPeerId);
        } else if (rec.owner === '' && this.transport.peers.length === 0) {
          this.setOwner(rec, this.localPeerId, rec.epoch + 1);
        }
      }
    }
  }

  private onLocalCollision(rec: NetRecord, evt: CollisionEvent<D>): void {
    if (!this.joined) {
      return;
    }
    const otherEntity = (evt.otherBody as any)?.entity as IEntity | undefined;
    const other = otherEntity ? this.recordOfDescendant(otherEntity) : null;
    if (!other || other === rec) {
      return;
    }
    const pairKey = rec.id < other.id ? `${rec.id}|${other.id}` : `${other.id}|${rec.id}`;
    if (this.contactPairsThisTick.has(pairKey)) {
      return;
    }
    let localRec: NetRecord;
    let foreign: NetRecord;
    if (rec.owner === this.localPeerId && other.owner !== this.localPeerId) {
      localRec = rec;
      foreign = other;
    } else if (other.owner === this.localPeerId && rec.owner !== this.localPeerId) {
      localRec = other;
      foreign = rec;
    } else {
      return;
    }
    this.contactPairsThisTick.add(pairKey);
    if (foreign.possessor || !foreign.owner) {
      return;
    }
    const now = this.now;
    const byPossessed = localRec.possessor === this.localPeerId;
    if (!byPossessed && (localRec.possessor || now - localRec.acquiredByContactAt < CHAIN_BLOCK_MS)) {
      return; // claims don't chain
    }
    // the bodies' velocities right now are already post-impact (the solver ran) - the hit body
    // may well be the faster one; compare the speeds of the latest snapshots instead
    const ZERO = { x: 0, y: 0, z: 0 };
    const velocity = (r: NetRecord) => r.snapshotVelocity ?? this.bodyOf(r.entity)?.linearVelocity ?? ZERO;
    const vLocal = velocity(localRec);
    const vForeign = velocity(foreign);
    // some adapters report no impulse for a contact's first step (the solver hasn't run on it yet);
    // estimate one from the pre-impact closing speed and the lighter body's mass
    const mass = (r: NetRecord) => {
      const m = this.bodyOf(r.entity)?.bodyOptions?.mass;
      return typeof m === 'number' && m > 0 ? m : Infinity;
    };
    const lighter = Math.min(mass(localRec), mass(foreign));
    const estimatedImpulse = isFinite(lighter) ? Math.sqrt(distanceSq(vLocal, vForeign)) * lighter : 0;
    const claim = this.ownership.onContact(foreign.entity, evt, byPossessed, {
      msSinceLastTransfer: now - foreign.lastTransferAt,
      msSinceLastContactClaim: now - foreign.lastContactClaimAt,
      localSpeed: Math.sqrt(distanceSq(vLocal, ZERO)),
      foreignSpeed: Math.sqrt(distanceSq(vForeign, ZERO)),
      estimatedImpulse,
    });
    if (claim) {
      foreign.lastContactClaimAt = now;
      foreign.acquiredByContactAt = now;
      this.transfer(foreign, this.localPeerId);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // transport
  // ---------------------------------------------------------------------------------------------

  private subscribeTransport(): void {
    this.unsubscribeTransport();
    this.transportSubscriptions.push(
      this.transport.messages$.subscribe(({ from, msg }) =>
        this.conditioner.pass(
          channelOf(msg),
          () => {
            this.onMessage(from, msg);
            const peer = this.peers.get(from);
            if (peer) {
              countTraffic(this.receivedCounters, msg, 1, this.measureTraffic);
              countTraffic(peer.received, msg, 1, this.measureTraffic);
            }
          },
          from,
        ),
      ),
      this.transport.peers$.subscribe(ids => this.onPeersChanged(ids)),
      this.transport.peerLeft$.subscribe(id => this.onPeerGone(id)),
    );
  }

  private unsubscribeTransport(): void {
    for (const s of this.transportSubscriptions) {
      s.unsubscribe();
    }
    this.transportSubscriptions.length = 0;
  }

  /**
   * stop everything a session runs: timers, a join handshake in flight, the transport and its
   * subscriptions, the world hooks
   */
  private teardownSession(): void {
    this.stopTimers();
    this.pendingJoin?.resolve();
    this.pendingJoin = null;
    if (this.pausedForJoin) {
      this.pausedForJoin = false;
      this.world?.resumeWorld();
    }
    this.transport.disconnect();
    this.unsubscribeTransport();
    this.uninstallSessionHooks();
    this.peers.clear();
    this.publishPeers();
  }

  /** every outgoing message goes through here, so `netStats` counts it */
  private transmit(to: string | 'all' | ReadonlyArray<string>, channel: WireChannel, msg: WireMessage): void {
    const targets = to === 'all' ? this.transport.peers.length : typeof to === 'string' ? 1 : to.length;
    countTraffic(this.sentCounters, msg, targets, this.measureTraffic);
    this.transport.send(to, channel, msg);
  }

  private broadcast(msg: WireMessage): void {
    if (this.sessionState === 'idle' || this.sessionState === 'left') {
      return;
    }
    this.transmit('all', channelOf(msg), msg);
  }

  private startTimers(): void {
    this.timers.push(
      this.scheduler.setInterval(() => this.onHeartbeatTimer(), this.opts.heartbeatIntervalMs),
      this.scheduler.setInterval(
        () => this.onClockSyncTimer(),
        Math.min(this.opts.clockSyncIntervalMs, this.opts.clockSyncBurstIntervalMs),
      ),
    );
    this.lastAliveAt = this.now;
    this.onClockSyncTimer();
  }

  private stopTimers(): void {
    for (const t of this.timers) {
      this.scheduler.clearInterval(t);
    }
    this.timers.length = 0;
  }

  private heartbeatMessage(): WireMessage {
    const away = this.sessionState === 'away';
    return { t: 'heartbeat', pos: away ? null : this.localPosition(), ...(away ? { away: true } : {}) };
  }

  /**
   * Called by everything that judges silence (world tick, heartbeat timer). A gap of over two
   * heartbeat intervals since the last call means the local peer itself was stalled (frozen main
   * thread, throttled timers): what the others sent meanwhile is still queued, so their silence
   * proves nothing - count every peer and every remote owner as heard from just now.
   */
  private checkStall(): void {
    const now = this.now;
    const stalled = now - this.lastAliveAt > 2 * this.opts.heartbeatIntervalMs;
    this.lastAliveAt = now;
    if (!stalled) {
      return;
    }
    for (const peer of this.peers.values()) {
      peer.lastHeard = now;
    }
    for (const rec of this.records.values()) {
      if (rec.owner !== this.localPeerId && rec.lastStateAt !== -Infinity) {
        rec.lastStateAt = now;
      }
    }
  }

  private onHeartbeatTimer(): void {
    this.checkStall();
    const msg = this.heartbeatMessage();
    this.transport.updateLocalPosition?.((msg as any).pos);
    this.broadcast(msg);
    const now = this.now;
    for (const peer of [...this.peers.values()]) {
      if (now - peer.lastHeard > this.opts.heartbeatTimeoutMs) {
        // silent while still connected: crashed tab, closed laptop
        this.onPeerGone(peer.id);
      }
    }
    for (const [id, held] of this.heldState) {
      if (now - held.at > this.opts.unknownStateHoldMs) {
        this.heldState.delete(id);
      }
    }
    for (const [id, held] of this.heldSpawnItems) {
      if (now - held.at > 30_000) {
        this.heldSpawnItems.delete(id);
      }
    }
    this.publishPeers();
  }

  /**
   * ping every peer that is due: a link that just opened is pinged every timer run until the burst is
   * out (and on, a few times over, while lost pings leave its clock without enough samples), a
   * settled one every `clockSyncIntervalMs`
   */
  private onClockSyncTimer(): void {
    const burst = this.opts.clockSyncBurstCount;
    for (const id of this.transport.peers) {
      const peer = this.peers.get(id);
      if (!peer) {
        continue;
      }
      const inBurst = peer.pingsSent < burst || (!peer.clock.ready && peer.pingsSent < burst * 4);
      if (inBurst || this.now - peer.lastPingAt >= this.opts.clockSyncIntervalMs) {
        this.sendPing(peer);
      }
    }
  }

  /**
   * pings and pongs travel unreliable: a retransmitted (or queued) one would arrive late and measure
   * the retransmission, not the clocks - a lost one is just a missing sample
   */
  private sendPing(peer: PeerRecord): void {
    peer.pingsSent++;
    peer.lastPingAt = this.now;
    this.transmit(peer.id, 'unreliable', { t: 'ping', t0: this.now });
  }

  private newPeerRecord(id: string): PeerRecord {
    return {
      id,
      position: undefined,
      lastHeard: this.now,
      clock: new ClockSync(),
      pingsSent: 0,
      lastPingAt: 0,
      away: false,
      received: newTrafficCounters(),
      stateAgeSumMs: 0,
      stateAgeCount: 0,
      lastStateN: null,
      stateMessages: 0,
      stateMessagesLost: 0,
      snaps: 0,
      targetJumpSum: 0,
      targetJumpCount: 0,
      lunges: 0,
    };
  }

  private onPeersChanged(ids: ReadonlyArray<string>): void {
    for (const id of [...this.peers.keys()]) {
      if (!ids.includes(id)) {
        // no longer connected (out of zoning range, reconnecting) - not departed: keep its entities
        this.peers.delete(id);
      }
    }
    for (const id of ids) {
      if (!this.peers.has(id)) {
        // a fresh record (also after a reconnect): its clock starts over, with a new ping burst
        const peer = this.newPeerRecord(id);
        this.peers.set(id, peer);
        if (this.sessionState !== 'idle' && this.sessionState !== 'left') {
          this.transmit(id, 'reliable', this.heartbeatMessage());
          this.sendPing(peer);
        }
        if (this.joined) {
          this.sendOwnedSpawns(id);
        }
      }
    }
    this.publishPeers();
  }

  /**
   * Send `peerId` a `spawn` of every runtime spawn the local peer owns: a link that opens after
   * joining (zoning, a slow or retried connection) never carried the earlier ones, and no join dump
   * follows. A peer still joining gets them in its dump as well - spawns are idempotent.
   */
  private sendOwnedSpawns(peerId: string): void {
    for (const rec of this.records.values()) {
      if (rec.owner !== this.localPeerId || rec.shared) {
        continue;
      }
      const msg = this.spawnMessage(rec);
      if (msg) {
        this.transmit(peerId, 'reliable', msg);
      }
    }
  }

  private publishPeers(): void {
    const infos: PeerInfo[] = [...this.peers.values()].map(p => ({
      peerId: p.id,
      position: p.position,
      rttMs: p.clock.rtt,
      offsetMs: p.clock.offset,
      away: p.away,
    }));
    this._peers$.next(infos);
  }

  private touchPeer(from: string): PeerRecord {
    let peer = this.peers.get(from);
    if (!peer) {
      peer = this.newPeerRecord(from);
      this.peers.set(from, peer);
      this.publishPeers();
    }
    this.departed.delete(from);
    peer.lastHeard = this.now;
    return peer;
  }

  /**
   * a peer's timestamp in local time - or now, until its clock sync is ready: the peers' clocks have
   * unrelated origins (`performance.now()` counts from each tab's start), so an unsynced timestamp
   * can be minutes off
   */
  private toLocalTime(from: string, ts: number): number {
    const clock = this.peers.get(from)?.clock;
    if (!clock || !clock.ready) {
      return this.now;
    }
    clock.advance(this.now);
    return clock.toLocal(ts);
  }

  private onMessage(from: string, msg: WireMessage): void {
    if (this.sessionState === 'idle' || this.sessionState === 'left') {
      return;
    }
    const peer = this.touchPeer(from);
    const spawningQueue = 'entityId' in msg ? this.spawning.get((msg as any).entityId) : undefined;
    if (spawningQueue && msg.t !== 'spawn') {
      spawningQueue.push({ from, msg });
      return;
    }
    switch (msg.t) {
      case 'state':
        this.countStateMessage(peer, msg.n);
        for (const item of msg.items) {
          const rec = this.records.get(item.id);
          if (rec) {
            this.acceptStateItem(rec, item, from);
          } else {
            this.heldState.set(item.id, { item, from, at: this.now });
          }
        }
        break;
      case 'claim':
        this.onClaim(msg.entityId, msg.epoch, msg.candidate);
        break;
      case 'possess': {
        const rec = this.records.get(msg.entityId);
        if (rec && this.wins(rec, msg.epoch, msg.peerId, true)) {
          this.setOwner(rec, msg.peerId, msg.epoch);
          this.setPossessor(rec, msg.peerId);
        }
        break;
      }
      case 'release': {
        const rec = this.records.get(msg.entityId);
        if (rec && msg.epoch >= rec.epoch && rec.possessor === from) {
          rec.epoch = msg.epoch;
          this.setPossessor(rec, null);
        }
        break;
      }
      case 'spawn':
        void this.onSpawn(from, msg);
        break;
      case 'despawn': {
        const rec = this.records.get(msg.entityId);
        if (msg.shared || rec?.shared) {
          this.tombstones.add(msg.entityId);
        }
        if (rec) {
          this.unregister(rec);
          this.removeLocally(rec.entity);
        } else {
          this.heldState.delete(msg.entityId);
          const local = this.findEntity(msg.entityId);
          if (local && this.isShared(local)) {
            this.removeLocally(local);
          }
        }
        break;
      }
      case 'joinRequest':
        this.transmit(from, 'reliable', this.buildJoinDump());
        break;
      case 'joinDump':
        if (this.pendingJoin && this.pendingJoin.waitingFor.has(from)) {
          this.dumpSenders.set(msg, from);
          this.pendingJoin.dumps.push(msg);
          this.pendingJoin.waitingFor.delete(from);
          if (this.pendingJoin.waitingFor.size === 0) {
            this.pendingJoin.resolve();
          }
        }
        break;
      case 'stateRequest': {
        const entities: SpawnItem[] = [];
        for (const id of msg.ids) {
          const rec = this.records.get(id);
          if (rec && rec.owner === this.localPeerId) {
            entities.push(this.toSpawnItem(rec, false));
          }
        }
        if (entities.length > 0) {
          this.transmit(from, 'reliable', { t: 'stateReply', entities });
        }
        break;
      }
      case 'stateReply':
        for (const item of msg.entities) {
          const rec = this.records.get(item.entityId);
          if (rec) {
            this.applySpawnItem(rec, item, from, false);
          } else {
            this.heldSpawnItems.set(item.entityId, { item, from, at: this.now });
          }
        }
        break;
      case 'relinquish':
        for (const id of msg.ids) {
          const rec = this.records.get(id);
          if (rec && rec.owner === from && !rec.possessor) {
            rec.lastStateAt = -Infinity;
            const local = this.sessionState === 'joined' ? this.localPosition() : null;
            if (local) {
              this.transfer(rec, this.localPeerId);
            }
          }
        }
        break;
      case 'takeover':
        if (from === msg.peerId) {
          // the sender is going away: elect a taker for what it holds
          peer.away = true;
          peer.position = null;
          this.electTakeover(msg.peerId);
          this.publishPeers();
        } else {
          this.onTakeover(from, msg.peerId, msg.entityIds, msg.epochs);
        }
        break;
      case 'app':
        this._appMessages$.next({ from, data: msg.data });
        break;
      case 'ping':
        this.transmit(from, 'unreliable', { t: 'pong', t0: msg.t0, t1: this.now, t2: this.now });
        break;
      case 'pong':
        peer.clock.addSample(msg.t0, msg.t1, msg.t2, this.now);
        break;
      case 'heartbeat': {
        const wasAway = peer.away;
        peer.position = msg.pos;
        this.lastPositions.set(from, msg.pos);
        peer.away = !!msg.away;
        if (wasAway !== peer.away) {
          this.publishPeers();
        }
        break;
      }
      case 'chunk':
        // transports reassemble chunks before handing messages over
        break;
    }
  }

  /**
   * loss accounting from the sender's message counter: a gap is that many messages lost, until one of
   * them shows up late after all (the channel is unordered). A long gap is the stream having been off
   * (out of the sender's stream ring, a hidden tab), not loss.
   */
  private countStateMessage(peer: PeerRecord, n: number | undefined): void {
    if (n === undefined) {
      return;
    }
    const last = peer.lastStateN;
    if (last === null || n > last) {
      const gap = last === null ? 0 : n - last - 1;
      if (gap <= MAX_LOSS_GAP) {
        peer.stateMessagesLost += gap;
      }
      peer.lastStateN = n;
      peer.stateMessages++;
    } else if (n < last && last - n <= MAX_LOSS_GAP) {
      peer.stateMessagesLost = Math.max(0, peer.stateMessagesLost - 1);
      peer.stateMessages++;
    }
    // n === last: the other part of a message the transport split
  }

  private acceptStateItem(rec: NetRecord, item: StateItem, from: string): void {
    if (item.owner === this.localPeerId || item.owner !== from) {
      return;
    }
    if (item.epoch < rec.epoch) {
      return;
    }
    if (item.epoch > rec.epoch || item.owner !== rec.owner) {
      if (!this.wins(rec, item.epoch, item.owner, !!item.pp)) {
        return;
      }
      this.setOwner(rec, item.owner, item.epoch);
      this.setPossessor(rec, item.pp ?? null);
    }
    if (item.seq <= rec.lastSeq) {
      return;
    }
    rec.lastSeq = item.seq;
    rec.lastStateAt = this.now;
    rec.snapshotVelocity = velocityOfState(item.s);
    rec.requestedAt = null;
    const snap = rec.latest === null ? false : rec.latest.snap;
    const localTs = this.toLocalTime(from, item.ts);
    const peer = this.peers.get(from);
    if (peer?.clock.ready) {
      peer.stateAgeSumMs += this.now - localTs;
      peer.stateAgeCount++;
      const tuning = rec.entity.networkTuning ? { ...this.tuning, ...rec.entity.networkTuning } : this.tuning;
      const before = rec.latest && extrapolatedPosition(rec.latest.s, this.now - rec.latest.localTs, tuning);
      const after = extrapolatedPosition(item.s, this.now - localTs, tuning);
      if (before && after) {
        const jump = Math.hypot(after.x - before.x, after.y - before.y, (after.z ?? 0) - (before.z ?? 0));
        peer.targetJumpSum += jump;
        peer.targetJumpCount++;
        if (jump > tuning.snapDistance / 4) {
          peer.lunges++;
        }
      }
    }
    rec.latest = {
      s: item.s,
      i: item.i,
      localTs,
      snap,
      inputPending: item.i !== undefined || !!rec.latest?.inputPending,
    };
  }

  private applySpawnItem(rec: NetRecord, item: SpawnItem, from: string, force: boolean): void {
    if (force || this.wins(rec, item.epoch, item.owner, !!item.possessor)) {
      this.setOwner(rec, item.owner, item.epoch);
      this.setPossessor(rec, item.possessor);
    }
    if (item.expiresAt !== undefined) {
      // the lifetime left when the item was sent: both on the sender's clock, so no sync needed
      rec.expiresAt = this.now + (item.expiresAt - item.ts);
    }
    rec.requestedAt = null;
    if (rec.owner === this.localPeerId) {
      return;
    }
    rec.lastStateAt = this.now;
    rec.latest = {
      s: item.full,
      i: undefined,
      localTs: this.toLocalTime(from, item.ts),
      snap: true,
      inputPending: false,
    };
  }

  private onClaim(entityId: string, epoch: number, candidate: string): void {
    const rec = this.records.get(entityId);
    if (!rec) {
      if (candidate === this.localPeerId) {
        // handed something we don't hold (e.g. already unloaded) - let the holders re-arbitrate
        this.broadcast({ t: 'relinquish', ids: [entityId] });
      }
      return;
    }
    if (this.wins(rec, epoch, candidate, false)) {
      this.setOwner(rec, candidate, epoch);
      if (rec.possessor && rec.possessor !== candidate) {
        this.setPossessor(rec, null);
      }
    }
  }

  private async onSpawn(from: string, msg: Extract<WireMessage, { t: 'spawn' }>): Promise<void> {
    if (this.records.has(msg.entityId) || this.spawning.has(msg.entityId)) {
      return;
    }
    // a despawned runtime entity's name may legitimately come back (a player's character after
    // leaving a car) - tombstones only ever stand for removed shared content
    this.tombstones.delete(msg.entityId);
    await this.spawnFromItem(from, {
      entityId: msg.entityId,
      descriptor: msg.descriptor,
      owner: msg.owner,
      epoch: msg.epoch,
      possessor: msg.possessor,
      ts: msg.ts,
      full: msg.full,
      ...(msg.expiresAt !== undefined ? { expiresAt: msg.expiresAt } : {}),
    });
  }

  private async spawnFromItem(from: string, item: SpawnItem): Promise<void> {
    if (!this.world || !item.descriptor || this.records.has(item.entityId) || this.spawning.has(item.entityId)) {
      return; // already built or being built (a join dump and a spawn may both describe it)
    }
    this.spawning.set(item.entityId, []);
    let entity: IEntity | undefined;
    try {
      entity = await this.requireLoader().createEntity(
        { ...item.descriptor, name: item.entityId },
        undefined,
        this.blueprints,
      );
    } catch (e) {
      console.error(`NetworkController: building remote spawn "${item.entityId}" failed`, e);
    }
    const queued = this.spawning.get(item.entityId) ?? [];
    this.spawning.delete(item.entityId);
    if (!entity || !this.world || !this.isNetworkCandidate(entity)) {
      entity?.dispose();
      return;
    }
    if (this.tombstones.has(item.entityId)) {
      entity.dispose();
      return;
    }
    this.networkSpawned.add(entity);
    try {
      this.world.addEntity(entity);
    } catch (e) {
      console.warn(`NetworkController: remote spawn "${item.entityId}" collides with a local entity`, e);
      entity.dispose();
      return;
    }
    const rec = this.createRecord(entity, false);
    this.applySpawnItem(rec, item, from, true);
    if (rec.latest && rec.owner !== this.localPeerId) {
      // apply the full state right away so the entity doesn't render a frame at its descriptor pose
      try {
        rec.entity.applyNetworkState(rec.latest.s, {
          ageMs: Math.max(0, this.now - rec.latest.localTs),
          dt: this.lastDelta,
          snap: true,
          tuning: this.tuning,
        });
      } catch (e) {
        warnOnce(`NetworkController: applyNetworkState of "${rec.id}" threw: ${e}`);
      }
      rec.latest.snap = false;
    }
    const held = this.heldState.get(item.entityId);
    if (held) {
      this.heldState.delete(item.entityId);
      this.acceptStateItem(rec, held.item, held.from);
    }
    for (const q of queued) {
      this.onMessage(q.from, q.msg);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // join, away, takeover
  // ---------------------------------------------------------------------------------------------

  private buildJoinDump(): WireMessage {
    const entities: SpawnItem[] = [];
    if (this.joined) {
      for (const rec of this.records.values()) {
        if (rec.owner === this.localPeerId) {
          entities.push(this.toSpawnItem(rec, true));
        }
      }
    }
    const dump: WireMessage = {
      t: 'joinDump',
      sharedLevels: [...this.sharedSources],
      entities,
      despawned: [...this.tombstones],
      since: this.joined ? this.now - this.joinedAt : 0,
    };
    if (this.joined && this.joinState) {
      dump.app = this.joinState();
    }
    return dump;
  }

  /**
   * Ask `peerIds` for their join dumps and apply them: `'join'` - a first join; `'rejoin'` - a
   * `connect()` after `leave()`, holding entities of the earlier session; `'resync'` - back from away.
   */
  private async requestDumps(peerIds: string[], mode: 'join' | 'rejoin' | 'resync'): Promise<void> {
    if (!this.world) {
      return;
    }
    if (mode !== 'resync' && !this.world.isPaused && this.world.isRunning) {
      this.world.pauseWorld();
      this.pausedForJoin = true;
    }
    const generation = this.sessionGeneration;
    let join: PendingJoin | null = null;
    await new Promise<void>(resolve => {
      let timeout: unknown = null;
      join = {
        waitingFor: new Set(peerIds),
        dumps: [],
        resolve: () => {
          if (timeout !== null) {
            this.scheduler.clearTimeout(timeout);
          }
          resolve();
        },
      };
      this.pendingJoin = join;
      timeout = this.scheduler.setTimeout(() => resolve(), this.opts.joinTimeoutMs);
      for (const id of peerIds) {
        this.transmit(id, 'reliable', { t: 'joinRequest' });
      }
    });
    if (this.pendingJoin === join) {
      this.pendingJoin = null;
    }
    if (generation !== this.sessionGeneration) {
      return; // left meanwhile - the teardown already resumed the world
    }
    try {
      await this.applyDumps(join!.dumps, mode);
    } finally {
      if (this.pausedForJoin) {
        this.pausedForJoin = false;
        this.world?.resumeWorld();
      }
    }
  }

  private async applyDumps(
    dumps: Extract<WireMessage, { t: 'joinDump' }>[],
    mode: 'join' | 'rejoin' | 'resync',
  ): Promise<void> {
    const resync = mode === 'resync';
    // what this peer still holds from an earlier session takes the room's word for its ownership
    const force = mode !== 'join';
    const levels = new Set<string>();
    for (const dump of dumps) {
      dump.sharedLevels.forEach(l => levels.add(l));
      dump.despawned.forEach(id => this.tombstones.add(id));
    }
    this._roomSharedLevels = [...levels];
    if (!resync && this._roomSharedLevels.length > 0) {
      const mismatched = [...this.sharedSources].filter(s => !levels.has(s));
      if (mismatched.length > 0) {
        throw new Error(
          `Shared level(s) ${mismatched.join(', ')} don't match the room's levels (${this._roomSharedLevels.join(', ')})`,
        );
      }
    }
    for (const id of this.tombstones) {
      const rec = this.records.get(id);
      if (rec && rec.shared) {
        this.unregister(rec);
        this.removeLocally(rec.entity);
      } else if (!rec) {
        const local = this.findEntity(id);
        if (local && this.isShared(local) && !this.pendingAdded.has(local)) {
          this.removeLocally(local);
        }
      }
    }
    const spawns: Promise<void>[] = [];
    const covered = new Set<string>();
    for (const dump of dumps) {
      const from = this.dumpSender(dump);
      for (const item of dump.entities) {
        covered.add(item.entityId);
        const rec = this.records.get(item.entityId);
        if (rec) {
          this.applySpawnItem(rec, item, from, force);
        } else if (item.descriptor) {
          spawns.push(this.spawnFromItem(from, item));
        } else {
          this.heldSpawnItems.set(item.entityId, { item, from, at: this.now });
        }
      }
    }
    await Promise.all(spawns);
    if (mode === 'rejoin') {
      // everything here is ours since leaving; what nobody vouched for the room no longer has: a remote
      // spawn was despawned meanwhile, a runtime spawn of our own was lost with our departure
      for (const rec of [...this.records.values()]) {
        if (covered.has(rec.id) || rec.owner !== this.localPeerId || rec.shared) {
          continue;
        }
        if (this.networkSpawned.has(rec.entity)) {
          this.unregister(rec);
          this.removeLocally(rec.entity);
        } else {
          this.broadcastSpawn(rec);
        }
      }
    }
    if (resync) {
      // whatever we still believe we own but nobody vouched for stays ours; everything else
      // remote that wasn't in any dump has no live owner - let arbitration pick it up
      for (const rec of this.records.values()) {
        if (!covered.has(rec.id) && rec.owner !== this.localPeerId && !rec.possessor) {
          rec.lastStateAt = -Infinity;
        }
      }
    }
    let senior: { since: number; app: unknown } | null = null;
    for (const dump of dumps) {
      if (dump.app !== undefined && (!senior || dump.since > senior.since)) {
        senior = { since: dump.since, app: dump.app };
      }
    }
    if (senior) {
      this._joinState$.next(senior.app);
    }
  }

  private dumpSender(dump: object): string {
    return this.dumpSenders.get(dump) ?? '';
  }

  private onVisibility(visible: boolean): void {
    if (!this.opts.takeoverOnHidden) {
      return;
    }
    if (!visible && this.sessionState === 'joined') {
      this.goAway();
    } else if (visible && this.sessionState === 'away') {
      void this.returnFromAway();
    }
  }

  /** Hand everything over (hidden tab): peers elect a taker; this peer stops broadcasting until it resyncs. */
  goAway(): void {
    if (this.sessionState !== 'joined') {
      return;
    }
    this.possessedBeforeAway = [...this.records.values()]
      .filter(r => r.possessor === this.localPeerId)
      .map(r => r.entity);
    const owned = [...this.records.values()].filter(r => r.owner === this.localPeerId);
    this._sessionState$.next('away');
    this.transmit('all', 'reliable', {
      t: 'takeover',
      peerId: this.localPeerId,
      entityIds: owned.map(r => r.id),
      epochs: owned.map(r => r.epoch),
    });
    this.transmit('all', 'reliable', this.heartbeatMessage());
  }

  /** Come back from away: resync like a late joiner, then re-possess (if `repossessOnReturn`). */
  async returnFromAway(): Promise<void> {
    if (this.sessionState !== 'away') {
      return;
    }
    const generation = this.sessionGeneration;
    const others = [...this.transport.peers];
    if (others.length > 0) {
      await this.requestDumps(others, 'resync');
    }
    if (generation !== this.sessionGeneration || this.sessionState !== 'away') {
      return;
    }
    this._sessionState$.next('joined');
    this.transmit('all', 'reliable', this.heartbeatMessage());
    if (this.opts.repossessOnReturn) {
      for (const entity of this.possessedBeforeAway) {
        if (entity.world) {
          const rec = this.recordsByEntity.get(entity);
          if (rec && rec.possessor === this.localPeerId && rec.owner !== this.localPeerId) {
            rec.possessor = null;
          }
          this.possess(entity);
        }
      }
    }
    this.possessedBeforeAway = [];
    this.possessDesired();
    this._resynced$.next();
  }

  private onPeerGone(peerId: string): void {
    if (this.departed.has(peerId)) {
      return;
    }
    this.departed.add(peerId);
    this.electTakeover(peerId);
    this.peers.delete(peerId);
    this.publishPeers();
  }

  /**
   * Pick the peer nearest to `goneId`'s last position (ties and unknown positions: lexically
   * smallest id) among the peers still present; if that's the local peer, take over everything
   * `goneId` owned or possessed in one `takeover` message. Without `takeoverPossessed`, what `goneId`
   * possesses stays its own and only gets neutral input.
   */
  private electTakeover(goneId: string): void {
    if (this.sessionState !== 'joined') {
      return;
    }
    let held = [...this.records.values()].filter(r => r.owner === goneId || r.possessor === goneId);
    if (!this.opts.takeoverPossessed) {
      for (const rec of held) {
        if (rec.possessor === goneId && rec.inputDriven) {
          // nobody drives it until its peer is back: its next state packet brings the input again
          (rec.entity as any).applyRemoteInput(null);
        }
      }
      held = held.filter(r => r.possessor !== goneId);
    }
    if (held.length === 0) {
      return;
    }
    const gonePos = this.peers.get(goneId)?.position ?? this.lastPositions.get(goneId) ?? null;
    const candidates: { id: string; d: number }[] = [
      { id: this.localPeerId, d: this.distanceOrInf(gonePos, this.localPosition()) },
    ];
    for (const peer of this.peers.values()) {
      if (peer.id !== goneId && !peer.away) {
        candidates.push({ id: peer.id, d: this.distanceOrInf(gonePos, peer.position ?? null) });
      }
    }
    candidates.sort((a, b) => (a.d !== b.d ? a.d - b.d : a.id < b.id ? -1 : 1));
    if (candidates[0].id !== this.localPeerId) {
      return;
    }
    const ids: string[] = [];
    const epochs: number[] = [];
    for (const rec of held) {
      const epoch = rec.epoch + 1;
      this.setOwner(rec, this.localPeerId, epoch);
      if (rec.possessor === goneId) {
        this.setPossessor(rec, null);
      }
      ids.push(rec.id);
      epochs.push(epoch);
    }
    this.broadcast({ t: 'takeover', peerId: goneId, entityIds: ids, epochs });
  }

  private distanceOrInf(a: unknown, b: unknown): number {
    return a && b ? distanceSq(a, b) : Infinity;
  }

  private onTakeover(taker: string, goneId: string, ids: string[], epochs: number[]): void {
    ids.forEach((id, i) => {
      const rec = this.records.get(id);
      if (!rec) {
        return;
      }
      if (this.wins(rec, epochs[i], taker, false)) {
        this.setOwner(rec, taker, epochs[i]);
        if (rec.possessor === goneId) {
          this.setPossessor(rec, null);
        }
      }
    });
  }

  // ---------------------------------------------------------------------------------------------
  // session hooks & dev tools
  // ---------------------------------------------------------------------------------------------

  private installSessionHooks(): void {
    const world = this.world;
    if (!world || this.previousEventAuthority) {
      return;
    }
    this.previousEventAuthority = world.eventAuthority;
    this.previousCommandGuard = world.commandGuard;
    world.eventAuthority = (entity, eventName, payload) => this.hasAuthority(entity, eventName, payload);
    world.commandGuard = () => SESSION_HOOK_REJECTION;
  }

  private uninstallSessionHooks(): void {
    const world = this.world;
    if (!world || !this.previousEventAuthority) {
      return;
    }
    world.eventAuthority = this.previousEventAuthority;
    world.commandGuard = this.previousCommandGuard ?? null;
    this.previousEventAuthority = null;
    this.previousCommandGuard = undefined;
  }

  private registerConsoleCommands(world: GgWorld<any, any>): void {
    const ggstatic = (globalThis as any).ggstatic;
    if (!ggstatic?.registerConsoleCommand) {
      return;
    }
    const register = (name: string, handler: (...args: string[]) => Promise<string>, doc: string) => {
      ggstatic.registerConsoleCommand(world, name, handler, doc);
      this.registeredCommands.push(name);
    };
    register(
      'net_status',
      async () => {
        const lines = [
          `session: ${this.sessionState}, local peer: ${this.localPeerId}`,
          `send rate: ${this.sendRate}, keepalive: ${this.keepaliveRate} Hz, entities: ${this.records.size} ` +
            `(${[...this.records.values()].filter(r => r.owner === this.localPeerId).length} owned)`,
        ];
        for (const p of this.peerInfos) {
          lines.push(
            `  ${p.peerId}: rtt ${p.rttMs.toFixed(1)} ms, offset ${p.offsetMs.toFixed(1)} ms` +
              `${p.away ? ', away' : ''}, position ${JSON.stringify(p.position ?? null)}`,
          );
        }
        if (this.conditioner.active) {
          lines.push(`simulated lag: ${this.conditioner.describe()}`);
        }
        return lines.join('\n');
      },
      'no args; Print the multiplayer session state, peers (RTT, clock offset, position) and send rate',
    );
    register(
      'net_panel',
      async (...args: string[]) => {
        this.showNetPanel = args[0] === undefined ? !this.showNetPanel : args[0] === '1';
        return this.showNetPanel ? '1' : '0';
      },
      'args: [ 0|1? ]; Turn on/off the live network stats panel (traffic, per-peer RTT, clock offset, snapshot ' +
        'age), skip argument to toggle value',
    );
    register(
      'net_owners',
      async (...args: string[]) => {
        const f = args[0]?.toLowerCase();
        const rows = [...this.records.values()]
          .filter(r => !f || r.id.toLowerCase().includes(f))
          .map(
            r =>
              `${r.id}\towner ${r.owner || '(none)'} epoch ${r.epoch}` +
              `${r.possessor ? ` possessed by ${r.possessor}` : ''}${r.shared ? ' [shared]' : ''}`,
          );
        return rows.length ? rows.join('\n') : '(no networked entities)';
      },
      'args: [ string? ]; List networked entities with owner, epoch and possessor, optionally filtered by name',
    );
    register(
      'net_tuning',
      async (...args: string[]) => {
        const [key, value] = args;
        if (key) {
          if (!(key in this.tuning) || value === undefined || isNaN(+value)) {
            throw new Error(`usage: net_tuning KEY VALUE; keys: ${Object.keys(this.tuning).join(', ')}`);
          }
          (this.tuning as any)[key] = +value;
        }
        return JSON.stringify(this.tuning);
      },
      'args: [ string?, float? ]; Print the replica correction tuning, or set one key',
    );
    register(
      'net_lag',
      async (...args: string[]) => {
        if (args.length > 0) {
          if (args.length > 7 || args.some(a => isNaN(+a))) {
            throw new Error(
              'usage: net_lag MS [LOSS_PERCENT [JITTER_MS [STALL_MS STALL_EVERY_MS [RELIABLE_DELAY_MS RELIABLE_DELAY_PERCENT]]]]',
            );
          }
          const [ms, loss, jitter, stall, stallEvery, reliableDelay, reliableRate] = args.map(a => Math.max(0, +a));
          const c = this.conditioner;
          c.reset();
          c.latencyMs = ms;
          c.lossRate = Math.min(1, (loss ?? 0) / 100);
          c.jitterMs = jitter ?? 0;
          c.stallMs = stall ?? 0;
          c.stallIntervalMs = stallEvery ?? 0;
          c.reliableDelayMs = reliableDelay ?? 0;
          c.reliableDelayRate = Math.min(1, (reliableRate ?? 0) / 100);
        }
        return this.conditioner.describe();
      },
      'args: [ float?, float?, float?, float?, float?, float?, float? ]; Simulate a bad incoming link on this peer: ' +
        'latency (ms), unreliable-message loss (percent), jitter (+- ms), delivery stalls (ms, every ms), ' +
        'delayed reliable messages (extra ms, percent of them). Omitted values are 0',
    );
  }

  private deregisterConsoleCommands(world: GgWorld<any, any>): void {
    const ggstatic = (globalThis as any).ggstatic;
    for (const name of this.registeredCommands) {
      ggstatic?.deregisterConsoleCommand?.(world, name);
    }
    this.registeredCommands.length = 0;
  }
}
