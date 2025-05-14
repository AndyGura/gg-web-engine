import { Pnt2 } from '@gg-web-engine/core';
import { MatterFactory, MatterWorldComponent } from '../../src';

describe(`MatterTriggerComponent`, () => {

  let world: MatterWorldComponent;
  let factory: MatterFactory;
  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new MatterWorldComponent();
    factory = new MatterFactory(world);
    await world.init();
    world.gravity = Pnt2.O;
  });

  afterAll(() => {
    world.dispose();
  });

  // FIXME matter.js logic is kinda not intuitive. Spawning objects on some coordinates seems to cause collisions with
  // all the objects that intersect the line between (0, 0) and desired position, sensors are flying away to the
  // infinity just by setting it's position and other wonderful miracles. Investigate why these tests fail and try to fix.
  // Note: this test is identical to rapier2d trigger test, and it is expected
  it.skip(`should detect object intersection`, async () => {
    const trigger = factory.createTrigger({ shape: 'SQUARE', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 12 } });
    circle.addToWorld({ physicsWorld: world } as any);
    circle.linearVelocity = { x: 0, y: -10 };
    circle.nativeBody.frictionAir = 0;
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

  it.skip(`should detect end of object intersection`, async () => {
    const trigger = factory.createTrigger({ shape: 'SQUARE', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 12 } });
    circle.addToWorld({ physicsWorld: world } as any);
    circle.linearVelocity = { x: 0, y: -10 };
    circle.nativeBody.frictionAir = 0;
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

  it.skip(`should fire object intersection if spawned inside`, async () => {
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

  it.skip(`should fire end of object intersection if trigger removed`, async () => {
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
    trigger.checkOverlaps();
    trigger.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(true);
  });

  it.skip(`should fire end of object intersection if object removed`, async () => {
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
    trigger.checkOverlaps();
    circle.removeFromWorld({ physicsWorld: world } as any);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });
});
