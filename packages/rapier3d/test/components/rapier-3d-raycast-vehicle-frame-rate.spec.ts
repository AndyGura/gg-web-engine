import { defaultMaxSuspensionForce, SuspensionOptions, WheelOptions } from '@gg-web-engine/core';
import { Rapier3dRaycastVehicleComponent, Rapier3dWorldComponent } from '../../src';

const MASS = 1549;
const suspension: SuspensionOptions = { stiffness: 40, damping: 5, compression: 3, restLength: 0.2 };
const wheelOptions = (isFront: boolean, isLeft: boolean): WheelOptions => ({
  isFront,
  isLeft,
  tyreRadius: 0.33,
  tyreWidth: 0.25,
  frictionSlip: 4,
  rollInfluence: 0.2,
  maxTravel: 0.13,
  position: { x: isLeft ? 0.8 : -0.8, y: isFront ? 1.3 : -1.2, z: -0.1 },
});

const createSettledVehicle = async (fps: number) => {
  const world = new Rapier3dWorldComponent();
  await world.init();
  world.gravity = { x: 0, y: 0, z: -9.82 };
  world.factory
    .createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 200, y: 2000, z: 1 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 900, z: -0.5 } },
    )
    .addToWorld({ physicsWorld: world } as any);
  const chassis = world.factory.createRigidBody(
    { shape: { shape: 'BOX', dimensions: { x: 1.8, y: 4.4, z: 0.6 } }, body: { bodyType: 'dynamic', mass: MASS } },
    { position: { x: 0, y: 0, z: 0.6 } },
  );
  const vehicle: Rapier3dRaycastVehicleComponent = world.factory.createRaycastVehicle(chassis);
  for (const isFront of [true, false]) {
    for (const isLeft of [true, false]) {
      vehicle.addWheel(wheelOptions(isFront, isLeft), suspension);
    }
  }
  vehicle.addToWorld({ physicsWorld: world } as any);
  for (let i = 0; i < 2 * fps; i++) {
    world.simulate(1000 / fps);
  }
  return { world, vehicle };
};

describe('Rapier3dRaycastVehicleComponent frame-rate independence', () => {
  it('brakes with the deceleration its brake force gives, at 30, 60 and 144 FPS', async () => {
    // regression: the brake value went to setWheelBrake as is - Rapier's brake is the impulse of one
    // updateVehicle call, which runs once per tick, so it braked in proportion to the frame rate
    const force = 2000;
    for (const fps of [30, 60, 144]) {
      const { world, vehicle } = await createSettledVehicle(fps);
      vehicle.linearVelocity = { x: 0, y: 30, z: 0 };
      for (let i = 0; i < fps; i++) {
        for (let w = 0; w < 4; w++) {
          vehicle.applyBrake(w, force);
        }
        world.simulate(1000 / fps);
      }
      expect(30 - vehicle.linearVelocity.y).toBeCloseTo((4 * force) / MASS, 1);
    }
  });

  it('accelerates with the acceleration its engine force gives, at 30, 60 and 144 FPS', async () => {
    const force = 2000;
    for (const fps of [30, 60, 144]) {
      const { world, vehicle } = await createSettledVehicle(fps);
      vehicle.linearVelocity = { x: 0, y: 0, z: 0 };
      for (let w = 0; w < 4; w++) {
        vehicle.applyEngineForce(w, force);
      }
      for (let i = 0; i < fps; i++) {
        world.simulate(1000 / fps);
      }
      expect(vehicle.linearVelocity.y).toBeCloseTo((4 * force) / MASS, 1);
    }
  });

  it('defaults a wheel to defaultMaxSuspensionForce of the chassis mass, or takes WheelOptions.maxSuspensionForce', async () => {
    const { vehicle } = await createSettledVehicle(60);
    expect(vehicle.nativeVehicle!.wheelMaxSuspensionForce(0)).toBeCloseTo(defaultMaxSuspensionForce(MASS), 0);
    vehicle.addWheel({ ...wheelOptions(true, true), maxSuspensionForce: 12345 }, suspension);
    expect(vehicle.nativeVehicle!.wheelMaxSuspensionForce(4)).toBeCloseTo(12345, 0);
  });

  it('corners the same at 30, 60 and 144 FPS', async () => {
    // regression: one native step per frame - suspension and tyre friction are explicit per-step
    // models, so a 33 ms step lost 15% more speed over this turn than a 7 ms one
    const result = async (fps: number) => {
      const { world, vehicle } = await createSettledVehicle(fps);
      vehicle.linearVelocity = { x: 0, y: 20, z: 0 };
      for (let i = 0; i < 3 * fps; i++) {
        vehicle.setSteering(0, 0.08);
        vehicle.setSteering(1, 0.08);
        world.simulate(1000 / fps);
      }
      const q = vehicle.rotation;
      return { yaw: 2 * Math.atan2(q.z, q.w), speed: Math.hypot(vehicle.linearVelocity.x, vehicle.linearVelocity.y) };
    };
    const reference = await result(144);
    for (const fps of [30, 60]) {
      const { yaw, speed } = await result(fps);
      expect(Math.abs(speed - reference.speed)).toBeLessThan(reference.speed * 0.02);
      expect(Math.abs(yaw - reference.yaw)).toBeLessThan(Math.abs(reference.yaw) * 0.02);
    }
  });
});

describe('Rapier3dWorldComponent substeps', () => {
  it('splits a frame into steps of at most fixedTimeStep that add up to the frame', async () => {
    const world = new Rapier3dWorldComponent();
    await world.init();
    const timesteps: number[] = [];
    const step = world.nativeWorld.step.bind(world.nativeWorld);
    world.nativeWorld.step = (...args: any[]) => {
      timesteps.push(world.nativeWorld.timestep);
      return step(...args);
    };
    for (const delta of [1000 / 30, 1000 / 60, 1000 / 144, 25]) {
      timesteps.length = 0;
      world.simulate(delta);
      expect(timesteps.length).toBe(Math.ceil(delta / 10));
      for (const t of timesteps) {
        expect(t).toBeCloseTo(delta / 1000 / timesteps.length, 6);
      }
    }
  });

  it('carries a box on a moving kinematic platform the same at 30, 60 and 144 FPS', async () => {
    // regression guard for the substeps: Rapier reaches a kinematic body's next position in the
    // first step, so without spreading the move over the steps the platform moved n times too fast
    // for one step and stood still for the rest - at 30 FPS the box rode 0.07 m instead of 2.6 m
    const lag = async (fps: number) => {
      const world = new Rapier3dWorldComponent();
      await world.init();
      world.gravity = { x: 0, y: 0, z: -9.82 };
      const platform = world.factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 10, y: 10, z: 1 } }, body: { bodyType: 'kinematic_pos', mass: 0, friction: 1 } },
        { position: { x: 0, y: 0, z: -0.5 } },
      );
      platform.addToWorld({ physicsWorld: world } as any);
      const box = world.factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 10, friction: 1 } },
        { position: { x: 0, y: 0, z: 0.5 } },
      );
      box.addToWorld({ physicsWorld: world } as any);
      for (let i = 0; i < fps; i++) {
        world.simulate(1000 / fps);
      }
      for (let i = 1; i <= fps; i++) {
        platform.position = { x: 0, y: (3 * i) / fps, z: -0.5 };
        world.simulate(1000 / fps);
      }
      return platform.position.y - box.position.y;
    };
    const reference = await lag(144);
    expect(reference).toBeLessThan(1);
    for (const fps of [30, 60]) {
      expect(Math.abs((await lag(fps)) - reference)).toBeLessThan(0.05);
    }
  });
});
