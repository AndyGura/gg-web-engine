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

  // Note: this test is identical to rapier2d trigger test, and it is expected
  it(`should detect object intersection`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { bodyType: 'dynamic', mass: 1 },
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

  it(`should detect end of object intersection`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { bodyType: 'dynamic', mass: 1 },
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

  it(`should fire object intersection if spawned inside`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { bodyType: 'dynamic', mass: 1 },
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
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { bodyType: 'dynamic', mass: 1 },
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
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { bodyType: 'dynamic', mass: 1 },
    }, { position: Pnt2.O });
    circle.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === circle;
    }));
    world.simulate(1);
    trigger.checkOverlaps();
    circle.removeFromWorld({ physicsWorld: world } as any);
    // the removed$ reaction drops the overlap synchronously but emits onEntityLeft on a microtask
    // (see MatterTriggerComponent.removedSub's own doc) - nothing a later step/checkOverlaps() poll
    // could still notice, so give that microtask a chance to run
    await Promise.resolve();
    world.simulate(1);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });

  it(`should fire end of object intersection on the next microtask when the object is removed, with no step or checkOverlaps() poll`, async () => {
    // Composite.remove never fires a native collisionEnd for the body it removes, so the only thing
    // that can fire onEntityLeft for it is the trigger's own removed$ reaction. That reaction must
    // not emit inline from inside the removal's own call stack (a removal can happen partway
    // through an unrelated component's own lifecycle operation, e.g. a character's crouch/stand
    // capsule swap - see MatterTriggerComponent.removedSub's own doc), so the emission is deferred
    // to a microtask: not yet observable synchronously after removeFromWorld, observable right after
    // one microtask hop, with no simulate()/checkOverlaps() call in between at all.
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody({
      shape: { shape: 'CIRCLE', radius: 1 },
      body: { bodyType: 'dynamic', mass: 1 },
    }, { position: Pnt2.O });
    circle.addToWorld({ physicsWorld: world } as any);
    world.simulate(1);
    trigger.checkOverlaps();
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === circle;
    }));
    circle.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(false);
    await Promise.resolve();
    expect(exitRegistered).toBe(true);
  });
});
