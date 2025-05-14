import { Pnt2 } from '@gg-web-engine/core';
import { Rapier2dFactory, Rapier2dWorldComponent } from '../../src';

describe(`Rapier2dTriggerComponent`, () => {

  let world: Rapier2dWorldComponent;
  let factory: Rapier2dFactory;
  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier2dWorldComponent();
    factory = new Rapier2dFactory(world);
    await world.init();
    world.gravity = Pnt2.O;
  });

  afterAll(() => {
    world.dispose();
  });

  it(`should detect object intersection`, async () => {
    const trigger = factory.createTrigger({ shape: 'SQUARE', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 12 } });
    circle.addToWorld({ physicsWorld: world } as any);
    circle.linearVelocity = { x: 0, y: -10 };
    let enterRegistered = false;
    let exitRegistered = false;
    trigger.onEntityEntered.subscribe(((obj) => {
      enterRegistered = obj === circle;
    }));
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === circle;
    }));
    world.simulate(500);
    trigger.checkOverlaps(); // trigger entity performs that on tick
    expect(enterRegistered).toBe(false);
    expect(exitRegistered).toBe(false);

    world.simulate(500);
    trigger.checkOverlaps();
    expect(enterRegistered).toBe(true);
    expect(exitRegistered).toBe(false);
  });

  it(`should detect end of object intersection`, async () => {
    const trigger = factory.createTrigger({ shape: 'SQUARE', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 12 } });
    circle.addToWorld({ physicsWorld: world } as any);
    circle.linearVelocity = { x: 0, y: -10 };
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === circle;
    }));
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(false);
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });

  it(`should fire object intersection if spawned inside`, async () => {
    const trigger = factory.createTrigger({ shape: 'SQUARE', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: Pnt2.O });
    circle.addToWorld({ physicsWorld: world } as any);
    let enterRegistered = false;
    trigger.onEntityEntered.subscribe(((obj) => {
      enterRegistered = obj === circle;
    }));
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(enterRegistered).toBe(true);
  });

  it(`should fire end of object intersection if trigger removed`, async () => {
    const trigger = factory.createTrigger({ shape: 'SQUARE', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: Pnt2.O });
    circle.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === circle;
    }));
    world.simulate(1);
    trigger.checkOverlaps();
    trigger.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(true);
  });

  it(`should fire end of object intersection if object removed`, async () => {
    const trigger = factory.createTrigger({ shape: 'SQUARE', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: Pnt2.O });
    circle.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === circle;
    }));
    world.simulate(1);
    trigger.checkOverlaps();
    circle.removeFromWorld({ physicsWorld: world } as any);
    world.simulate(1);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });
});
