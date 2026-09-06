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

  // Rapier's world.step() runs narrow-phase collision detection against the positions from the
  // *start* of the step, then integrates velocities into new positions at the end of it - so a
  // collision/intersection that happens partway through one particular step is only reflected in
  // the EventQueue on the *following* step. With one huge step (e.g. simulate(500) covering half
  // a second of motion in a single leap) that shows up as a whole step's worth of lag, wrongly
  // looking like a missed event. Advancing in many small steps (as a real per-frame game loop
  // would) keeps that lag well under the assertion's resolution. Also, EventQueue was constructed
  // with autoDrain=true (see Rapier3dWorldComponent.init), which clears any undrained events right
  // before the *next* world.step() - so checkOverlaps() (which drains it) must be called after
  // every single simulate() call, not just once at the end of a batch, or interior events are lost.
  const advance = (totalMs: number, onStep: () => void, stepMs = 10) => {
    for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
      world.simulate(stepMs);
      onStep();
    }
  };

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
    advance(500, () => trigger.checkOverlaps()); // trigger entity performs that on tick
    expect(enterRegistered).toBe(false);
    expect(exitRegistered).toBe(false);

    advance(500, () => trigger.checkOverlaps());
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
    advance(1000, () => trigger.checkOverlaps());
    expect(exitRegistered).toBe(false);
    advance(1000, () => trigger.checkOverlaps());
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

  it(`should fire end of object intersection if trigger removed`, async () => {
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
    world.simulate(1);
    trigger.checkOverlaps();
    trigger.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(true);
  });

  it(`should fire end of object intersection if object removed`, async () => {
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
    world.simulate(1);
    trigger.checkOverlaps();
    ball.removeFromWorld({ physicsWorld: world } as any);
    world.simulate(1);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });
});
