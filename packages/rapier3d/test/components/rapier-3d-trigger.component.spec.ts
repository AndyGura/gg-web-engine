import { Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

describe(`Rapier3dTriggerComponent`, () => {

  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;
  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier3dWorldComponent();
    factory = new Rapier3dFactory(world);
    await world.init();
    world.gravity = Pnt3.O;
  });

  afterAll(() => {
    world.dispose();
  });

  it(`should detect object intersection`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody({
      shape: { shape: 'SPHERE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 0, z: 12 } });
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 0, z: -10 };
    let enterRegistered = false;
    let exitRegistered = false;
    trigger.onEntityEntered.subscribe(((obj) => {
      enterRegistered = obj === ball;
    }));
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === ball;
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
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody({
      shape: { shape: 'SPHERE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 0, z: 12 } });
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 0, z: -10 };
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === ball;
    }));
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(false);
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });

  it(`should fire object intersection if spawned inside`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody({
      shape: { shape: 'SPHERE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 0, z: 0 } });
    ball.addToWorld({ physicsWorld: world } as any);
    let enterRegistered = false;
    trigger.onEntityEntered.subscribe(((obj) => {
      enterRegistered = obj === ball;
    }));
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(enterRegistered).toBe(true);
  });

  it.skip(`should fire end of object intersection if trigger removed`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody({
      shape: { shape: 'SPHERE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 0, z: 0 } });
    ball.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === ball;
    }));
    trigger.checkOverlaps();
    trigger.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(true);
  });

  it.skip(`should fire end of object intersection if object removed`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody({
      shape: { shape: 'SPHERE', radius: 1 },
      body: { dynamic: true, mass: 1 },
    }, { position: { x: 0, y: 0, z: 0 } });
    ball.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === ball;
    }));
    trigger.checkOverlaps();
    ball.removeFromWorld({ physicsWorld: world } as any);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });
});
