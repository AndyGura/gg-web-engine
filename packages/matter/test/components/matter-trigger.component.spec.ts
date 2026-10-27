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

  it(`stays where it was placed under gravity, and never reports static level geometry`, async () => {
    world.gravity = { x: 0, y: 9.82 };
    const ground = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 100, y: 10 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 50 } },
    );
    ground.addToWorld({ physicsWorld: world } as any);
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } }, { position: { x: 0, y: 0 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    let entered = 0;
    trigger.onEntityEntered.subscribe(() => entered++);
    for (let i = 0; i < 300; i++) {
      world.simulate(16);
      trigger.checkOverlaps();
    }
    expect(trigger.position).toEqual({ x: 0, y: 0 });
    expect(entered).toBe(0);
  });

  it(`detects a kinematic body moving in and out`, async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const platform = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 2, y: 2 } }, body: { bodyType: 'kinematic_pos', mass: 0 } },
      { position: { x: 20, y: 0 } },
    );
    warn.mockRestore();
    platform.addToWorld({ physicsWorld: world } as any);
    const events: string[] = [];
    trigger.onEntityEntered.subscribe(obj => events.push(obj === platform ? 'enter' : 'other'));
    trigger.onEntityLeft.subscribe(obj => events.push(obj === platform ? 'left' : 'other'));
    const step = () => {
      world.simulate(16);
      trigger.checkOverlaps();
    };
    step();
    platform.position = { x: 0, y: 0 };
    step();
    step();
    expect(events).toEqual(['enter']);
    platform.position = { x: 20, y: 0 };
    step();
    expect(events).toEqual(['enter', 'left']);
  });

  it(`keeps a body that falls asleep inside, and reports it leaving after waking up`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const box = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 2, y: 2 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: Pnt2.O },
    );
    box.addToWorld({ physicsWorld: world } as any);
    const events: string[] = [];
    trigger.onEntityEntered.subscribe(obj => events.push(obj === box ? 'enter' : 'other'));
    trigger.onEntityLeft.subscribe(obj => events.push(obj === box ? 'left' : 'other'));
    const step = () => {
      world.simulate(16);
      trigger.checkOverlaps();
    };
    step();
    expect(events).toEqual(['enter']);
    box.sleep();
    for (let i = 0; i < 10; i++) {
      step();
    }
    expect(events).toEqual(['enter']);
    box.wakeUp();
    step();
    step();
    expect(events).toEqual(['enter']);
    box.position = { x: 20, y: 0 };
    step();
    step();
    expect(events).toEqual(['enter', 'left']);
  });

  it(`detects a body that is put to sleep before entering`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const box = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 2, y: 2 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: Pnt2.O },
    );
    box.sleep();
    box.addToWorld({ physicsWorld: world } as any);
    let entered = 0;
    trigger.onEntityEntered.subscribe(() => entered++);
    world.simulate(16);
    trigger.checkOverlaps();
    expect(entered).toBe(1);
  });

  // Note: this test is identical to rapier2d trigger test, and it is expected
  it(`should detect object intersection`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody(
      {
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: { x: 0, y: 12 } },
    );
    circle.addToWorld({ physicsWorld: world } as any);
    circle.linearVelocity = { x: 0, y: -10 };
    circle.nativeBody.frictionAir = 0;
    let enterRegistered = false;
    let exitRegistered = false;
    trigger.onEntityEntered.subscribe(obj => {
      enterRegistered = obj === circle;
    });
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === circle;
    });
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
    const circle = factory.createRigidBody(
      {
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: { x: 0, y: 12 } },
    );
    circle.addToWorld({ physicsWorld: world } as any);
    circle.linearVelocity = { x: 0, y: -10 };
    circle.nativeBody.frictionAir = 0;
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === circle;
    });
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
    const circle = factory.createRigidBody(
      {
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: Pnt2.O },
    );
    circle.addToWorld({ physicsWorld: world } as any);
    let enterRegistered = false;
    trigger.onEntityEntered.subscribe(obj => {
      enterRegistered = obj === circle;
    });
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(enterRegistered).toBe(true);
  });

  it(`should fire end of object intersection if trigger removed`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody(
      {
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: Pnt2.O },
    );
    circle.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === circle;
    });
    world.simulate(1);
    trigger.checkOverlaps();
    trigger.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(true);
  });

  it(`should fire end of object intersection if object removed`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody(
      {
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: Pnt2.O },
    );
    circle.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === circle;
    });
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
    // Composite.remove reports nothing at the moment of removal (the removed body's pairs would only
    // end on the next Engine.update, and the trigger purges them), so the only thing that can fire
    // onEntityLeft for it is the trigger's own removed$ reaction. That reaction must
    // not emit inline from inside the removal's own call stack (a removal can happen partway
    // through an unrelated component's own lifecycle operation, e.g. a character's crouch/stand
    // capsule swap - see MatterTriggerComponent.removedSub's own doc), so the emission is deferred
    // to a microtask: not yet observable synchronously after removeFromWorld, observable right after
    // one microtask hop, with no simulate()/checkOverlaps() call in between at all.
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const circle = factory.createRigidBody(
      {
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: Pnt2.O },
    );
    circle.addToWorld({ physicsWorld: world } as any);
    world.simulate(1);
    trigger.checkOverlaps();
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === circle;
    });
    circle.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(false);
    await Promise.resolve();
    expect(exitRegistered).toBe(true);
  });

  describe(`COMPOUND shapes`, () => {
    const step = (trigger: { checkOverlaps(): void }) => {
      world.simulate(16);
      trigger.checkOverlaps();
    };

    // two 4x4 boxes side by side, touching at x = 0: covers -4 <= x <= 4, -2 <= y <= 2
    const createTwoPartTrigger = () =>
      factory.createTrigger({
        shape: 'COMPOUND',
        children: [
          { position: { x: -2, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 4, y: 4 } } },
          { position: { x: 2, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 4, y: 4 } } },
        ],
      });

    const recordEvents = (trigger: ReturnType<typeof createTwoPartTrigger>, target: unknown) => {
      const events: string[] = [];
      trigger.onEntityEntered.subscribe(obj => events.push(obj === target ? 'enter' : 'other enter'));
      trigger.onEntityLeft.subscribe(obj => events.push(obj === target ? 'left' : 'other left'));
      return events;
    };

    it(`a compound trigger reports a body entering one of its parts`, () => {
      const trigger = createTwoPartTrigger();
      trigger.addToWorld({ physicsWorld: world } as any);
      const circle = factory.createRigidBody(
        { shape: { shape: 'CIRCLE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: { x: 3, y: 0 } },
      );
      circle.addToWorld({ physicsWorld: world } as any);
      const events = recordEvents(trigger, circle);
      step(trigger);
      expect(events).toEqual(['enter']);
    });

    it(`a body crossing between two parts of a compound trigger enters and leaves once`, () => {
      const trigger = createTwoPartTrigger();
      trigger.addToWorld({ physicsWorld: world } as any);
      const circle = factory.createRigidBody(
        { shape: { shape: 'CIRCLE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: { x: -10, y: 0 } },
      );
      circle.addToWorld({ physicsWorld: world } as any);
      const events = recordEvents(trigger, circle);
      for (let x = -10; x <= 10; x += 0.25) {
        circle.position = { x, y: 0 };
        step(trigger);
        if (x === 0) {
          // straddling the seam: inside both parts, still one enter and no leave
          expect(events).toEqual(['enter']);
        }
      }
      expect(events).toEqual(['enter', 'left']);
    });

    it(`a compound body entering a simple trigger is reported as its own component, once`, () => {
      const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
      trigger.addToWorld({ physicsWorld: world } as any);
      const body = factory.createRigidBody(
        {
          shape: {
            shape: 'COMPOUND',
            children: [
              { position: { x: -1, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } } },
              { position: { x: 1, y: 0 }, shape: { shape: 'CIRCLE', radius: 0.5 } },
            ],
          },
          body: { bodyType: 'dynamic', mass: 1 },
        },
        { position: { x: 20, y: 0 } },
      );
      body.addToWorld({ physicsWorld: world } as any);
      const events = recordEvents(trigger as any, body);
      step(trigger);
      expect(events).toEqual([]);
      body.position = Pnt2.O;
      step(trigger);
      step(trigger);
      expect(events).toEqual(['enter']);
      body.position = { x: 20, y: 0 };
      step(trigger);
      step(trigger);
      expect(events).toEqual(['enter', 'left']);
    });

    it(`a compound body removed inside a compound trigger leaves once, and re-enters when re-added`, async () => {
      const trigger = createTwoPartTrigger();
      trigger.addToWorld({ physicsWorld: world } as any);
      // straddles the seam: two parts of the body against two parts of the trigger
      const body = factory.createRigidBody(
        {
          shape: {
            shape: 'COMPOUND',
            children: [
              { position: { x: -1, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } } },
              { position: { x: 1, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } } },
            ],
          },
          body: { bodyType: 'dynamic', mass: 1 },
        },
        { position: Pnt2.O },
      );
      body.addToWorld({ physicsWorld: world } as any);
      const events = recordEvents(trigger, body);
      step(trigger);
      expect(events).toEqual(['enter']);

      // removed and re-added within one tick: a leave, then a fresh enter
      body.removeFromWorld({ physicsWorld: world } as any);
      body.addToWorld({ physicsWorld: world } as any);
      await Promise.resolve();
      expect(events).toEqual(['enter', 'left']);
      step(trigger);
      step(trigger);
      expect(events).toEqual(['enter', 'left', 'enter']);

      // removed for good: one leave, nothing from the pairs it left behind
      body.removeFromWorld({ physicsWorld: world } as any);
      await Promise.resolve();
      step(trigger);
      step(trigger);
      expect(events).toEqual(['enter', 'left', 'enter', 'left']);

      // and no stale count: re-added outside, then moved in and out again
      body.position = { x: 20, y: 0 };
      body.addToWorld({ physicsWorld: world } as any);
      step(trigger);
      body.position = Pnt2.O;
      step(trigger);
      body.position = { x: 20, y: 0 };
      step(trigger);
      expect(events).toEqual(['enter', 'left', 'enter', 'left', 'enter', 'left']);
    });

    it(`a removed and re-added compound trigger reports a body still inside again`, () => {
      const trigger = createTwoPartTrigger();
      trigger.addToWorld({ physicsWorld: world } as any);
      const circle = factory.createRigidBody(
        { shape: { shape: 'CIRCLE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: Pnt2.O },
      );
      circle.addToWorld({ physicsWorld: world } as any);
      const events = recordEvents(trigger, circle);
      step(trigger);
      trigger.removeFromWorld({ physicsWorld: world } as any);
      trigger.addToWorld({ physicsWorld: world } as any);
      step(trigger);
      expect(events).toEqual(['enter', 'left', 'enter']);
    });

    it(`polls against the trigger's parts, not their convex hull`, () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // an L: the notch around (2, 2) is inside the parts' hull but outside every part
      const trigger = factory.createTrigger({
        shape: 'COMPOUND',
        children: [
          { position: { x: 0, y: -2 }, shape: { shape: 'BOX', dimensions: { x: 8, y: 4 } } },
          { position: { x: -2, y: 2 }, shape: { shape: 'BOX', dimensions: { x: 4, y: 4 } } },
        ],
      });
      trigger.addToWorld({ physicsWorld: world } as any);
      const platform = factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } }, body: { bodyType: 'kinematic_pos', mass: 0 } },
        { position: { x: 2.5, y: 1.5 } },
      );
      warn.mockRestore();
      platform.addToWorld({ physicsWorld: world } as any);
      const events = recordEvents(trigger, platform);
      step(trigger);
      expect(events).toEqual([]);
      platform.position = { x: -2, y: 2 };
      step(trigger);
      expect(events).toEqual(['enter']);
    });
  });

  it(`clones into an independent sensor of the same shape, transform and collision groups`, () => {
    const trigger = factory.createTrigger(
      { shape: 'BOX', dimensions: { x: 10, y: 4 } },
      { position: { x: 3, y: 4 }, rotation: 0.5 },
    );
    trigger.ownCollisionGroups = [2];
    trigger.interactWithCollisionGroups = [3];
    trigger.addToWorld({ physicsWorld: world } as any);

    const clone = trigger.clone();

    expect(clone.nativeBody).not.toBe(trigger.nativeBody);
    expect(clone.nativeBody.isSensor).toBe(true);
    expect(clone.nativeBody.isStatic).toBe(true);
    expect(clone.shape).toEqual(trigger.shape);
    expect(clone.position.x).toBeCloseTo(3);
    expect(clone.position.y).toBeCloseTo(4);
    expect(clone.rotation).toBeCloseTo(0.5);
    expect(clone.ownCollisionGroups).toEqual([2]);
    expect(clone.interactWithCollisionGroups).toEqual([3]);

    clone.addToWorld({ physicsWorld: world } as any);
    expect(world.matterWorld!.bodies).toContain(clone.nativeBody);
    clone.position = { x: 10, y: 10 };
    expect(trigger.position.x).toBeCloseTo(3);
  });

  it(`clones a compound trigger`, () => {
    const trigger = factory.createTrigger({
      shape: 'COMPOUND',
      children: [
        { shape: { shape: 'BOX', dimensions: { x: 2, y: 2 } } },
        { position: { x: 3, y: 0 }, shape: { shape: 'CIRCLE', radius: 1 } },
      ],
    });

    const clone = trigger.clone();

    expect(clone.nativeBody.parts.length).toBe(trigger.nativeBody.parts.length);
    expect(clone.nativeBody.isSensor).toBe(true);
  });
});
