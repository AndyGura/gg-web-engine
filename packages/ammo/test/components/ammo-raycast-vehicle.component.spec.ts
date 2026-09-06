import { SuspensionOptions, WheelOptions } from '@gg-web-engine/core';
import { AmmoFactory, AmmoRaycastVehicleComponent, AmmoRigidBodyComponent, AmmoWorldComponent } from '../../src';

// Shared suspension/wheel setup mirroring examples/ammo-car-three-ammo, known to produce a
// stable, quickly-settling vehicle - see that example for the full car setup.
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

const addWheels = (vehicle: AmmoRaycastVehicleComponent) => {
  for (const isFront of [true, false]) {
    for (const isLeft of [true, false]) {
      vehicle.addWheel(wheelOptions(isFront, isLeft), suspension);
    }
  }
};

const createFloor = (
  factory: AmmoFactory,
  topZ: number,
): AmmoRigidBodyComponent =>
  factory.createRigidBody(
    {
      shape: { shape: 'BOX', dimensions: { x: 75, y: 75, z: 1 } },
      body: { dynamic: false, mass: 0 },
    },
    { position: { x: 0, y: 0, z: topZ - 0.5 } },
  );

const createVehicle = (
  world: AmmoWorldComponent,
  factory: AmmoFactory,
  position: { x: number; y: number; z: number },
): AmmoRaycastVehicleComponent => {
  const chassis = factory.createRigidBody(
    { shape: { shape: 'BOX', dimensions: { x: 1.8, y: 4, z: 0.6 } }, body: { dynamic: true, mass: 800 } },
    { position },
  );
  const vehicle = factory.createRaycastVehicle(chassis);
  addWheels(vehicle);
  return vehicle;
};

describe('AmmoRaycastVehicleComponent', () => {
  let world: AmmoWorldComponent;
  let factory: AmmoFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new AmmoWorldComponent();
    await world.init();
    factory = world.factory;
    // default earth-like gravity, so vehicles actually fall onto the floors below
    world.gravity = { x: 0, y: 0, z: -9.82 };
  });

  afterAll(() => {
    world.dispose();
  });

  it('should fall under gravity and come to rest on a floor below it', () => {
    const floor = createFloor(factory, 0);
    floor.addToWorld({ physicsWorld: world } as any);

    const vehicle = createVehicle(world, factory, { x: 0, y: 0, z: 4 });
    vehicle.addToWorld({ physicsWorld: world } as any);

    for (let i = 0; i < 100; i++) {
      world.simulate(60);
    }

    // chassis should have settled just above the floor surface (z = 0), not still falling
    // and not sunk through it
    expect(vehicle.position.z).toBeGreaterThan(-1);
    expect(vehicle.position.z).toBeLessThan(3);
    expect(vehicle.isWheelTouchesGround(0)).toBe(true);
  });

  it('should let each vehicle fall through a floor with a different collision group and rest ' +
    'only on the floor sharing its own collision group', () => {
    const groupA = world.registerCollisionGroup();
    const groupB = world.registerCollisionGroup();

    const floorA = createFloor(factory, 0);
    floorA.addToWorld({ physicsWorld: world } as any);
    floorA.ownCollisionGroups = floorA.interactWithCollisionGroups = [groupA];

    const floorB = createFloor(factory, -10);
    floorB.addToWorld({ physicsWorld: world } as any);
    floorB.ownCollisionGroups = floorB.interactWithCollisionGroups = [groupB];

    const vehicleA = createVehicle(world, factory, { x: 0, y: 0, z: 4 });
    vehicleA.addToWorld({ physicsWorld: world } as any);
    vehicleA.ownCollisionGroups = vehicleA.interactWithCollisionGroups = [groupA];

    const vehicleB = createVehicle(world, factory, { x: 20, y: 0, z: 4 });
    vehicleB.addToWorld({ physicsWorld: world } as any);
    vehicleB.ownCollisionGroups = vehicleB.interactWithCollisionGroups = [groupB];

    for (let i = 0; i < 100; i++) {
      world.simulate(60);
    }

    // vehicleA shares its collision group with floorA (z=0) - it should have landed there,
    // both via chassis-body collision and via the raycast vehicle's suspension.
    expect(vehicleA.position.z).toBeGreaterThan(-1);
    expect(vehicleA.position.z).toBeLessThan(3);
    expect(vehicleA.isWheelTouchesGround(0)).toBe(true);

    // vehicleB does not share a collision group with floorA, so it must fall straight through
    // it (this is what the custom btVehicleRaycaster collision-group patch fixes: without it,
    // the wheel raycast ignores collision groups entirely and would detect floorA as ground,
    // holding the vehicle up via suspension force even though its chassis passes through).
    // It should come to rest on floorB (z=-10) instead.
    expect(vehicleB.position.z).toBeGreaterThan(-11);
    expect(vehicleB.position.z).toBeLessThan(-7);
    expect(vehicleB.isWheelTouchesGround(0)).toBe(true);
  });
});
