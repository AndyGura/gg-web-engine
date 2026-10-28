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

  // Rapier generates intersection events against the body positions from the start of a step, so
  // a transition shows up one step late; many small steps (as a per-frame game loop takes) keep that
  // lag small. The world's event queue is drained on every `simulate()`, so the trigger's tick
  // (`checkOverlaps()`) runs after every step too.
  const advance = (totalMs: number, onStep: () => void, stepMs = 10) => {
    for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
      world.simulate(stepMs);
      onStep();
    }
  };
  const activated = (trigger: { debugBodySettings: { type: unknown } }) =>
    (trigger.debugBodySettings.type as { activated: () => boolean }).activated();

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
    // rapier2d-compat 0.20 runs narrow-phase (and therefore collision-event generation) against
    // the body positions as of the *start* of a step, i.e. the result of the previous step's
    // integration - so a transition only shows up in the event queue one `simulate()` call after
    // the geometry actually starts overlapping. One extra step is needed here to observe it.
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
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === circle;
    });
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(false);
    world.simulate(1000);
    trigger.checkOverlaps();
    // see the comment in the previous test: this step's drain only reports the *enter* event
    // (computed from the position after the first step); the exit doesn't show up until the
    // narrow-phase catches up with the position produced by this step's integration.
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
    world.simulate(1);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });

  describe('exact shape overlap (not the bounding box)', () => {
    // a 200x200 box rotated 45 degrees: its AABB spans about +-141 in x/y, its corners along the
    // axes. (120, 120) is inside that AABB but about 170 from the center along the diagonal,
    // outside the box's 100 half-extent
    const rot45 = Math.PI / 4;
    // an L: a 200x100 bar along x at y in [-100, 0] plus a 100x100 block at x in [-100, 0], y in
    // [0, 100]; the AABB quadrant x in [0, 100], y in [0, 100] is empty
    const lShape = {
      shape: 'COMPOUND' as const,
      children: [
        { position: { x: 0, y: -50 }, shape: { shape: 'BOX' as const, dimensions: { x: 200, y: 100 } } },
        { position: { x: -50, y: 50 }, shape: { shape: 'BOX' as const, dimensions: { x: 100, y: 100 } } },
      ],
    };

    const entered = (
      shape: Parameters<Rapier2dFactory['createTrigger']>[0],
      rotation: number | undefined,
      circlePosition: { x: number; y: number },
    ): boolean => {
      const trigger = factory.createTrigger(shape, { rotation });
      trigger.addToWorld({ physicsWorld: world } as any);
      const circle = factory.createRigidBody(
        { shape: { shape: 'CIRCLE', radius: 10 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: circlePosition },
      );
      circle.addToWorld({ physicsWorld: world } as any);
      let fired = false;
      trigger.onEntityEntered.subscribe(obj => (fired = fired || obj === circle));
      advance(30, () => trigger.checkOverlaps());
      return fired;
    };

    it('a box rotated 45 degrees does not fire for a body in its AABB corner', () => {
      expect(entered({ shape: 'BOX', dimensions: { x: 200, y: 200 } }, rot45, { x: 120, y: 120 })).toBe(false);
    });

    it('a box rotated 45 degrees fires for a body inside it', () => {
      expect(entered({ shape: 'BOX', dimensions: { x: 200, y: 200 } }, rot45, { x: 40, y: 40 })).toBe(true);
      expect(entered({ shape: 'BOX', dimensions: { x: 200, y: 200 } }, rot45, { x: 130, y: 0 })).toBe(true);
    });

    it('an L-shaped compound does not fire in the empty quadrant of its AABB', () => {
      expect(entered(lShape, undefined, { x: 50, y: 50 })).toBe(false);
    });

    it('an L-shaped compound fires inside either of its children', () => {
      expect(entered(lShape, undefined, { x: 50, y: -50 })).toBe(true);
      expect(entered(lShape, undefined, { x: -50, y: 50 })).toBe(true);
    });

    it('reports one enter and one leave for a body crossing from one compound child into the other and out', () => {
      const trigger = factory.createTrigger(lShape);
      trigger.addToWorld({ physicsWorld: world } as any);
      const circle = factory.createRigidBody(
        { shape: { shape: 'CIRCLE', radius: 10 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: { x: -50, y: -50 } },
      );
      circle.addToWorld({ physicsWorld: world } as any);
      const events: string[] = [];
      trigger.onEntityEntered.subscribe(obj => obj === circle && events.push('enter'));
      trigger.onEntityLeft.subscribe(obj => obj === circle && events.push('left'));
      // starts in the bar, moves up through the bar/block seam into the block, then out of the top
      advance(30, () => trigger.checkOverlaps());
      circle.linearVelocity = { x: 0, y: 300 };
      advance(1000, () => trigger.checkOverlaps());
      expect(circle.position.y).toBeGreaterThan(120);
      expect(events).toEqual(['enter', 'left']);
      expect(activated(trigger)).toBe(false);
    });
  });

  describe('one enter/leave per body', () => {
    it('reports one enter and one leave for a COMPOUND body passing through', () => {
      const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 200, y: 200 } });
      trigger.addToWorld({ physicsWorld: world } as any);
      // two circles side by side along x, both inside the trigger at once while it crosses
      const body = factory.createRigidBody(
        {
          shape: {
            shape: 'COMPOUND',
            children: [
              { position: { x: -20, y: 0 }, shape: { shape: 'CIRCLE', radius: 10 } },
              { position: { x: 20, y: 0 }, shape: { shape: 'CIRCLE', radius: 10 } },
            ],
          },
          body: { bodyType: 'dynamic', mass: 1 },
        },
        { position: { x: 0, y: -160 } },
      );
      body.addToWorld({ physicsWorld: world } as any);
      const events: string[] = [];
      trigger.onEntityEntered.subscribe(obj => obj === body && events.push('enter'));
      trigger.onEntityLeft.subscribe(obj => obj === body && events.push('left'));
      body.linearVelocity = { x: 0, y: 300 };
      advance(1100, () => trigger.checkOverlaps());
      expect(body.position.y).toBeGreaterThan(120);
      expect(events).toEqual(['enter', 'left']);
      expect(activated(trigger)).toBe(false);
    });

    // reparented, or hidden and shown again by a network layer, within one tick: no step runs in
    // between. With `occupyFreedSlot`, another body is added in between and takes the collider slot
    // the circle's removal freed, so the stop Rapier reports for the circle's old collider no longer
    // resolves to the circle
    it.each([false, true])(
      'a body removed and added back before the next step still reports leaving later (slot taken: %s)',
      occupyFreedSlot => {
        const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 200, y: 200 } });
        trigger.addToWorld({ physicsWorld: world } as any);
        const circle = factory.createRigidBody(
          { shape: { shape: 'CIRCLE', radius: 10 }, body: { bodyType: 'dynamic', mass: 1 } },
          { position: Pnt2.O },
        );
        circle.addToWorld({ physicsWorld: world } as any);
        const events: string[] = [];
        trigger.onEntityEntered.subscribe(obj => obj === circle && events.push('enter'));
        trigger.onEntityLeft.subscribe(obj => obj === circle && events.push('left'));
        advance(30, () => trigger.checkOverlaps());
        expect(events).toEqual(['enter']);
        circle.removeFromWorld({ physicsWorld: world } as any);
        if (occupyFreedSlot) {
          factory
            .createRigidBody(
              { shape: { shape: 'CIRCLE', radius: 10 }, body: { bodyType: 'dynamic', mass: 1 } },
              { position: { x: 1000, y: 0 } },
            )
            .addToWorld({ physicsWorld: world } as any);
        }
        circle.addToWorld({ physicsWorld: world } as any);
        expect(events).toEqual(['enter']); // the leave waits for the trigger's own tick
        advance(30, () => trigger.checkOverlaps());
        expect(events).toEqual(['enter', 'left', 'enter']);
        expect(activated(trigger)).toBe(true);
        circle.linearVelocity = { x: 0, y: 300 };
        advance(1000, () => trigger.checkOverlaps());
        expect(circle.position.y).toBeGreaterThan(120);
        expect(events).toEqual(['enter', 'left', 'enter', 'left']);
        expect(activated(trigger)).toBe(false);
      },
    );
  });

  it('completes onEntityEntered/onEntityLeft (and the inherited collision subjects) on dispose', () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);

    let enterCompleted = false;
    let leftCompleted = false;
    let startCompleted = false;
    let endCompleted = false;
    trigger.onEntityEntered.subscribe({ complete: () => (enterCompleted = true) });
    trigger.onEntityLeft.subscribe({ complete: () => (leftCompleted = true) });
    trigger.onCollisionStart.subscribe({ complete: () => (startCompleted = true) });
    trigger.onCollisionEnd.subscribe({ complete: () => (endCompleted = true) });

    trigger.dispose();

    expect(enterCompleted).toBe(true);
    expect(leftCompleted).toBe(true);
    expect(startCompleted).toBe(true);
    expect(endCompleted).toBe(true);
  });
});
