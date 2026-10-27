import { Frame3d, Gg3dWorld, GgCarEntity, IEntity, Point3, Qtrn, RVEntityTractionBias } from '@gg-web-engine/core';
import { ADAPTERS, dist, Harness, Peer, TICK_MS } from './harness';

jest.setTimeout(60_000);

/**
 * `Gg3dWorld.switchFrame` on one peer while a car is driven and replicated: the switching peer's
 * content keeps its global pose, and the other peer - which only ever sees global coordinates -
 * sees no jump.
 */
const FRAME_A = new Frame3d({ x: 99_980, y: -39_995, z: 0 }, 0.7);
const FRAME_B = new Frame3d({ x: 100_030, y: -40_010, z: 0.5 }, -2.5);
/** what either peer switches to mid-drive: another section's origin, turned */
const FRAME_SWITCHED = new Frame3d({ x: 100_012, y: -39_985, z: -1.5 }, 2.1);
const GLOBAL_GROUND: Point3 = { x: 100_000, y: -40_000, z: -1 };
const at = (dx: number, dy: number, z: number): Point3 => ({ x: GLOBAL_GROUND.x + dx, y: GLOBAL_GROUND.y + dy, z });

const world3d = (peer: Peer) => peer.world as Gg3dWorld;

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
  peer.position = world.toLocalPoint(at(0, 0, 0));
};

const globalPosition = (peer: Peer, entity: { position: Point3 }) => world3d(peer).toGlobalPoint(entity.position);

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

describe.each(ADAPTERS.filter(a => a.dim === 3))('a frame switch on one peer ($name)', adapter => {
  let h: Harness;

  afterEach(() => h?.dispose());

  /** `a` owns and drives a car at full throttle, `b` holds its replica */
  const drivingCar = async () => {
    h = new Harness(adapter);
    const a = await h.addPeer('a', placeInFrame(FRAME_A));
    const b = await h.addPeer('b', placeInFrame(FRAME_B));
    const car = (await a.loader.createEntity({
      class: 'GgCar',
      position: world3d(a).toLocalPoint(at(-5, 3, 1.2)),
      rotation: world3d(a).toLocalRotation(Qtrn.fromAngle({ x: 0, y: 0, z: 1 }, 1.2)),
      config: carConfig,
    } as any)) as GgCarEntity;
    a.world.addEntity(car);
    await h.run(5);
    expect(a.net.possess(car)).toBe(true);
    await h.run(60); // settles on its suspension
    const replica = b.world.children.find((e: IEntity) => e.name === car.name) as GgCarEntity;
    expect(replica).toBeInstanceOf(GgCarEntity);
    car.gear = 1;
    car.acceleration = 1;
    await h.run(60); // up to speed, the replica following
    return { a, b, car, replica };
  };

  /**
   * Steps `ticks` ticks, switching `peer`'s frame before tick `switchAt`, and returns, for each
   * watched entity, the largest change of its global position from one tick to the next within two
   * ticks of the switch (`around`), and the larger of the changes three ticks before and three
   * ticks after it (`nearby`): a car moving smoothly moves about as far per tick around the switch
   * as just outside that window.
   */
  const watch = async (
    ticks: number,
    switchAt: number,
    peer: Peer,
    watched: { peer: Peer; entity: { position: Point3 } }[],
  ) => {
    const last = watched.map(w => globalPosition(w.peer, w.entity));
    const around = watched.map(() => 0);
    const nearby = watched.map(() => 0);
    for (let i = 0; i < ticks; i++) {
      if (i === switchAt) {
        world3d(peer).switchFrame(FRAME_SWITCHED);
      }
      h.step(1);
      await new Promise(resolve => setTimeout(resolve, 0));
      watched.forEach((w, j) => {
        const now = globalPosition(w.peer, w.entity);
        const moved = dist(now, last[j]);
        last[j] = now;
        if (Math.abs(i - switchAt) <= 2) {
          around[j] = Math.max(around[j], moved);
        } else if (Math.abs(i - switchAt) === 3) {
          nearby[j] = Math.max(nearby[j], moved);
        }
      });
    }
    return { around, nearby };
  };

  it('on the owner: the replica on the other peer moves on without a jump', async () => {
    const { a, b, car, replica } = await drivingCar();
    const speed = car.raycastVehicle.vehicleComponent.linearVelocity;
    const perTick = (Math.hypot(speed.x, speed.y, speed.z) * TICK_MS) / 1000;
    expect(perTick).toBeGreaterThan(0.05); // it is moving
    const gapBefore = dist(globalPosition(b, replica), globalPosition(a, car));
    const { around, nearby } = await watch(60, 20, a, [
      { peer: a, entity: car },
      { peer: b, entity: replica },
    ]);
    expect(world3d(a).frame.equals(FRAME_SWITCHED)).toBe(true);
    // per tick, neither the car nor its replica moves further around the switch than just outside it
    // (the car accelerates: the step three ticks after the switch is the longest of the window)
    expect(around[0]).toBeLessThan(nearby[0] + 0.005);
    expect(around[1]).toBeLessThan(nearby[1] + 0.005);
    // and the replica keeps following the car as closely as before
    expect(dist(globalPosition(b, replica), globalPosition(a, car))).toBeLessThan(Math.max(gapBefore, 0.1) + 0.1);
  });

  it('on the replica peer: the replica keeps its global pose and the owner sees nothing', async () => {
    const { a, b, car, replica } = await drivingCar();
    const gapBefore = dist(globalPosition(b, replica), globalPosition(a, car));
    const { around, nearby } = await watch(60, 20, b, [
      { peer: a, entity: car },
      { peer: b, entity: replica },
    ]);
    expect(world3d(b).frame.equals(FRAME_SWITCHED)).toBe(true);
    expect(around[0]).toBeLessThan(nearby[0] + 0.005);
    expect(around[1]).toBeLessThan(nearby[1] + 0.005);
    expect(dist(globalPosition(b, replica), globalPosition(a, car))).toBeLessThan(Math.max(gapBefore, 0.1) + 0.1);
  });
});
