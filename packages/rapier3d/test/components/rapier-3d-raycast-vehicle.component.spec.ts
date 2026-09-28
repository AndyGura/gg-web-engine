import { SuspensionOptions, WheelOptions } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dRaycastVehicleComponent, Rapier3dRigidBodyComponent, Rapier3dWorldComponent } from '../../src';

// Shared suspension/wheel setup mirroring examples/ammo-car-three-rapier3d (itself a port of
// examples/ammo-car-three-ammo) - see that example for the full car setup.
const suspension: SuspensionOptions = {
  compression: 4.4,
  damping: 2.3,
  restLength: 0.6,
  stiffness: 20,
};

const wheelOptions = (isFront: boolean, isLeft: boolean): WheelOptions => ({
  isFront,
  isLeft,
  tyreRadius: isFront ? 0.35 : 0.4,
  tyreWidth: isFront ? 0.2 : 0.3,
  frictionSlip: 1000,
  rollInfluence: 0.2,
  maxTravel: 5,
  position: {
    x: isLeft ? 1 : -1,
    y: isFront ? 1.7 : -1,
    z: 0.3,
  },
});

const addWheels = (vehicle: Rapier3dRaycastVehicleComponent) => {
  for (const isFront of [true, false]) {
    for (const isLeft of [true, false]) {
      vehicle.addWheel(wheelOptions(isFront, isLeft), suspension);
    }
  }
};

const createFloor = (factory: Rapier3dFactory, world: Rapier3dWorldComponent, topZ: number): Rapier3dRigidBodyComponent => {
  const floor = factory.createRigidBody(
    { shape: { shape: 'BOX', dimensions: { x: 75, y: 75, z: 1 } }, body: { bodyType: 'static', mass: 0 } },
    { position: { x: 0, y: 0, z: topZ - 0.5 } },
  );
  floor.addToWorld({ physicsWorld: world } as any);
  return floor;
};

const createVehicle = (
  world: Rapier3dWorldComponent,
  factory: Rapier3dFactory,
  position: { x: number; y: number; z: number },
): Rapier3dRaycastVehicleComponent => {
  const chassis = factory.createRigidBody(
    { shape: { shape: 'BOX', dimensions: { x: 1.8, y: 4, z: 0.6 } }, body: { bodyType: 'dynamic', mass: 800 } },
    { position },
  );
  const vehicle = factory.createRaycastVehicle(chassis);
  addWheels(vehicle);
  vehicle.addToWorld({ physicsWorld: world } as any);
  return vehicle;
};

// Small steps, matching this package's other integration specs (see
// `rapier-3d-rigid-body-collision.spec.ts`) rather than one huge `simulate()` call.
const advance = (world: Rapier3dWorldComponent, totalMs: number, stepMs = 16) => {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    world.simulate(stepMs);
  }
};

describe('Rapier3dRaycastVehicleComponent', () => {
  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier3dWorldComponent();
    await world.init();
    factory = world.factory;
    // default earth-like gravity, so vehicles actually fall onto the floors below
    world.gravity = { x: 0, y: 0, z: -9.82 };
  });

  afterAll(() => {
    world.dispose();
  });

  it('should fall under gravity and come to rest on a floor below it', () => {
    createFloor(factory, world, 0);
    const vehicle = createVehicle(world, factory, { x: 0, y: 0, z: 4 });

    advance(world, 6000);

    // chassis should have settled just above the floor surface (z = 0), not still falling
    // and not sunk through it
    expect(vehicle.position.z).toBeGreaterThan(-1);
    expect(vehicle.position.z).toBeLessThan(3);
    expect(vehicle.isWheelTouchesGround(0)).toBe(true);
  });

  it(
    'should let each vehicle fall through a floor with a different collision group and rest ' +
      'only on the floor sharing its own collision group',
    () => {
      const groupA = world.registerCollisionGroup();
      const groupB = world.registerCollisionGroup();

      const floorA = createFloor(factory, world, 0);
      floorA.ownCollisionGroups = floorA.interactWithCollisionGroups = [groupA];

      const floorB = createFloor(factory, world, -10);
      floorB.ownCollisionGroups = floorB.interactWithCollisionGroups = [groupB];

      const vehicleA = createVehicle(world, factory, { x: 0, y: 0, z: 4 });
      vehicleA.ownCollisionGroups = vehicleA.interactWithCollisionGroups = [groupA];

      const vehicleB = createVehicle(world, factory, { x: 20, y: 0, z: 4 });
      vehicleB.ownCollisionGroups = vehicleB.interactWithCollisionGroups = [groupB];

      advance(world, 6000);

      // vehicleA shares its collision group with floorA (z=0) - it should have landed there, both
      // via chassis-body collision and via the raycast vehicle's own suspension raycasts.
      expect(vehicleA.position.z).toBeGreaterThan(-1);
      expect(vehicleA.position.z).toBeLessThan(3);
      expect(vehicleA.isWheelTouchesGround(0)).toBe(true);

      // vehicleB does not share a collision group with floorA, so it must fall straight through it
      // (this is what threading `filterGroups` into `updateVehicle()` fixes - see
      // `Rapier3dRaycastVehicleComponent.stepVehicleController`'s doc - without it the wheels' own
      // suspension raycasts would ignore collision groups entirely and detect floorA as ground,
      // holding the vehicle up even though its chassis passes through). It should come to rest on
      // floorB (z=-10) instead.
      expect(vehicleB.position.z).toBeGreaterThan(-11);
      expect(vehicleB.position.z).toBeLessThan(-7);
      expect(vehicleB.isWheelTouchesGround(0)).toBe(true);
    },
  );

  it('should drive forward under engine force and report a matching positive wheelSpeed', () => {
    createFloor(factory, world, 0);
    const vehicle = createVehicle(world, factory, { x: 0, y: 0, z: 2 });

    // let it settle onto the floor first
    advance(world, 3000);
    const settledY = vehicle.position.y;

    // apply engine force to the rear wheels (indices 2, 3 per `addWheels`' iteration order)
    vehicle.applyEngineForce(2, 4000);
    vehicle.applyEngineForce(3, 4000);
    advance(world, 3000);

    // the vehicle should have moved forward (+y, this engine's forward axis) and report a
    // meaningfully positive speed while doing so - not still ~0 and not wildly larger than a sane
    // few-second driving distance (which would indicate a unit-conversion bug, e.g. a stray x3.6/
    // /3.6 - see `wheelSpeed`'s own doc).
    expect(vehicle.position.y).toBeGreaterThan(settledY + 0.5);
    expect(vehicle.wheelSpeed).toBeGreaterThan(0.1);
    expect(vehicle.wheelSpeed).toBeLessThan(50);
  });
});
