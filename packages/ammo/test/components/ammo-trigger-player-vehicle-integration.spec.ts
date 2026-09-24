import { SuspensionOptions, WheelOptions } from '@gg-web-engine/core';
import { AmmoFactory, AmmoRaycastVehicleComponent, AmmoRigidBodyComponent, AmmoWorldComponent } from '../../src';

// Regression coverage for "a Trigger must detect the player character and vehicles" (gameplay-
// essential: "player entered this zone, run this script" / the same for cars in a racing game).
// Ammo already got this right for both cases by construction (see the doc this describes):
// `AmmoRaycastVehicleComponent extends AmmoRigidBodyComponent` (the chassis is an ordinary rigid
// body, already covered generically by `ammo-trigger.component.spec.ts`'s plain rigid-body cases -
// the vehicle case here just confirms the same holds for a real, wheeled `AmmoRaycastVehicleComponent`
// specifically) and `AmmoCharacterControllerComponent` registers into the same shared
// `AmmoBodyComponent.nativeBodyReverseMap` every other body component does, so `AmmoTriggerComponent`
// already resolves a character-controller overlap correctly today. This file exists so a future
// change to either component can't silently regress that without a test noticing - see
// `Rapier3dWorldComponent.handleIdEntityMap`'s doc in `packages/rapier3d` for the equivalent gap
// that *did* need a real fix on that adapter.

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

const createVehicle = (
  factory: AmmoFactory,
  position: { x: number; y: number; z: number },
): AmmoRaycastVehicleComponent => {
  const chassis: AmmoRigidBodyComponent = factory.createRigidBody(
    { shape: { shape: 'BOX', dimensions: { x: 1.8, y: 4, z: 0.6 } }, body: { bodyType: 'dynamic', mass: 800 } },
    { position },
  );
  const vehicle = factory.createRaycastVehicle(chassis);
  addWheels(vehicle);
  return vehicle;
};

describe('AmmoTriggerComponent x player/vehicle', () => {
  let world: AmmoWorldComponent;
  let factory: AmmoFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new AmmoWorldComponent();
    await world.init();
    factory = world.factory;
  });

  afterAll(() => {
    world.dispose();
  });

  it('fires onEntityEntered/onEntityLeft for a character controller walking through it', () => {
    world.gravity = { x: 0, y: 0, z: 0 };
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: -8, y: 0, z: 0 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    world.simulate(1); // register the fresh colliders with the broadphase, see other ammo specs

    let entered: unknown;
    let exited: unknown;
    trigger.onEntityEntered.subscribe(obj => (entered = obj));
    trigger.onEntityLeft.subscribe(obj => (exited = obj));

    for (let i = 0; i < 30; i++) {
      character.move({ x: 1, y: 0, z: 0 });
      world.simulate(10);
      trigger.checkOverlaps();
    }

    expect(entered).toBe(character);
    expect(exited).toBe(character);
  });

  it('fires onEntityEntered/onEntityLeft for a vehicle chassis falling through it', () => {
    world.gravity = { x: 0, y: 0, z: -9.82 };
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 20, y: 20, z: 2 } }, { position: { x: 0, y: 0, z: 2 } });
    trigger.addToWorld({ physicsWorld: world } as any);

    const vehicle = createVehicle(factory, { x: 0, y: 0, z: 10 });
    vehicle.addToWorld({ physicsWorld: world } as any);

    let entered: unknown;
    let exited: unknown;
    trigger.onEntityEntered.subscribe(obj => (entered = obj));
    trigger.onEntityLeft.subscribe(obj => (exited = obj));

    for (let i = 0; i < 100; i++) {
      world.simulate(20);
      trigger.checkOverlaps();
    }

    expect(entered).toBe(vehicle);
    expect(exited).toBe(vehicle);
  });
});
