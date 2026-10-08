import {
  defaultMaxSuspensionForce,
  Entity3d,
  Gg3dWorld,
  Pnt3,
  Qtrn,
  RaycastVehicle3dEntity,
  RVEntityProperties,
  SuspensionOptions,
  SurfaceFollowingEntity,
  WheelOptions,
} from '@gg-web-engine/core';
import Ammo from '../../src/ammo.js/ammo';
import { AmmoRaycastVehicleComponent, AmmoRigidBodyComponent, AmmoWorldComponent } from '../../src';

// A 1549 kg car on stiff, well-damped suspension, standing on a static plane. A plane rather than
// a large box: Bullet's ray test against a box hundreds of meters long misses now and then, which
// makes the wheels lose contact at random and hides what these tests measure.
const MASS = 1549;
const suspension: SuspensionOptions = { stiffness: 40, damping: 5, compression: 3, restLength: 0.2 };
const wheelOptions = (isFront: boolean, isLeft: boolean, frictionSlip: number): WheelOptions => ({
  isFront,
  isLeft,
  tyreRadius: 0.33,
  tyreWidth: 0.25,
  frictionSlip,
  rollInfluence: 0.2,
  maxTravel: 0.13,
  position: { x: isLeft ? 0.8 : -0.8, y: isFront ? 1.3 : -1.2, z: -0.1 },
});

const createWorld = async (): Promise<AmmoWorldComponent> => {
  const world = new AmmoWorldComponent();
  await world.init();
  world.gravity = { x: 0, y: 0, z: -9.82 };
  world.factory
    .createRigidBody({ shape: { shape: 'PLANE' }, body: { bodyType: 'static', mass: 0 } })
    .addToWorld({ physicsWorld: world } as any);
  return world;
};

const createVehicle = (world: AmmoWorldComponent, frictionSlip: number = 4): AmmoRaycastVehicleComponent => {
  const chassis = world.factory.createRigidBody(
    { shape: { shape: 'BOX', dimensions: { x: 1.8, y: 4.4, z: 0.6 } }, body: { bodyType: 'dynamic', mass: MASS } },
    { position: { x: 0, y: 0, z: 0.7 } },
  );
  const vehicle = world.factory.createRaycastVehicle(chassis);
  for (const isFront of [true, false]) {
    for (const isLeft of [true, false]) {
      vehicle.addWheel(wheelOptions(isFront, isLeft, frictionSlip), suspension);
    }
  }
  vehicle.addToWorld({ physicsWorld: world } as any);
  return vehicle;
};

/** Seconds a car takes to brake from 30 to 5 m/s at `fps`, with `force` N on every wheel. */
const brakingTime = async (fps: number, force: number): Promise<number> => {
  const world = await createWorld();
  const vehicle = createVehicle(world);
  for (let i = 0; i < 2 * fps; i++) {
    world.simulate(1000 / fps);
  }
  vehicle.linearVelocity = { x: 0, y: 30, z: 0 };
  let t = 0;
  while (vehicle.linearVelocity.y > 5 && t < 20) {
    for (let i = 0; i < 4; i++) {
      vehicle.applyBrake(i, force);
    }
    world.simulate(1000 / fps);
    t += 1 / fps;
  }
  world.dispose();
  return t;
};

describe('Ammo frame-rate independence', () => {
  it('brakes a raycast vehicle with the deceleration its brake force gives, at 30, 60 and 144 FPS', async () => {
    // regression: the brake value went to btRaycastVehicle::setBrake as is, which Bullet takes as
    // the impulse of one substep - the same value braked harder the shorter the substeps (higher FPS)
    const force = (MASS * 9.82 * 1.2) / 4; // 1.2 g in total
    const expected = 25 / (1.2 * 9.82);
    for (const fps of [30, 60, 144]) {
      const t = await brakingTime(fps, force);
      // one frame of quantization on top of a few % of solver differences
      expect(Math.abs(t - expected)).toBeLessThan(expected * 0.03 + 1 / fps);
    }
  });

  it('brakes a raycast vehicle equally at 50, 90 and 100 FPS (1, 2 and 2 substeps of different lengths)', async () => {
    const force = (MASS * 9.82) / 4;
    const times = [await brakingTime(50, force), await brakingTime(90, force), await brakingTime(100, force)];
    expect(Math.max(...times) - Math.min(...times)).toBeLessThan(0.03 * Math.min(...times));
  });

  it('accelerates a raycast vehicle with the acceleration its engine force gives, at 30, 60 and 144 FPS', async () => {
    const force = 2000;
    for (const fps of [30, 60, 144]) {
      const world = await createWorld();
      const vehicle = createVehicle(world);
      for (let i = 0; i < 2 * fps; i++) {
        world.simulate(1000 / fps);
      }
      for (let i = 0; i < 4; i++) {
        vehicle.applyEngineForce(i, force);
      }
      for (let i = 0; i < fps; i++) {
        world.simulate(1000 / fps);
      }
      expect(vehicle.linearVelocity.y).toBeCloseTo((4 * force) / MASS, 1);
      world.dispose();
    }
  });

  it('runs exactly ceil(delta / fixedTimeStep) substeps for any delta', async () => {
    // regression: Bullet keeps its accumulator in float, so delta / (delta / n) could round to just
    // below n - it ran n - 1 substeps and carried one into the next call
    const world = await createWorld();
    const native = world.dynamicAmmoWorld! as any;
    const stepSimulation = native.stepSimulation.bind(native);
    const substepCounts: number[] = [];
    native.stepSimulation = (...args: any[]) => {
      const n = stepSimulation(...args);
      substepCounts.push(n);
      return n;
    };
    let seed = 12345;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 20000; i++) {
      const delta = 4 + random() * 40;
      substepCounts.length = 0;
      world.simulate(delta);
      expect(substepCounts).toEqual([Math.ceil(delta / 10), 0]);
    }
    world.dispose();
  });

  it('defaults a wheel to defaultMaxSuspensionForce of the chassis mass, or takes WheelOptions.maxSuspensionForce', async () => {
    const world = await createWorld();
    const vehicle = createVehicle(world);
    expect(vehicle.nativeVehicle.getWheelInfo(0).get_m_maxSuspensionForce()).toBeCloseTo(
      defaultMaxSuspensionForce(MASS),
      0,
    );
    vehicle.addWheel({ ...wheelOptions(true, true, 4), maxSuspensionForce: 12345 }, suspension);
    expect(vehicle.nativeVehicle.getWheelInfo(4).get_m_maxSuspensionForce()).toBeCloseTo(12345, 0);
    world.dispose();
  });

  it('holds a car on its wheels under a 2 g load with the default max suspension force', async () => {
    // Bullet's own default of 6000 N per wheel holds a 1.5 t car only up to ~1.6 g (braking, a dip,
    // a landing): beyond it the chassis box sinks onto the road
    const chassisBottomUnder2g = async (maxSuspensionForce?: number) => {
      const world = await createWorld();
      world.gravity = { x: 0, y: 0, z: -2 * 9.82 };
      const vehicle = createVehicle(world);
      if (maxSuspensionForce !== undefined) {
        for (let i = 0; i < 4; i++) {
          vehicle.nativeVehicle.getWheelInfo(i).set_m_maxSuspensionForce(maxSuspensionForce);
        }
      }
      for (let i = 0; i < 180; i++) {
        world.simulate(1000 / 60);
      }
      const bottom = vehicle.position.z - 0.3;
      world.dispose();
      return bottom;
    };
    expect(await chassisBottomUnder2g()).toBeGreaterThan(0.1);
    expect(await chassisBottomUnder2g(6000)).toBeLessThan(0.02);
  });
});

describe('AmmoRigidBodyComponent teleports and resetMotion', () => {
  it('moves a dynamic body\'s motion state along with it, so the wheels of a reset vehicle sit at its new pose', async () => {
    const world = await createWorld();
    const vehicle = createVehicle(world);
    world.simulate(1000 / 60);
    vehicle.position = { x: 50, y: -20, z: 3 };
    vehicle.rotation = Qtrn.fromAngle(Pnt3.Z, 1);
    vehicle.resetMotion();
    const motionState = vehicle.nativeBody.getMotionState();
    const transform = new Ammo.btTransform();
    motionState.getWorldTransform(transform);
    expect(transform.getOrigin().x()).toBeCloseTo(50);
    expect(transform.getOrigin().y()).toBeCloseTo(-20);
    Ammo.destroy(transform);
    const wheel = vehicle.getWheelTransform(0).position;
    expect(Pnt3.dist(wheel, vehicle.position)).toBeLessThan(3);
    world.dispose();
  });

  it('resets a vehicle in place, without taking it out of the world', async () => {
    // regression: resetMotion removed the body (and the vehicle's action) for a tick, emitting
    // removed$/added$ - SurfaceFollowingEntity reacts to removed$ by dropping the body's road plane
    const world = await createWorld();
    const vehicle = createVehicle(world);
    const removed: unknown[] = [];
    world.removed$.subscribe(c => removed.push(c));
    vehicle.linearVelocity = { x: 3, y: 10, z: 0 };
    vehicle.angularVelocity = { x: 0, y: 0, z: 2 };
    vehicle.resetMotion();
    expect(removed).toEqual([]);
    expect(vehicle.linearVelocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(vehicle.angularVelocity).toEqual({ x: 0, y: 0, z: 0 });
    world.simulate(1000 / 60);
    expect(world.children).toContain(vehicle);
    expect(Math.abs(vehicle.linearVelocity.y)).toBeLessThan(0.1);
    world.dispose();
  });

  it('collides with a triangle mesh', async () => {
    // regression: AmmoFactory built every MESH triangle from vertices[f[0]].x, vertices[f[1]].y,
    // vertices[f[2]].z for all three corners - a degenerate point that nothing ever collided with
    const world = new AmmoWorldComponent();
    await world.init();
    world.gravity = { x: 0, y: 0, z: -9.82 };
    const mesh = world.factory.createRigidBody({
      shape: {
        shape: 'MESH',
        vertices: [
          { x: -10, y: -10, z: 0 },
          { x: 10, y: -10, z: 0 },
          { x: 10, y: 10, z: 0 },
          { x: -10, y: 10, z: 0 },
        ],
        faces: [
          [0, 1, 2],
          [0, 2, 3],
        ],
      },
      body: { bodyType: 'static', mass: 0 },
    });
    mesh.addToWorld({ physicsWorld: world } as any);
    const box: AmmoRigidBodyComponent = world.factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 2, y: 3, z: 2 } },
    );
    box.addToWorld({ physicsWorld: world } as any);
    for (let i = 0; i < 120; i++) {
      world.simulate(1000 / 60);
    }
    expect(box.position.z).toBeCloseTo(0.5, 1);
    world.dispose();
  });
});

describe('RaycastVehicle3dEntity resets on a SurfaceFollowingEntity and on a triangle mesh', () => {
  const carProperties: RVEntityProperties = {
    tractionBias: 0,
    suspension,
    wheelBase: {
      shared: { frictionSlip: 2.5, rollInfluence: 0.2, maxTravel: 0.13, tyreRadius: 0.33, tyreWidth: 0.25 },
      front: { halfAxleWidth: 0.8, axlePosition: 1.3, axleHeight: -0.1 },
      rear: { halfAxleWidth: 0.8, axlePosition: -1.2, axleHeight: -0.1 },
    },
  };
  // rolling hills
  const height = (x: number, y: number) => Math.sin(x / 7) * 2 + Math.cos(y / 9) * 1.5;
  const normal = (x: number, y: number) =>
    Pnt3.norm({ x: (-Math.cos(x / 7) * 2) / 7, y: (Math.sin(y / 9) * 1.5) / 9, z: 1 });

  const run = async (ground: 'surface' | 'mesh') => {
    const physics = new AmmoWorldComponent();
    const world = new Gg3dWorld({ physicsWorld: physics as any });
    await world.init();
    world.worldClock.start();
    world.worldClock.pause();
    physics.gravity = { x: 0, y: 0, z: -9.82 };
    const chassis = physics.factory.createRigidBody({
      shape: { shape: 'BOX', dimensions: { x: 1.8, y: 4.4, z: 0.6 } },
      body: { bodyType: 'dynamic', mass: MASS },
    });
    const vehicleComponent = physics.factory.createRaycastVehicle(chassis);
    const car = new RaycastVehicle3dEntity(carProperties, null, vehicleComponent as any);
    world.addEntity(car);
    car.position = { x: 0, y: 0, z: height(0, 0) + 1 };
    if (ground === 'surface') {
      const surface = new SurfaceFollowingEntity(p => ({
        position: { x: p.x, y: p.y, z: height(p.x, p.y) },
        normal: normal(p.x, p.y),
      }));
      world.addEntity(surface);
      surface.addCollider(vehicleComponent as any);
    } else {
      const vertices = [];
      const faces: [number, number, number][] = [];
      const n = 40;
      const step = 5;
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n; j++) {
          const x = (i - n / 2) * step;
          const y = (j - n / 2) * step;
          vertices.push({ x, y, z: height(x, y) });
        }
      }
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const a = i * (n + 1) + j;
          faces.push([a, a + n + 1, a + 1], [a + 1, a + n + 1, a + n + 2]);
        }
      }
      world.addEntity(
        new Entity3d({
          objectBody: physics.factory.createRigidBody({
            shape: { shape: 'MESH', vertices, faces },
            body: { bodyType: 'static', mass: 0 },
          }),
        }),
      );
    }
    let seed = 7919;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const fps = [30, 60, 144];
    const finite = (p: { x: number; y: number; z: number }) =>
      Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
    for (let k = 0; k < 60; k++) {
      for (let f = 0; f < 30; f++) {
        car.applyTraction('rear', random() < 0.5 ? 4000 : 0);
        car.steeringAngle = (random() - 0.5) * 0.6;
        world.worldClock.step(1000 / fps[k % 3]);
        expect(finite(vehicleComponent.position)).toBe(true);
        expect(finite(vehicleComponent.linearVelocity)).toBe(true);
        expect(finite(vehicleComponent.angularVelocity)).toBe(true);
      }
      // any orientation, often starting embedded in the ground
      const x = (random() - 0.5) * 120;
      const y = (random() - 0.5) * 120;
      car.resetTo({
        position: { x, y, z: height(x, y) + 0.2 + random() * 2 },
        rotation: Qtrn.fromEuler({ x: (random() - 0.5) * 6, y: (random() - 0.5) * 6, z: random() * 6.28 }),
      });
    }
    // an upright reset then settles on the ground and stays there
    car.applyTraction('both', 0);
    car.resetTo({ position: { x: 10, y: 10, z: height(10, 10) + 1 }, rotation: Qtrn.O });
    let maxSpeed = 0;
    for (let f = 0; f < 120; f++) {
      world.worldClock.step(1000 / 60);
      maxSpeed = Math.max(maxSpeed, Pnt3.len(vehicleComponent.linearVelocity));
    }
    const p = vehicleComponent.position;
    const gap = p.z - height(p.x, p.y);
    world.dispose();
    return { gap, maxSpeed };
  };

  it('stays finite through repeated resets and keeps standing on the surface planes afterwards', async () => {
    const { gap, maxSpeed } = await run('surface');
    expect(gap).toBeGreaterThan(0.2);
    expect(gap).toBeLessThan(1);
    expect(maxSpeed).toBeLessThan(8);
  });

  it('stays finite through repeated resets and keeps standing on the mesh afterwards', async () => {
    const { gap, maxSpeed } = await run('mesh');
    expect(gap).toBeGreaterThan(0.2);
    expect(gap).toBeLessThan(1);
    expect(maxSpeed).toBeLessThan(8);
  });
});

describe('SurfaceFollowingEntity on Ammo', () => {
  it('moves a static, zero-velocity plane under a fast car, placed from the first tick', async () => {
    // regression: kinematic planes got a velocity from every per-tick teleport (the car's own
    // speed, plus ~200 rad/s of spin from Qtrn.lookAt's flipping yaw on a nearly flat road), and a
    // new plane started at the world origin
    const physics = new AmmoWorldComponent();
    const world = new Gg3dWorld({ physicsWorld: physics as any });
    await world.init();
    world.worldClock.start();
    world.worldClock.pause();
    physics.gravity = { x: 0, y: 0, z: -9.82 };
    const body = physics.factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1000, friction: 0 } },
      { position: { x: 100, y: 50, z: 0.5 } },
    );
    world.addEntity(new Entity3d({ objectBody: body }));
    let tilt = 1e-4;
    const surface = new SurfaceFollowingEntity(p => {
      tilt = -tilt; // a nearly flat road, its tiny tilt flipping sign from tick to tick
      return { position: { x: p.x, y: p.y, z: 0 }, normal: Pnt3.norm({ x: tilt, y: tilt, z: 1 }) };
    });
    world.addEntity(surface);
    surface.addCollider(body);
    const plane = physics.children.find(c => c.shape.shape === 'PLANE') as AmmoRigidBodyComponent;
    expect(plane.bodyType).toBe('static');
    expect(Pnt3.dist(plane.position, { x: 100, y: 50, z: 0 })).toBeLessThan(1e-6);
    body.linearVelocity = { x: 0, y: 40, z: 0 };
    for (let i = 0; i < 60; i++) {
      world.worldClock.step(1000 / 60);
      expect(Pnt3.len(plane.linearVelocity)).toBe(0);
      expect(Pnt3.len(plane.angularVelocity)).toBe(0);
      // a 1e-4 rad tilt changing sign every tick spun a kinematic plane, and the box with it, at 10 rad/s
      expect(Pnt3.len(body.angularVelocity)).toBeLessThan(5);
    }
    // contacts slow it down like any static ground; a kinematic plane moving with the box at its
    // own speed carried it along at 40 m/s
    expect(body.linearVelocity.y).toBeLessThan(39);
    expect(body.position.y).toBeGreaterThan(80);
    world.dispose();
  });
});
