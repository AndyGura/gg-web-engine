import { Pnt3 } from '@gg-web-engine/core';
import { AmmoFactory, AmmoWorldComponent } from '../../src';

describe(`AmmoTriggerComponent`, () => {

  let world: AmmoWorldComponent;
  let factory: AmmoFactory;
  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new AmmoWorldComponent();
    factory = new AmmoFactory(world);
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
      body: { bodyType: 'dynamic', mass: 1 },
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
      body: { bodyType: 'dynamic', mass: 1 },
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
      body: { bodyType: 'dynamic', mass: 1 },
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
      body: { bodyType: 'dynamic', mass: 1 },
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
      body: { bodyType: 'dynamic', mass: 1 },
    }, { position: { x: 0, y: 0, z: 0 } });
    ball.addToWorld({ physicsWorld: world } as any);
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === ball;
    }));
    world.simulate(1);
    trigger.checkOverlaps();
    ball.removeFromWorld({ physicsWorld: world } as any);
    // the proactive world.removed$ reaction (see AmmoTriggerComponent's own doc) already drops the
    // removed body from `overlaps` synchronously, so a later checkOverlaps() poll has nothing left
    // to notice - onEntityLeft only fires via the deferred microtask that reaction schedules.
    await Promise.resolve();
    world.simulate(1);
    trigger.checkOverlaps();
    expect(exitRegistered).toBe(true);
  });

  it(`should fire end of object intersection on the next microtask when the object is removed, with no checkOverlaps() poll`, async () => {
    // regression test: without proactively reacting to world.removed$, a body removed elsewhere
    // while still overlapping stays in this trigger's own `overlaps` set until some later
    // checkOverlaps() call happens to notice it dropped out of the ghost object's live overlap
    // list - by which point its native handle may already be disposed. This asserts the fix drops
    // it from `overlaps` and fires onEntityLeft without any checkOverlaps() call at all - on the
    // next microtask specifically, not synchronously (see the fix's own doc for why: reacting
    // synchronously, from inside whatever arbitrary call stack triggered the removal, is what
    // caused a real, reproduced Ammo/WASM heap abort when app code driven by onEntityLeft wrote
    // back into an entity whose own component swap was still in progress on that same stack).
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody({
      shape: { shape: 'SPHERE', radius: 1 },
      body: { bodyType: 'dynamic', mass: 1 },
    }, { position: { x: 0, y: 0, z: 0 } });
    ball.addToWorld({ physicsWorld: world } as any);
    world.simulate(1);
    trigger.checkOverlaps();
    let exitRegistered = false;
    trigger.onEntityLeft.subscribe(((obj) => {
      exitRegistered = obj === ball;
    }));
    ball.removeFromWorld({ physicsWorld: world } as any);
    expect(exitRegistered).toBe(false); // not yet - deferred to a microtask
    await Promise.resolve();
    expect(exitRegistered).toBe(true);
  });
  it('reports the body itself when it is removed and disposed while inside', async () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);
    const ball = factory.createRigidBody({
      shape: { shape: 'SPHERE', radius: 1 },
      body: { bodyType: 'dynamic', mass: 1 },
    }, { position: { x: 0, y: 0, z: 0 } });
    ball.addToWorld({ physicsWorld: world } as any);
    world.simulate(1);
    trigger.checkOverlaps();
    const left: any[] = [];
    trigger.onEntityLeft.subscribe(obj => left.push(obj));
    ball.removeFromWorld({ physicsWorld: world } as any);
    ball.dispose();
    await Promise.resolve();
    expect(left).toEqual([ball]);
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
      shape: Parameters<AmmoFactory['createTrigger']>[0],
      rotation: { x: number; y: number; z: number; w: number } | undefined,
      ballPosition: { x: number; y: number; z: number },
      bodyType: 'dynamic' | 'static' = 'dynamic',
    ): boolean => {
      const trigger = factory.createTrigger(shape, { rotation });
      trigger.addToWorld({ physicsWorld: world } as any);
      const ball = factory.createRigidBody(
        { shape: { shape: 'SPHERE', radius: 0.5 }, body: { bodyType, mass: bodyType === 'dynamic' ? 1 : 0 } },
        { position: ballPosition },
      );
      ball.addToWorld({ physicsWorld: world } as any);
      let fired = false;
      trigger.onEntityEntered.subscribe(obj => (fired = fired || obj === ball));
      world.simulate(16);
      trigger.checkOverlaps();
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

    it('is exact against a static body too', () => {
      expect(entered(lShape, undefined, { x: 2.5, y: 2.5, z: 0 }, 'static')).toBe(false);
      expect(entered(lShape, undefined, { x: -2.5, y: 2.5, z: 0 }, 'static')).toBe(true);
    });

    it('fires onEntityLeft once a body moves from the shape into the empty part of its AABB', () => {
      const trigger = factory.createTrigger(lShape);
      trigger.addToWorld({ physicsWorld: world } as any);
      const ball = factory.createRigidBody(
        { shape: { shape: 'SPHERE', radius: 0.5 }, body: { bodyType: 'dynamic', mass: 1 } },
        { position: { x: 2.5, y: -2.5, z: 0 } },
      );
      ball.addToWorld({ physicsWorld: world } as any);
      const events: string[] = [];
      trigger.onEntityEntered.subscribe(obj => obj === ball && events.push('enter'));
      trigger.onEntityLeft.subscribe(obj => obj === ball && events.push('left'));
      world.simulate(16);
      trigger.checkOverlaps();
      ball.position = { x: 2.5, y: 2.5, z: 0 };
      world.simulate(16);
      trigger.checkOverlaps();
      expect(events).toEqual(['enter', 'left']);
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
      world.simulate(10);
      trigger.checkOverlaps();
      ball.linearVelocity = { x: 0, y: 10, z: 0 };
      for (let i = 0; i < 100; i++) {
        world.simulate(10);
        trigger.checkOverlaps();
      }
      expect(ball.position.y).toBeGreaterThan(6);
      expect(events).toEqual(['enter', 'left']);
    });
  });
  it('warns that a MESH trigger is a surface, and does not fire for a body fully inside it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // a closed 10 m cube made of triangles, and a ball fully inside it, touching no triangle
    const v: { x: number; y: number; z: number }[] = [];
    for (const x of [-5, 5]) for (const y of [-5, 5]) for (const z of [-5, 5]) v.push({ x, y, z });
    const faces: [number, number, number][] = [
      [0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1],
      [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3],
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
    world.simulate(16);
    trigger.checkOverlaps();
    expect(fired).toBe(false);
  });
});
