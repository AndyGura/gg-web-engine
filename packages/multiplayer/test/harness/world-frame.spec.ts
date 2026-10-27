import {
  Frame3d,
  Gg3dWorld,
  GgCarEntity,
  IEntity,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  RVEntityTractionBias,
} from '@gg-web-engine/core';
import { DEFAULT_ZONING, WireMessage, ZoneTracker } from '../../src';
import { ADAPTERS, dist, Harness, Peer } from './harness';

jest.setTimeout(60_000);

/**
 * Two sections of one open world: each peer's world simulates near its own origin, placed ~100 km
 * from the global origin by its `frame`, the two turned against each other. Everything on the wire
 * is global, so both peers must agree on every entity's global pose.
 */
const FRAME_A = new Frame3d({ x: 99_980, y: -39_995, z: 0 }, 0.7);
const FRAME_B = new Frame3d({ x: 100_030, y: -40_010, z: 0.5 }, -2.5);
/** far enough from FRAME_A that comparing raw local coordinates of the two worlds gives other answers */
const FRAME_FAR = new Frame3d({ x: 100_400, y: -40_300, z: 0 }, Math.PI);
const GLOBAL_GROUND: Point3 = { x: 100_000, y: -40_000, z: -1 };
const at = (dx: number, dy: number, z: number): Point3 => ({ x: GLOBAL_GROUND.x + dx, y: GLOBAL_GROUND.y + dy, z });

const findByName = (h: Harness, peerId: string, name: string): any =>
  h.peer(peerId).world.children.find((e: IEntity) => e.name === name);

const world3d = (peer: Peer) => peer.world as Gg3dWorld;

/** set the peer world's frame, and put its ground under the shared global ground */
const placeInFrame = (frame: Frame3d) => (peer: Peer) => {
  const world = world3d(peer);
  world.frame = frame;
  world.removeEntity(world.getEntityByName('ground'), true);
  const ground = world.addPrimitiveRigidBody(
    { shape: { shape: 'BOX', dimensions: { x: 400, y: 400, z: 2 } }, body: { bodyType: 'static', mass: 0 } as any },
    world.toLocalPoint(GLOBAL_GROUND),
    world.toLocalRotation(Qtrn.O),
  );
  ground.name = 'ground';
  // the player stands at the global ground's center
  peer.position = world.toLocalPoint(at(0, 0, 0));
};

const globalPosition = (peer: Peer, entity: { position: Point3 }) => world3d(peer).toGlobalPoint(entity.position);
const globalRotation = (peer: Peer, entity: { rotation: Point4 }) => world3d(peer).toGlobalRotation(entity.rotation);
const angle = (qa: Point4, qb: Point4) => {
  const a = Qtrn.normalize(qa);
  const b = Qtrn.normalize(qb);
  return 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));
};

const carConfig = {
  suspension: { stiffness: 20, damping: 2.3, compression: 4.4, restLength: 0.53 },
  tractionBias: RVEntityTractionBias.RWD,
  engine: {
    minRpm: 700,
    maxRpm: 7000,
    torques: [
      { rpm: 1000, torque: 270 },
      { rpm: 7000, torque: 430 },
    ],
    maxRpmIncreasePerSecond: 8000,
    maxRpmDecreasePerSecond: 8000,
  },
  brake: { frontAxleForce: 350, rearAxleForce: 300, handbrakeForce: 1500 },
  transmission: {
    isAuto: false,
    drivelineEfficiency: 0.85,
    finalDriveRatio: 3.21,
    reverseGearRatio: -2.33,
    gearRatios: [2.92, 1.87, 1.42, 1.09, 0.81],
    upShifts: [7140, 7140, 7140, 7140, 7140],
    autoHold: false,
  },
  maxSteerAngle: 0.35,
  chassis: { dimensions: { x: 1.8, y: 4, z: 0.6 } },
  wheelBase: {
    shared: { frictionSlip: 1000, rollInfluence: 0.2 },
    front: { halfAxleWidth: 0.9, axlePosition: 1.4, axleHeight: 0, tyreRadius: 0.35, tyreWidth: 0.2 },
    rear: { halfAxleWidth: 0.9, axlePosition: -1.3, axleHeight: 0, tyreRadius: 0.35, tyreWidth: 0.2 },
  },
};

describe.each(ADAPTERS.filter(a => a.dim === 3))('world frames over the network ($name)', adapter => {
  let h: Harness;

  afterEach(() => h?.dispose());

  const twoPeers = async (frameB: Frame3d = FRAME_B) => {
    h = new Harness(adapter);
    const a = await h.addPeer('a', placeInFrame(FRAME_A));
    const b = await h.addPeer('b', placeInFrame(frameB));
    return { a, b };
  };

  it('a dynamic body replicated between differently placed worlds lands at the same global pose', async () => {
    const { a, b } = await twoPeers();
    const received: WireMessage[] = [];
    const sub = b.net.transport.messages$.subscribe(({ msg }) => received.push(msg));
    const box = world3d(a).addPrimitiveRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } as any },
      world3d(a).toLocalPoint(at(2, 1, 3)),
      world3d(a).toLocalRotation(Qtrn.fromAngle(Pnt3.Z, 0.3)),
    );
    box.objectBody!.linearVelocity = world3d(a).toLocalDirection({ x: 1.5, y: 0, z: 0 });
    await h.run(5);
    const replica = findByName(h, 'b', box.name);
    expect(replica).toBeDefined();
    // on the wire: the spawn descriptor, its full state, the state stream and heartbeats are global,
    // and quantised
    const spawn = received.find(m => m.t === 'spawn') as Extract<WireMessage, { t: 'spawn' }>;
    expect(dist(spawn.descriptor.position, at(2, 1, 3))).toBeLessThan(0.001);
    expect(angle(spawn.descriptor.rotation, Qtrn.fromAngle(Pnt3.Z, 0.3))).toBeLessThan(1e-4);
    expect(dist((spawn.full as any).p, at(2, 1, 3))).toBeLessThan(0.01);
    const decimals = (v: number) => (String(v).split('.')[1] ?? '').length;
    const states = received.filter(m => m.t === 'state').flatMap(m => (m as any).items.map((i: any) => i.s));
    expect(states.length).toBeGreaterThan(0);
    for (const st of states) {
      expect(dist(st.p, globalPosition(a, box))).toBeLessThan(1);
      for (const c of ['x', 'y', 'z']) {
        expect(decimals(st.p[c])).toBeLessThanOrEqual(3);
        expect(decimals(st.lv[c])).toBeLessThanOrEqual(3);
      }
      for (const c of ['x', 'y', 'z', 'w']) {
        expect(decimals(st.r[c])).toBeLessThanOrEqual(5);
      }
    }
    // so the replica appears where the owner's box is, globally
    expect(dist(world3d(b).toGlobalPoint(replica.objectBody.position), globalPosition(a, box))).toBeLessThan(0.3);
    await h.run(1); // the first tick binds the replica entity to its body
    expect(dist(globalPosition(b, replica), globalPosition(a, box))).toBeLessThan(0.2);
    // locally, the two worlds disagree by meters
    expect(dist(replica.position, box.position)).toBeGreaterThan(5);

    await h.run(300); // ~5 s: falls, slides, comes to rest
    expect(dist(globalPosition(a, box), at(2, 1, 0))).toBeGreaterThan(0.5); // it did move
    expect(dist(globalPosition(b, replica), globalPosition(a, box))).toBeLessThan(0.1);
    expect(angle(globalRotation(b, replica), globalRotation(a, box))).toBeLessThan(0.05);
    // `a`'s player stands at the global ground center
    const heartbeat = received.find(m => m.t === 'heartbeat') as Extract<WireMessage, { t: 'heartbeat' }>;
    expect(dist(heartbeat.pos, at(0, 0, 0))).toBeLessThan(0.001);
    sub.unsubscribe();
  });

  it('a possessed car is driven at the same global pose on both peers', async () => {
    const { a, b } = await twoPeers();
    const yaw = Qtrn.fromAngle(Pnt3.Z, 1.2);
    const car = (await a.loader.createEntity({
      class: 'GgCar',
      position: world3d(a).toLocalPoint(at(-5, 3, 1.2)),
      rotation: world3d(a).toLocalRotation(yaw),
      config: carConfig,
    } as any)) as GgCarEntity;
    a.world.addEntity(car);
    await h.run(5);
    expect(a.net.possess(car)).toBe(true);
    await h.run(60); // settles on its suspension
    const replica = findByName(h, 'b', car.name) as GgCarEntity;
    expect(replica).toBeInstanceOf(GgCarEntity);
    expect(b.net.possessorOf(replica)).toBe('a');
    const start = globalPosition(a, car);

    car.gear = 1;
    car.acceleration = 1;
    await h.run(120); // ~2 s of throttle
    car.acceleration = 0;
    car.brake = 1;
    await h.run(180); // brakes to a stop, the replica catches up
    expect(dist(globalPosition(a, car), start)).toBeGreaterThan(2);
    // the same as this scenario reaches between two worlds with identity frames (~0.18 m)
    expect(dist(globalPosition(b, replica), globalPosition(a, car))).toBeLessThan(0.25);
    expect(angle(globalRotation(b, replica), globalRotation(a, car))).toBeLessThan(0.05);
  });

  it('distance arbitration compares global positions', async () => {
    const { a, b } = await twoPeers(FRAME_FAR);
    const box = world3d(a).addPrimitiveRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } as any },
      world3d(a).toLocalPoint(at(0, 0, 0.5)),
    );
    a.position = world3d(a).toLocalPoint(at(60, 0, 0));
    b.position = world3d(b).toLocalPoint(at(2, 0, 0));
    await h.run(150);
    const replica = findByName(h, 'b', box.name);
    expect(a.net.ownerOf(box)).toBe('b');
    expect(b.net.ownerOf(replica)).toBe('b');
  });

  it('zoning places a peer by its global position', async () => {
    h = new Harness(adapter);
    const cells = new Map<string, string>();
    const track = (frame: Frame3d) => (peer: Peer) => {
      placeInFrame(frame)(peer);
      const tracker = new ZoneTracker(DEFAULT_ZONING);
      peer.net.transport.updateLocalPosition = p => void cells.set(peer.id, tracker.update(p as any));
    };
    const a = await h.addPeer('a', track(FRAME_A));
    const b = await h.addPeer('b', track(FRAME_B));
    a.position = world3d(a).toLocalPoint(at(250, 120, 0));
    b.position = world3d(b).toLocalPoint(at(-130, -260, 0));
    await h.run(150); // a few heartbeats
    const size = DEFAULT_ZONING.cellSize;
    const cellOf = (p: Point3) => `${Math.floor(p.x / size)}:${Math.floor(p.y / size)}`;
    expect(cells.get('a')).toBe(cellOf(at(250, 120, 0)));
    expect(cells.get('b')).toBe(cellOf(at(-130, -260, 0)));
  });

  it('a buffered snapshot is converted with the frame current when it is applied', async () => {
    const { a, b } = await twoPeers();
    const box = world3d(a).addPrimitiveRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } as any },
      world3d(a).toLocalPoint(at(1, 1, 0.5)),
    );
    // the replica's peer stays nearest, so `a` keeps the box and keeps broadcasting it
    b.position = world3d(b).toLocalPoint(at(80, 0, 0));
    await h.run(240);
    const replica = findByName(h, 'b', box.name);
    expect(dist(globalPosition(b, replica), globalPosition(a, box))).toBeLessThan(0.1);
    expect(b.net.ownerOf(replica)).toBe('a');

    // nothing new arrives; `b`'s world is moved to another frame, its content kept at its global pose
    h.hub.partition('a');
    const world = world3d(b);
    const newFrame = new Frame3d({ x: 99_900, y: -40_100, z: 0 }, 1.9);
    const delta = newFrame.inverse().compose(world.frame);
    for (const entity of world.children as any[]) {
      if (entity.objectBody) {
        entity.position = delta.toGlobalPoint(entity.position);
        entity.rotation = delta.toGlobalRotation(entity.rotation);
      }
    }
    world.frame = newFrame;
    const before = globalPosition(b, replica);
    await h.run(20); // corrections run on the snapshot received before the frame change
    expect(dist(globalPosition(b, replica), before)).toBeLessThan(0.05);
    expect(dist(globalPosition(b, replica), globalPosition(a, box))).toBeLessThan(0.1);
    h.hub.heal('a');
  });
});
