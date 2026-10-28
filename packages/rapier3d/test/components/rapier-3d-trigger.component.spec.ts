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
    const ball = factory.createRigidBody(
      {
        shape: { shape: 'SPHERE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: { x: 0, y: 0, z: 12 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 0, z: -10 };
    let enterRegistered = false;
    let exitRegistered = false;
    trigger.onEntityEntered.subscribe(obj => {
      enterRegistered = obj === ball;
    });
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === ball;
    });
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
    const ball = factory.createRigidBody(
      {
        shape: { shape: 'SPHERE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: { x: 0, y: 0, z: 12 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 0, z: -10 };
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === ball;
    });
    advance(1000, () => trigger.checkOverlaps());
    expect(exitRegistered).toBe(false);
    advance(1000, () => trigger.checkOverlaps());
    expect(exitRegistered).toBe(true);
  });

  it(`should fire object intersection if spawned inside`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody(
      {
        shape: { shape: 'SPHERE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: { x: 0, y: 0, z: 0 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    let enterRegistered = false;
    trigger.onEntityEntered.subscribe(obj => {
      enterRegistered = obj === ball;
    });
    world.simulate(1000);
    trigger.checkOverlaps();
    expect(enterRegistered).toBe(true);
  });

  it(`should fire end of object intersection if trigger removed`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody(
      {
        shape: { shape: 'SPHERE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: { x: 0, y: 0, z: 0 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === ball;
    });
    world.simulate(1);
    trigger.checkOverlaps();
    trigger.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(true);
  });

  it(`should fire end of object intersection if object removed`, async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody(
      {
        shape: { shape: 'SPHERE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 1 },
      },
      { position: { x: 0, y: 0, z: 0 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(obj => {
      exitRegistered = obj === ball;
    });
    world.simulate(1);
    trigger.checkOverlaps();
    ball.removeFromWorld({ physicsWorld: world } as any);
    world.simulate(1);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });

  it('completes onEntityEntered/onEntityLeft (and the inherited collision subjects) on dispose', () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
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

  describe('exact shape overlap (not the bounding box)', () => {
    // a 10x10x10 box rotated 45 degrees about Z: its AABB spans about +-7.07 in x/y, its corners
    // along the x/y axes. (6, 6) is inside that AABB but about 8.49 from the center along the
    // diagonal, outside the box's 5 half-extent
    const yaw45 = { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) };
    // an L: a 10x5 bar along y in [-5, 0] plus a 5x5 block at x in [-5, 0], y in [0, 5]; the AABB
    // quadrant x in [0, 5], y in [0, 5] is empty
    const lShape = {
      shape: 'COMPOUND' as const,
      children: [
        { position: { x: 0, y: -2.5, z: 0 }, shape: { shape: 'BOX' as const, dimensions: { x: 10, y: 5, z: 5 } } },
        { position: { x: -2.5, y: 2.5, z: 0 }, shape: { shape: 'BOX' as const, dimensions: { x: 5, y: 5, z: 5 } } },
      ],
    };

    const entered = (
      shape: Parameters<Rapier3dFactory['createTrigger']>[0],
      rotation: { x: number; y: number; z: number; w: number } | undefined,
      ballPosition: { x: number; y: number; z: number },
    ): boolean => {
      const trigger = factory.createTrigger(shape, { rotation });
      trigger.addToWorld({ physicsWorld: world } as any);
      const ball = factory.createRigidBody(
        { shape: { shape: 'SPHERE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: ballPosition },
      );
      ball.addToWorld({ physicsWorld: world } as any);
      let fired = false;
      trigger.onEntityEntered.subscribe(obj => (fired = fired || obj === ball));
      advance(30, () => trigger.checkOverlaps());
      return fired;
    };

    it('a box rotated 45 degrees about Z does not fire for a body in its AABB corner', () => {
      expect(entered({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } }, yaw45, { x: 6, y: 6, z: 0 })).toBe(false);
    });

    it('a box rotated 45 degrees about Z fires for a body inside it', () => {
      expect(entered({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } }, yaw45, { x: 2, y: 2, z: 0 })).toBe(true);
      expect(entered({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } }, yaw45, { x: 6.5, y: 0, z: 0 })).toBe(true);
    });

    it('an L-shaped compound does not fire in the empty quadrant of its AABB', () => {
      expect(entered(lShape, undefined, { x: 2.5, y: 2.5, z: 0 })).toBe(false);
    });

    it('an L-shaped compound fires inside either of its children', () => {
      expect(entered(lShape, undefined, { x: 2.5, y: -2.5, z: 0 })).toBe(true);
      expect(entered(lShape, undefined, { x: -2.5, y: 2.5, z: 0 })).toBe(true);
    });

    it('reports one enter and one leave for a body crossing from one compound child into the other and out', () => {
      const trigger = factory.createTrigger(lShape);
      trigger.addToWorld({ physicsWorld: world } as any);
      const ball = factory.createRigidBody(
        { shape: { shape: 'SPHERE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: { x: -2.5, y: -2.5, z: 0 } },
      );
      ball.addToWorld({ physicsWorld: world } as any);
      const events: string[] = [];
      trigger.onEntityEntered.subscribe(obj => obj === ball && events.push('enter'));
      trigger.onEntityLeft.subscribe(obj => obj === ball && events.push('left'));
      // starts in the bar, moves up through the bar/block seam into the block, then out of the top
      advance(30, () => trigger.checkOverlaps());
      ball.linearVelocity = { x: 0, y: 10, z: 0 };
      advance(1000, () => trigger.checkOverlaps());
      expect(ball.position.y).toBeGreaterThan(6);
      expect(events).toEqual(['enter', 'left']);
    });

    it('a body removed by an enter subscriber is not entered again by its other compound child', () => {
      const trigger = factory.createTrigger(lShape);
      trigger.addToWorld({ physicsWorld: world } as any);
      // on the bar/block seam, touching both children in the same step
      const ball = factory.createRigidBody(
        { shape: { shape: 'SPHERE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: { x: -2.5, y: 0, z: 0 } },
      );
      ball.addToWorld({ physicsWorld: world } as any);
      const events: string[] = [];
      trigger.onEntityEntered.subscribe(obj => {
        if (obj === ball) {
          events.push('enter');
          ball.removeFromWorld({ physicsWorld: world } as any);
        }
      });
      trigger.onEntityLeft.subscribe(obj => obj === ball && events.push('left'));
      advance(30, () => trigger.checkOverlaps());
      expect(events).toEqual(['enter', 'left']);
      expect((trigger.debugBodySettings.type as { activated: () => boolean }).activated()).toBe(false);
    });
  });
  describe('one enter/leave per body', () => {
    const activated = (trigger: { debugBodySettings: { type: unknown } }) =>
      (trigger.debugBodySettings.type as { activated: () => boolean }).activated();

    it('reports one enter and one leave for a COMPOUND body passing through', () => {
      const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
      trigger.addToWorld({ physicsWorld: world } as any);
      // two spheres side by side along x, both inside the trigger at once while it crosses
      const body = factory.createRigidBody(
        {
          shape: {
            shape: 'COMPOUND',
            children: [
              { position: { x: -1, y: 0, z: 0 }, shape: { shape: 'SPHERE', radius: 0.5 } },
              { position: { x: 1, y: 0, z: 0 }, shape: { shape: 'SPHERE', radius: 0.5 } },
            ],
          },
          body: { bodyType: 'dynamic', mass: 1 },
        },
        { position: { x: 0, y: -8, z: 0 } },
      );
      body.addToWorld({ physicsWorld: world } as any);
      const events: string[] = [];
      trigger.onEntityEntered.subscribe(obj => obj === body && events.push('enter'));
      trigger.onEntityLeft.subscribe(obj => obj === body && events.push('left'));
      body.linearVelocity = { x: 0, y: 10, z: 0 };
      advance(1600, () => trigger.checkOverlaps());
      expect(body.position.y).toBeGreaterThan(6);
      expect(events).toEqual(['enter', 'left']);
      expect(activated(trigger)).toBe(false);
    });

    // reparented, or hidden and shown again by a network layer, within one tick: no step runs in
    // between. With `occupyFreedSlot`, another body is added in between and takes the collider slot
    // the ball's removal freed, so the stop Rapier reports for the ball's old collider no longer
    // resolves to the ball
    it.each([false, true])(
      'a body removed and added back before the next step still reports leaving later (slot taken: %s)',
      occupyFreedSlot => {
        const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
        trigger.addToWorld({ physicsWorld: world } as any);
        const ball = factory.createRigidBody(
          { shape: { shape: 'SPHERE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
          { position: { x: 0, y: 0, z: 0 } },
        );
        ball.addToWorld({ physicsWorld: world } as any);
        const events: string[] = [];
        trigger.onEntityEntered.subscribe(obj => obj === ball && events.push('enter'));
        trigger.onEntityLeft.subscribe(obj => obj === ball && events.push('left'));
        advance(30, () => trigger.checkOverlaps());
        expect(events).toEqual(['enter']);
        ball.removeFromWorld({ physicsWorld: world } as any);
        if (occupyFreedSlot) {
          factory
            .createRigidBody(
              { shape: { shape: 'SPHERE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
              { position: { x: 50, y: 0, z: 0 } },
            )
            .addToWorld({ physicsWorld: world } as any);
        }
        ball.addToWorld({ physicsWorld: world } as any);
        expect(events).toEqual(['enter']); // the leave waits for the trigger's own tick
        advance(30, () => trigger.checkOverlaps());
        expect(events).toEqual(['enter', 'left', 'enter']);
        expect(activated(trigger)).toBe(true);
        ball.linearVelocity = { x: 0, y: 10, z: 0 };
        advance(1000, () => trigger.checkOverlaps());
        expect(ball.position.y).toBeGreaterThan(6);
        expect(events).toEqual(['enter', 'left', 'enter', 'left']);
        expect(activated(trigger)).toBe(false);
      },
    );
  });

  it('warns that a MESH trigger is a surface, and does not fire for a body fully inside it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // a closed 10 m cube made of triangles, and a ball fully inside it, touching no triangle
    const v: { x: number; y: number; z: number }[] = [];
    for (const x of [-5, 5]) for (const y of [-5, 5]) for (const z of [-5, 5]) v.push({ x, y, z });
    const faces: [number, number, number][] = [
      [0, 1, 3],
      [0, 3, 2],
      [4, 6, 7],
      [4, 7, 5],
      [0, 4, 5],
      [0, 5, 1],
      [2, 3, 7],
      [2, 7, 6],
      [0, 2, 6],
      [0, 6, 4],
      [1, 5, 7],
      [1, 7, 3],
    ];
    const trigger = factory.createTrigger({ shape: 'MESH', vertices: v, faces });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('MESH'));
    warn.mockRestore();
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody(
      { shape: { shape: 'SPHERE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 1, y: 1, z: 1 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    let fired = false;
    trigger.onEntityEntered.subscribe(obj => (fired = fired || obj === ball));
    advance(30, () => trigger.checkOverlaps());
    expect(fired).toBe(false);
  });
});
