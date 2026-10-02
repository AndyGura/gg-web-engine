import {
  BlueprintNode,
  BlueprintPinDefinition,
  Entity2d,
  Entity3d,
  Gg2dLevelLoader,
  Gg2dWorld,
  Gg3dLevelLoader,
  Gg3dWorld,
  GgWorld,
  LevelLoader,
} from '@gg-web-engine/core';
import { Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';
import { MatterWorldComponent } from '@gg-web-engine/matter';
import { Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';
import {
  LoopbackConditions,
  LoopbackHub,
  Network2dController,
  Network3dController,
  NetworkController,
  NetworkControllerOptions,
  VirtualScheduler,
} from '../../src';

export const TICK_MS = 16;

/** One physics adapter the harness runs against. Units are meters on every adapter. */
export interface AdapterSpec {
  name: string;
  dim: 2 | 3;
  /** world units per meter: 2D adapters work in pixels (100/m), 3D in meters */
  unit: number;
  createWorld(): Promise<GgWorld<any, any>>;
  createLoader(world: GgWorld<any, any>): LevelLoader<any, any, any>;
  /** a point `h` meters above the ground plane origin, offset `x` meters along the ground */
  at(x: number, h: number): any;
  /** "up" scaled by `v` */
  up(v: number): any;
  /** a vector along the ground */
  along(v: number): any;
  addBox(world: GgWorld<any, any>, position: any, size?: number, mass?: number): Entity2d | Entity3d;
  addGround(world: GgWorld<any, any>): void;
}

const boxShape2d = (size: number) => ({ shape: 'BOX' as const, dimensions: { x: size, y: size } });
const boxShape3d = (size: number) => ({ shape: 'BOX' as const, dimensions: { x: size, y: size, z: size } });

const PX = 100;

const spec2d = (name: string, create: () => any): AdapterSpec => ({
  name,
  dim: 2,
  unit: PX,
  async createWorld() {
    const physicsWorld = create();
    const world = new Gg2dWorld({ physicsWorld, fixedPhysicsStep: TICK_MS });
    await world.init();
    physicsWorld.gravity = { x: 0, y: 9.82 };
    world.start();
    world.pauseWorld();
    return world;
  },
  createLoader: world => new Gg2dLevelLoader(world as Gg2dWorld),
  // 2D is screen space: +y is down, the ground sits at y = 0
  at: (x, h) => ({ x: x * PX, y: -h * PX }),
  up: v => ({ x: 0, y: -v * PX }),
  along: v => ({ x: v * PX, y: 0 }),
  addBox(world, position, size = 1, mass = 1) {
    return (world as Gg2dWorld).addPrimitiveRigidBody(
      { shape: boxShape2d(size * PX), body: { bodyType: 'dynamic', mass } as any },
      position,
    );
  },
  addGround(world) {
    const ground = (world as Gg2dWorld).addPrimitiveRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 200 * PX, y: 2 * PX } }, body: { bodyType: 'static', mass: 0 } as any },
      { x: 0, y: PX },
    );
    ground.name = 'ground';
  },
});

const spec3d = (name: string, create: () => any): AdapterSpec => ({
  name,
  dim: 3,
  unit: 1,
  async createWorld() {
    const physicsWorld = create();
    const world = new Gg3dWorld({ physicsWorld, fixedPhysicsStep: TICK_MS });
    await world.init();
    physicsWorld.gravity = { x: 0, y: 0, z: -9.82 };
    world.start();
    world.pauseWorld();
    return world;
  },
  createLoader: world => new Gg3dLevelLoader(world as Gg3dWorld),
  at: (x, h) => ({ x, y: 0, z: h }),
  up: v => ({ x: 0, y: 0, z: v }),
  along: v => ({ x: v, y: 0, z: 0 }),
  addBox(world, position, size = 1, mass = 1) {
    return (world as Gg3dWorld).addPrimitiveRigidBody(
      { shape: boxShape3d(size), body: { bodyType: 'dynamic', mass } as any },
      position,
    );
  },
  addGround(world) {
    const ground = (world as Gg3dWorld).addPrimitiveRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 200, y: 200, z: 2 } }, body: { bodyType: 'static', mass: 0 } as any },
      { x: 0, y: 0, z: -1 },
    );
    ground.name = 'ground';
  },
});

export const ADAPTERS: AdapterSpec[] = [
  spec2d('rapier2d', () => new Rapier2dWorldComponent()),
  spec2d('matter', () => new MatterWorldComponent()),
  spec3d('rapier3d', () => new Rapier3dWorldComponent()),
  spec3d('ammo', () => new AmmoWorldComponent()),
];

/** A blueprint node that just counts how often it ran, per peer. */
export class CountNode extends BlueprintNode {
  public static counts = new Map<string, number>();
  public readonly inputs: readonly BlueprintPinDefinition[] = [{ name: 'in', kind: 'exec' }];
  public readonly outputs: readonly BlueprintPinDefinition[] = [];

  trigger(): void {
    const peer = this.settings.peer as string;
    CountNode.counts.set(peer, (CountNode.counts.get(peer) ?? 0) + 1);
  }
}

export interface Peer {
  id: string;
  world: GgWorld<any, any>;
  net: NetworkController;
  loader: LevelLoader<any, any, any>;
  /** settable position the controller's `localPosition` reports */
  position: any | null;
}

const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Several `GgWorld`s in one process, joined by a `LoopbackHub` on one `VirtualScheduler`: `step()`
 * advances network time and every world clock in lockstep.
 */
export class Harness {
  readonly scheduler = new VirtualScheduler(1000);
  readonly hub: LoopbackHub;
  readonly peers: Peer[] = [];

  constructor(
    readonly adapter: AdapterSpec,
    conditions: Partial<LoopbackConditions> = {},
    private readonly controllerOptions: Partial<NetworkControllerOptions<any>> = {},
    random: () => number = mulberry32(42),
  ) {
    this.hub = new LoopbackHub(this.scheduler, conditions, random);
  }

  /**
   * Build a world, run `setup` on it (e.g. load shared content), add a controller and connect it -
   * stepping every existing peer while the join handshake is in flight.
   */
  async addPeer(
    id: string,
    setup?: (peer: Peer) => void | Promise<void>,
    options: Partial<NetworkControllerOptions<any>> = {},
  ): Promise<Peer> {
    const world = await this.adapter.createWorld();
    this.adapter.addGround(world);
    const loader = this.adapter.createLoader(world);
    loader.registerBlueprintNode('Count', (w, settings) => new CountNode(w, { ...settings, peer: id }), 'in');
    const transport = this.hub.createTransport(id);
    // one process hosts every peer here, so the per-process peer-id name prefix would stack up;
    // auto-generated names are already process-unique
    const opts = {
      transport,
      scheduler: this.scheduler,
      levelLoader: loader,
      prefixEntityNames: false,
      ...this.controllerOptions,
      ...options,
    };
    const net = this.adapter.dim === 2 ? new Network2dController(opts) : new Network3dController(opts);
    const peer: Peer = { id, world, net, loader, position: this.adapter.at(0, 0) };
    net.localPosition = () => peer.position;
    world.addEntity(net);
    await setup?.(peer);
    this.peers.push(peer);
    let done = false;
    let error: unknown = null;
    net.connect().then(
      () => (done = true),
      e => {
        error = e;
        done = true;
      },
    );
    for (let i = 0; i < 2000 && !done; i++) {
      await flushMicrotasks();
      if (!done) {
        this.step(1);
      }
    }
    if (error) {
      throw error;
    }
    if (!done) {
      throw new Error(`peer ${id} never finished joining`);
    }
    return peer;
  }

  /** Advance `ticks` world ticks of `TICK_MS` on every peer, with network time in lockstep. */
  step(ticks: number = 1): void {
    for (let i = 0; i < ticks; i++) {
      this.scheduler.advance(TICK_MS);
      for (const peer of this.peers) {
        if (peer.world.isPaused) {
          peer.world.worldClock.step(TICK_MS);
        }
      }
    }
  }

  /** Step while awaiting pending promises (async spawns), `ticks` times. */
  async run(ticks: number): Promise<void> {
    for (let i = 0; i < ticks; i++) {
      this.step(1);
      if (i % 5 === 0) {
        await flushMicrotasks();
      }
    }
    await flushMicrotasks();
  }

  peer(id: string): Peer {
    return this.peers.find(p => p.id === id)!;
  }

  dispose(): void {
    for (const peer of this.peers) {
      peer.world.dispose();
    }
    this.peers.length = 0;
  }
}

/** small deterministic PRNG, so lossy/jittery runs are reproducible */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dist(a: any, b: any): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z ?? 0) - (b.z ?? 0)) ** 2);
}
