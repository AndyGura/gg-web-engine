// Shared frame-switch suite for 3D physics adapters (`Gg3dWorld.switchFrame`). Each adapter runs
// it from its own test folder:
//
//   import { describeFrameSwitchContract } from '../../../core/test/contract/frame-switch.contract';
//   describeFrameSwitchContract('ammo', () => new AmmoWorldComponent());
//
// The car scenario is the point: the same 30 s drive, once without and once with two frame
// switches, mapped back to global coordinates, must be the same trajectory. Unlike the general
// physics contract, this compares two runs of one backend with itself, so the tolerances are tight.
import {
  Entity3d,
  Frame3d,
  Gg3dWorld,
  GgCarEntity,
  GgCarProperties,
  IDisplayObject3dComponent,
  IEntity,
  IPhysicsWorld3dComponent,
  IRigidBody3dComponent,
  Pnt3,
  Point3,
  Point4,
  RVEntityProperties,
  RVEntityTractionBias,
  Shape3DDescriptor,
  TickOrder,
  Trigger3dEntity,
} from '@gg-web-engine/core';

export type FrameSwitchContractOptions = {
  /** The ground the car drives on: a static `PLANE` by default, a large box for a backend without planes. */
  ground?: { shape: Shape3DDescriptor; position: Point3 };
  /**
   * Called with the measured deviations of each car scenario, so a backend's spec can report them.
   * The suite asserts the thresholds itself.
   */
  report?: (scenario: 'far' | 'recentred', deviations: FrameSwitchDeviations) => void;
  /**
   * Bounds of the `far` scenario, where the switches put the car 15-21 km from the local origin
   * ({@link FRAME_SWITCH_ACCEPTANCE} when absent). A backend simulating in single precision cannot
   * reproduce a trajectory there to the centimeter: a float32 coordinate at 16 km has a 1-2 mm step,
   * rounded on every integration step and in every wheel contact, so the run drifts from the
   * near-origin reference by itself - with or without a switch. Such a backend sets these to its
   * measured drift (with margin) and says why in its spec; the `recentred` scenario, which keeps the
   * content near the origin, always asserts the acceptance thresholds.
   */
  farBounds?: { position: number; heading: number; speed: number };
};

/** Largest differences between the drive without frame switches and the one with them, in global coordinates. */
export type FrameSwitchDeviations = {
  /** meters */
  position: number;
  /** degrees */
  heading: number;
  /** m/s, of the speed (velocity length) */
  speed: number;
  /** m/s, of the velocity vector */
  velocity: number;
  /** meters: a wheel entity's global position, at the ticks of the switches and right after them */
  wheels: number;
};

export const FRAME_SWITCH_ACCEPTANCE = { position: 0.01, heading: 0.1, speed: 0.01 };

const FPS = 60;
const DT = 1000 / FPS;
const DURATION_S = 30;

/**
 * Δ1 and Δ2: the transforms applied to the world's content at 10 s and 20 s in the `far` scenario.
 * They put the car 15 km, then 21 km from the local origin.
 */
export const FRAME_SWITCH_DELTAS: [Frame3d, Frame3d] = [
  new Frame3d({ x: 12345.6, y: -7890.1, z: 3.0 }, 1.234),
  new Frame3d({ x: -4321.0, y: 9876.5, z: -2.0 }, -2.5),
];

const displayStub = (): IDisplayObject3dComponent => {
  const stub = {
    position: Pnt3.O,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
    name: '',
    visible: true,
    addToWorld() {},
    removeFromWorld() {},
    dispose() {},
    clone: () => displayStub(),
    getBoundings: () => ({ min: { x: -1, y: -2, z: -0.5 }, max: { x: 1, y: 2, z: 0.5 } }),
    enableRenderLayer() {},
    disableRenderLayer() {},
    isRenderLayerEnabled: () => true,
  };
  return stub as unknown as IDisplayObject3dComponent;
};

const carProperties = (): GgCarProperties & RVEntityProperties => ({
  mpsToRpmFactor: 100,
  tractionBias: RVEntityTractionBias.RWD,
  suspension: { stiffness: 40, damping: 5, compression: 3, restLength: 0.3 },
  wheelBase: {
    shared: {
      tyreWidth: 0.25,
      tyreRadius: 0.33,
      frictionSlip: 2.5,
      rollInfluence: 0.2,
      maxTravel: 0.2,
      display: { displayObject: displayStub() },
    },
    front: { halfAxleWidth: 0.8, axlePosition: 1.3, axleHeight: 0 },
    rear: { halfAxleWidth: 0.8, axlePosition: -1.2, axleHeight: 0 },
  },
  engine: {
    minRpm: 1000,
    maxRpm: 6000,
    torques: [
      { rpm: 1000, torque: 300 },
      { rpm: 6000, torque: 300 },
    ],
    maxRpmIncreasePerSecond: 7000,
    maxRpmDecreasePerSecond: 8000,
  },
  transmission: {
    isAuto: true,
    drivelineEfficiency: 0.9,
    reverseGearRatio: -3,
    gearRatios: [3, 2, 1.4, 1],
    finalDriveRatio: 4,
    upShifts: [5500, 5500, 5500, 5500],
    autoHold: true,
  },
  brake: { frontAxleForce: 3000, rearAxleForce: 2500, handbrakeForce: 5000 },
  maxSteerAngle: 0.5,
});

/** Runs `action` from its own tick, before the physics step, on the given world ticks (counted from 1). */
class TickHook extends IEntity {
  static readonly entityTypeName: string = 'TickHook';
  readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 10;
  private count = 0;

  constructor(action: (tick: number) => void) {
    super();
    this.tick$.subscribe(() => action(++this.count));
  }
}

const heading = (rotation: Point4): Point3 => Pnt3.rot(Pnt3.Y, rotation);

type Sample = { position: Point3; forward: Point3; velocity: Point3; wheels: Point3[] };

/** A frame switched to, or a function computing it from the world and the car right before the switch. */
type SwitchTarget = Frame3d | ((world: Gg3dWorld, car: GgCarEntity) => Frame3d);

const createGgWorld = async (createWorld: () => IPhysicsWorld3dComponent) => {
  const physics = createWorld();
  const world = new Gg3dWorld({ physicsWorld: physics as any });
  await world.init();
  physics.gravity = { x: 0, y: 0, z: -9.82 };
  world.worldClock.start();
  world.worldClock.pause();
  return { world, physics };
};

/**
 * Drives a car for 30 s with fixed inputs - full throttle from 0.5 s, a steering step at 6 s - and
 * samples its global pose and velocity after every tick. `switches` maps a tick number to the frame
 * switched to (from a pre-physics tick hook, so the switch is applied after that tick's step).
 */
const drive = async (
  createWorld: () => IPhysicsWorld3dComponent,
  options: FrameSwitchContractOptions,
  switches: Map<number, SwitchTarget>,
): Promise<Sample[]> => {
  const { world, physics } = await createGgWorld(createWorld);
  const ground = options.ground ?? { shape: { shape: 'PLANE' } as Shape3DDescriptor, position: Pnt3.O };
  world.addEntity(
    new Entity3d({
      objectBody: physics.factory.createRigidBody(
        { shape: ground.shape, body: { bodyType: 'static', mass: 0 } },
        { position: ground.position },
      ),
    }),
  );
  const chassisBody = physics.factory.createRigidBody({
    shape: {
      shape: 'COMPOUND',
      children: [{ shape: { shape: 'BOX', dimensions: { x: 1.8, y: 4.4, z: 0.8 } }, position: { x: 0, y: 0, z: 0.3 } }],
    },
    body: { mass: 1500, bodyType: 'dynamic', friction: 0.5, restitution: 0.3 },
  });
  const car = new GgCarEntity(carProperties(), displayStub(), physics.factory.createRaycastVehicle(chassisBody));
  car.position = { x: 0, y: 0, z: 1.2 };
  world.addEntity(car);
  car.gear = 1;
  world.addEntity(
    new TickHook(tick => {
      const t = (tick - 1) / FPS;
      car.acceleration = t >= 0.5 ? 1 : 0;
      car.steeringFactor = t >= 6 ? 0.35 : 0;
      const target = switches.get(tick);
      if (target) {
        world.switchFrame(typeof target === 'function' ? target(world, car) : target);
      }
    }),
  );
  const wheels = car.raycastVehicle.children.filter(c => c instanceof Entity3d) as Entity3d[];
  const samples: Sample[] = [];
  for (let i = 0; i < DURATION_S * FPS; i++) {
    world.worldClock.step(DT);
    samples.push({
      position: world.toGlobalPoint(car.position),
      forward: world.toGlobalDirection(heading(car.rotation)),
      velocity: world.toGlobalDirection(car.raycastVehicle.vehicleComponent.linearVelocity),
      wheels: wheels.map(w => world.toGlobalPoint(w.object3D!.position)),
    });
  }
  world.dispose();
  return samples;
};

const angleBetween = (a: Point3, b: Point3): number => {
  const ah = Math.atan2(a.y, a.x);
  const bh = Math.atan2(b.y, b.x);
  let d = Math.abs(ah - bh) % (2 * Math.PI);
  if (d > Math.PI) {
    d = 2 * Math.PI - d;
  }
  return (d * 180) / Math.PI;
};

/** Yaws of the `recentred` scenario's two switches. */
const RECENTRED_YAWS: [number, number] = [1.234, -2.5];

/**
 * The switch targets of a scenario, at 10 s and 20 s. `far`: the content is moved by
 * {@link FRAME_SWITCH_DELTAS}. `recentred`: the new frame is placed under the car, turned by
 * {@link RECENTRED_YAWS} - the way a large world moves the origin along with the player, so the
 * content stays near the local origin.
 */
const scenarioSwitches = (scenario: 'far' | 'recentred'): Map<number, SwitchTarget> => {
  const [t1, t2] = [10 * FPS, 20 * FPS];
  if (scenario === 'far') {
    const frame1 = FRAME_SWITCH_DELTAS[0].inverse();
    return new Map([
      [t1, frame1],
      [t2, frame1.compose(FRAME_SWITCH_DELTAS[1].inverse())],
    ]);
  }
  const under = (yaw: number) => (world: Gg3dWorld, car: GgCarEntity) => {
    const global = world.toGlobalPoint(car.position);
    return new Frame3d({ x: global.x, y: global.y, z: 0 }, world.frame.yaw + yaw);
  };
  return new Map([
    [t1, under(RECENTRED_YAWS[0])],
    [t2, under(RECENTRED_YAWS[1])],
  ]);
};

/** Drives a car scenario twice (without and with its two switches) and measures the largest deviations. */
export async function measureFrameSwitchDrive(
  createWorld: () => IPhysicsWorld3dComponent,
  options: FrameSwitchContractOptions = {},
  scenario: 'far' | 'recentred' = 'far',
): Promise<{ deviations: FrameSwitchDeviations; reference: Sample[] }> {
  const reference = await drive(createWorld, options, new Map());
  const switchTicks = [10 * FPS, 20 * FPS];
  const switched = await drive(createWorld, options, scenarioSwitches(scenario));
  const deviations: FrameSwitchDeviations = { position: 0, heading: 0, speed: 0, velocity: 0, wheels: 0 };
  for (let i = 0; i < reference.length; i++) {
    const a = reference[i];
    const b = switched[i];
    deviations.position = Math.max(deviations.position, Pnt3.dist(a.position, b.position));
    deviations.heading = Math.max(deviations.heading, angleBetween(a.forward, b.forward));
    deviations.speed = Math.max(deviations.speed, Math.abs(Pnt3.len(a.velocity) - Pnt3.len(b.velocity)));
    deviations.velocity = Math.max(deviations.velocity, Pnt3.dist(a.velocity, b.velocity));
  }
  for (const tick of switchTicks) {
    // samples are taken after the tick: index tick - 1 is the switch's own tick
    for (const i of [tick - 1, tick]) {
      reference[i].wheels.forEach((w, j) => {
        deviations.wheels = Math.max(deviations.wheels, Pnt3.dist(w, switched[i].wheels[j]));
      });
    }
  }
  return { deviations, reference };
}

export function describeFrameSwitchContract(
  backend: string,
  createWorld: () => IPhysicsWorld3dComponent,
  options: FrameSwitchContractOptions = {},
): void {
  describe(`frame switch: ${backend}`, () => {
    const expectNonTrivial = (reference: Sample[]) => {
      // the scenario is not trivial: the car moved far, fast and turned
      const last = reference[reference.length - 1];
      expect(Pnt3.len(reference[10 * FPS].velocity)).toBeGreaterThan(10);
      expect(Pnt3.dist(reference[0].position, last.position)).toBeGreaterThan(50);
    };

    it('a car driving through two re-centring frame switches follows the same global trajectory', async () => {
      const { deviations, reference } = await measureFrameSwitchDrive(createWorld, options, 'recentred');
      options.report?.('recentred', deviations);
      expectNonTrivial(reference);
      expect(deviations.position).toBeLessThan(FRAME_SWITCH_ACCEPTANCE.position);
      expect(deviations.heading).toBeLessThan(FRAME_SWITCH_ACCEPTANCE.heading);
      expect(deviations.speed).toBeLessThan(FRAME_SWITCH_ACCEPTANCE.speed);
      // the wheels are placed from the moved chassis on the switch's own tick
      expect(deviations.wheels).toBeLessThan(FRAME_SWITCH_ACCEPTANCE.position);
    }, 120000);

    it('a car moved 15-21 km from the origin by two frame switches follows the same global trajectory', async () => {
      const { deviations, reference } = await measureFrameSwitchDrive(createWorld, options, 'far');
      options.report?.('far', deviations);
      expectNonTrivial(reference);
      const bounds = options.farBounds ?? FRAME_SWITCH_ACCEPTANCE;
      expect(deviations.position).toBeLessThan(bounds.position);
      expect(deviations.heading).toBeLessThan(bounds.heading);
      expect(deviations.speed).toBeLessThan(bounds.speed);
      expect(deviations.wheels).toBeLessThan(bounds.position);
    }, 120000);

    describe('in a world', () => {
      let world: Gg3dWorld;
      let physics: IPhysicsWorld3dComponent;
      const step = (ticks: number) => {
        for (let i = 0; i < ticks; i++) {
          world.worldClock.step(DT);
        }
      };
      const groundEntity = () => {
        const ground = options.ground ?? { shape: { shape: 'PLANE' } as Shape3DDescriptor, position: Pnt3.O };
        const entity = new Entity3d({
          objectBody: physics.factory.createRigidBody(
            { shape: ground.shape, body: { bodyType: 'static', mass: 0 } },
            { position: ground.position },
          ),
        });
        world.addEntity(entity);
        return entity;
      };
      const box = (position: Point3, canSleep = true): Entity3d => {
        const entity = new Entity3d({
          objectBody: physics.factory.createRigidBody(
            {
              shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
              body: { bodyType: 'dynamic', mass: 10, canSleep },
            },
            { position },
          ),
        });
        world.addEntity(entity);
        return entity;
      };

      beforeEach(async () => {
        ({ world, physics } = await createGgWorld(createWorld));
      });

      afterEach(() => world.dispose());

      it('a trigger keeps its overlaps across a switch: no leave, no enter', () => {
        groundEntity();
        const inside = box({ x: 3, y: 2, z: 0.6 }, false);
        const trigger = new Trigger3dEntity(
          physics.factory.createTrigger({ shape: 'BOX', dimensions: { x: 6, y: 6, z: 2 } }),
        );
        // above the ground, around the lower half of the box resting on it
        trigger.position = { x: 3, y: 2, z: 1.5 };
        world.addEntity(trigger);
        const events: string[] = [];
        trigger.onEntityEntered.subscribe(e => events.push(`enter ${e === inside}`));
        trigger.onEntityLeft.subscribe(e => events.push(`leave ${e === inside}`));
        step(60);
        // the box; a backend may report the ground too (an infinite plane's bounds overlap everything)
        expect(events).toContain('enter true');
        expect(events.filter(e => e.startsWith('leave'))).toEqual([]);
        const before = [...events];
        world.switchFrame(FRAME_SWITCH_DELTAS[0].inverse());
        step(60);
        world.addEntity(
          new TickHook(tick => tick === 1 && world.switchFrame(world.frame.compose(FRAME_SWITCH_DELTAS[1].inverse()))),
        );
        step(60);
        expect(events).toEqual(before);
        expect(Pnt3.dist(world.toGlobalPoint(inside.position), { x: 3, y: 2, z: 0.5 })).toBeLessThan(0.05);
      });

      it('a sleeping body stays asleep, at the same global place', () => {
        groundEntity();
        const resting = box({ x: -2, y: 1, z: 0.5 });
        step(30);
        const body = resting.objectBody as IRigidBody3dComponent;
        body.sleep();
        expect(body.isSleeping).toBe(true);
        const global = world.toGlobalPoint(resting.position);
        world.switchFrame(FRAME_SWITCH_DELTAS[0].inverse());
        expect(body.isSleeping).toBe(true);
        expect(Pnt3.dist(world.toGlobalPoint(resting.position), global)).toBeLessThan(0.005);
        step(30);
        expect(body.isSleeping).toBe(true);
        expect(Pnt3.dist(world.toGlobalPoint(resting.position), global)).toBeLessThan(0.005);
      });

      it('a static body is found by a raycast right after the switch, where it moved', () => {
        groundEntity();
        const wall = new Entity3d({
          objectBody: physics.factory.createRigidBody(
            { shape: { shape: 'BOX', dimensions: { x: 1, y: 4, z: 4 } }, body: { bodyType: 'static', mass: 0 } },
            { position: { x: 10, y: 0, z: 2 } },
          ),
        });
        world.addEntity(wall);
        step(2);
        world.switchFrame(FRAME_SWITCH_DELTAS[0].inverse());
        const from = world.toLocalPoint({ x: 5, y: 0, z: 2 });
        const to = world.toLocalPoint({ x: 15, y: 0, z: 2 });
        const hit = physics.raycast({ from, to });
        expect(hit.hasHit).toBe(true);
        expect(hit.hitBody).toBe(wall.objectBody);
        expect(Pnt3.dist(world.toGlobalPoint(hit.hitPoint!), { x: 9.5, y: 0, z: 2 })).toBeLessThan(0.01);
      });

      it('a falling body keeps falling at the same global speed, without a jump or a streak', () => {
        groundEntity();
        const reference = box({ x: 0, y: 0, z: 30 }, false);
        step(30);
        const before = world.toGlobalDirection((reference.objectBody as IRigidBody3dComponent).linearVelocity);
        world.switchFrame(FRAME_SWITCH_DELTAS[0].inverse());
        const after = world.toGlobalDirection((reference.objectBody as IRigidBody3dComponent).linearVelocity);
        expect(Pnt3.dist(before, after)).toBeLessThan(1e-3);
        const global = world.toGlobalPoint(reference.position);
        step(1);
        const moved = Pnt3.dist(world.toGlobalPoint(reference.position), global);
        // one tick of falling at ~5 m/s, not a streak of thousands of meters
        expect(moved).toBeGreaterThan(0.05);
        expect(moved).toBeLessThan(0.2);
      });
    });
  });
}
