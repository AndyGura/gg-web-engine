import { CollisionEvent, Pnt2, Point2 } from '@gg-web-engine/core';
import { MatterFactory, MatterRigidBodyComponent, MatterWorldComponent } from '../../src';
import { Events, IEventCollision, Engine } from 'matter-js';

describe('MatterRigidBodyComponent collision events', () => {
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

  it('should fire onCollisionStart reciprocally, with a sane position/normal, when a falling body lands on a floor', () => {
    // static floor, top edge sits at y = -0.5
    const floor = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 5, y: 1 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 0.1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: -2 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 1 };
    ball.nativeBody.frictionAir = 0;

    const ballEvents: CollisionEvent<Point2, MatterRigidBodyComponent>[] = [];
    const floorEvents: CollisionEvent<Point2, MatterRigidBodyComponent>[] = [];
    ball.onCollisionStart.subscribe(e => ballEvents.push(e));
    floor.onCollisionStart.subscribe(e => floorEvents.push(e));

    for (let i = 0; i < 200 && ballEvents.length === 0; i++) {
      world.simulate(16);
    }

    expect(ballEvents.length).toBeGreaterThan(0);
    expect(floorEvents.length).toBeGreaterThan(0);

    const ballHit = ballEvents[0];
    expect(ballHit.otherBody).toBe(floor);
    expect(ballHit.impulse).toBeGreaterThan(0);
    // ball fell straight down onto a flat floor - normal (pointing away from the ball, towards the
    // floor) should point roughly downward (+y, matter.js's default gravity/screen convention)
    expect(ballHit.normal.y).toBeGreaterThan(0.5);

    const floorHit = floorEvents[0];
    expect(floorHit.otherBody).toBe(ball);
    // reciprocal event: normal seen by the floor should point the opposite way (towards the ball)
    expect(floorHit.normal.y).toBeLessThan(-0.5);
    expect(floorHit.normal.x).toBeCloseTo(-ballHit.normal.x, 5);
    expect(floorHit.normal.y).toBeCloseTo(-ballHit.normal.y, 5);
    // relative velocity is opposite too (otherBody velocity relative to self, on each side)
    expect(floorHit.relativeVelocity.x).toBeCloseTo(-ballHit.relativeVelocity.x, 5);
    expect(floorHit.relativeVelocity.y).toBeCloseTo(-ballHit.relativeVelocity.y, 5);
  });

  it('should not keep re-firing onCollisionStart while a body rests stably on another', () => {
    const floor = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 5, y: 1 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    // A BOX, not a CIRCLE: a circle has no flat resting face, so under this engine's default (no
    // sleeping - see `gg-engine-physics-adapter-matter`'s own note) it keeps finding tiny amounts of
    // torque to roll away on indefinitely instead of ever truly settling, which is exactly the kind
    // of never-stops-touching-and-un-touching motion this test's own premise ("rests stably") needs
    // to rule out by construction. Also left at matter's own default `frictionAir` (not zeroed like
    // the other tests in this file) - some velocity damping is what actually lets a resting body's
    // energy bleed off instead of slowly building up over many hundreds of steps (see this file's own
    // history for how thoroughly this was verified empirically).
    const ball = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 0.2, y: 0.2 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: -2 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 1 };

    world.gravity = { x: 0, y: 0.1 };

    let startCount = 0;
    ball.onCollisionStart.subscribe(() => startCount++);

    // simulate until it lands and settles
    for (let i = 0; i < 200; i++) {
      world.simulate(16);
    }
    expect(startCount).toBeGreaterThan(0);
    const countAfterLanding = startCount;

    // continue simulating - resting contact must not re-fire onCollisionStart
    for (let i = 0; i < 100; i++) {
      world.simulate(16);
    }
    expect(startCount).toBe(countAfterLanding);
  });

  it('should fire onCollisionEnd when a body is knocked away and separates', () => {
    const floor = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 5, y: 1 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    // BOX, not CIRCLE - see the previous test's own doc for why.
    const ball = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 0.2, y: 0.2 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: -2 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 1 };

    let endEvents: (MatterRigidBodyComponent | null)[] = [];
    // Knock it away the instant it actually touches the floor (rather than after some fixed,
    // speed/distance-dependent step count guessed to be "enough time to have touched by now") - the
    // exact number of steps a fall of this distance/speed takes to make real contact isn't this
    // test's concern and shouldn't be baked into a magic constant.
    let knocked = false;
    ball.onCollisionStart.subscribe(() => {
      if (!knocked) {
        knocked = true;
        ball.linearVelocity = { x: 0, y: -1 };
      }
    });
    ball.onCollisionEnd.subscribe(e => endEvents.push(e));

    for (let i = 0; i < 200 && endEvents.length === 0; i++) {
      world.simulate(16);
    }

    expect(endEvents.length).toBeGreaterThan(0);
    expect(endEvents[0]).toBe(floor);
  });

  it('should emit onCollisionEnd(null) on the remaining body when the other body is removed from the world while still touching', () => {
    const floor = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 5, y: 1 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 0.1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: -2 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 1 };
    ball.nativeBody.frictionAir = 0;

    let floorEndEvents: (MatterRigidBodyComponent | null)[] = [];
    floor.onCollisionEnd.subscribe(e => floorEndEvents.push(e));
    let ballStarted = false;
    ball.onCollisionStart.subscribe(() => (ballStarted = true));

    for (let i = 0; i < 200 && !ballStarted; i++) {
      world.simulate(16);
    }
    expect(ballStarted).toBe(true);
    expect(floorEndEvents.length).toBe(0);

    ball.removeFromWorld({ physicsWorld: world } as any);
    expect(floorEndEvents.length).toBe(1);
    expect(floorEndEvents[0]).toBeNull();
  });

  it('should not fire the rigid body onCollisionStart for a trigger overlapping a rigid body', () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 5, y: 1 } }, { position: { x: 0, y: 0 } });
    trigger.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 0.1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: -2 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 1 };
    ball.nativeBody.frictionAir = 0;

    let ballStartEvents = 0;
    let triggerEnterEvents = 0;
    ball.onCollisionStart.subscribe(() => ballStartEvents++);
    trigger.onEntityEntered.subscribe(() => triggerEnterEvents++);

    for (let i = 0; i < 200; i++) {
      world.simulate(16);
    }

    expect(triggerEnterEvents).toBeGreaterThan(0);
    expect(ballStartEvents).toBe(0);
  });
  describe('COMPOUND bodies', () => {
    // a two-box compound landing flat on a floor: matter-js pairs *parts*, so the engine reports
    // one native pair per box (each part's `.parent` is the compound body `handleIdEntityMap` is
    // keyed by), but the component contract is one start and one end per body pair
    const setup = () => {
      const floor = factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 20, y: 1 } }, body: { bodyType: 'static', mass: 0 } },
        { position: { x: 0, y: 0.5 } },
      );
      floor.addToWorld({ physicsWorld: world } as any);
      const body = factory.createRigidBody(
        {
          shape: {
            shape: 'COMPOUND',
            children: [
              { position: { x: -1, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } } },
              { position: { x: 1, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } } },
            ],
          },
          body: { bodyType: 'dynamic', mass: 1, restitution: 0 },
        },
        { position: { x: 0, y: -1 } },
      );
      body.addToWorld({ physicsWorld: world } as any);
      body.linearVelocity = { x: 0, y: 1 };
      return { floor, body };
    };

    it('resolves the reported parts to the parent body and fires onCollisionStart once per body pair', () => {
      const { floor, body } = setup();
      expect(body.nativeBody.parts.length).toBe(3);
      let nativePairs = 0;
      Events.on(world.matterEngine!, 'collisionStart', (e: IEventCollision<Engine>) => {
        nativePairs += e.pairs.filter(
          p => p.bodyA.parent === body.nativeBody || p.bodyB.parent === body.nativeBody,
        ).length;
      });
      const bodyStarts: MatterRigidBodyComponent[] = [];
      const floorStarts: MatterRigidBodyComponent[] = [];
      body.onCollisionStart.subscribe(e => bodyStarts.push(e.otherBody));
      floor.onCollisionStart.subscribe(e => floorStarts.push(e.otherBody));
      for (let i = 0; i < 120 && bodyStarts.length === 0; i++) {
        world.simulate(16);
      }
      // a couple more steps so the second part's pair (if it started a step later) is in too
      for (let i = 0; i < 10; i++) {
        world.simulate(16);
      }
      expect(nativePairs).toBeGreaterThanOrEqual(2);
      expect(bodyStarts).toEqual([floor]);
      expect(floorStarts).toEqual([body]);
    });

    it('fires onCollisionEnd only once the last touching part pair lets go, and null once on removal', () => {
      const { floor, body } = setup();
      const bodyEnds: (MatterRigidBodyComponent | null)[] = [];
      const floorEnds: (MatterRigidBodyComponent | null)[] = [];
      body.onCollisionEnd.subscribe(e => bodyEnds.push(e));
      floor.onCollisionEnd.subscribe(e => floorEnds.push(e));
      let started = false;
      body.onCollisionStart.subscribe(() => (started = true));
      for (let i = 0; i < 120 && !started; i++) {
        world.simulate(16);
      }
      for (let i = 0; i < 10; i++) {
        world.simulate(16);
      }
      expect(started).toBe(true);
      // resting on the floor, matter-js may already have ended one part's pair (the body settles
      // with a slight tilt) - with the other part still touching, nothing was emitted for it
      const touching = body['collidingWith'].get(floor)!;
      expect(touching).toBeGreaterThanOrEqual(1);
      expect(bodyEnds).toEqual([]);
      expect(floorEnds).toEqual([]);
      // the listener only queues; `simulate()` delivers after the step - flushed by hand here
      const flush = () => world['pendingCollisionEvents'].splice(0).forEach((notify: () => void) => notify());
      const partEnd = (part: number) => {
        world['handleCollisionEnd']({
          pairs: [{ isSensor: false, bodyA: body.nativeBody.parts[part], bodyB: floor.nativeBody }],
        } as any);
        flush();
      };
      // every part but the last letting go: nothing may be emitted while one still touches
      for (let i = 1; i < touching; i++) {
        partEnd(i);
      }
      expect(bodyEnds).toEqual([]);
      expect(floorEnds).toEqual([]);
      // the last part lets go too: the body pair has ended
      partEnd(touching);
      expect(bodyEnds).toEqual([floor]);
      expect(floorEnds).toEqual([body]);
      // a stray end for a pair with no start is ignored
      world['handleCollisionEnd']({
        pairs: [{ isSensor: false, bodyA: body.nativeBody.parts[2], bodyB: floor.nativeBody }],
      } as any);
      flush();
      expect(bodyEnds.length).toBe(1);
      expect(floorEnds.length).toBe(1);
    });

    it('emits onCollisionEnd(null) once on the partner when a compound body touching it on two parts is removed', () => {
      const { floor, body } = setup();
      const floorEnds: (MatterRigidBodyComponent | null)[] = [];
      floor.onCollisionEnd.subscribe(e => floorEnds.push(e));
      let started = false;
      body.onCollisionStart.subscribe(() => (started = true));
      for (let i = 0; i < 120 && !started; i++) {
        world.simulate(16);
      }
      for (let i = 0; i < 10; i++) {
        world.simulate(16);
      }
      expect(started).toBe(true);
      body.removeFromWorld({ physicsWorld: world } as any);
      expect(floorEnds).toEqual([null]);
    });
  });

  it('delivers collision events after the step, so a subscriber may remove the other body', () => {
    const ggWorld = { physicsWorld: world } as any;
    const floor = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 5, y: 1 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld(ggWorld);
    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 0.1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: -2 } },
    );
    ball.addToWorld(ggWorld);
    ball.linearVelocity = { x: 0, y: 1 };

    let ballStarts = 0;
    const floorStarts: MatterRigidBodyComponent[] = [];
    const floorEnds: (MatterRigidBodyComponent | null)[] = [];
    // a pickup: the floor removes whatever lands on it, from inside the event
    floor.onCollisionStart.subscribe(e => {
      floorStarts.push(e.otherBody);
      e.otherBody.removeFromWorld(ggWorld);
    });
    floor.onCollisionEnd.subscribe(other => floorEnds.push(other));
    ball.onCollisionStart.subscribe(() => ballStarts++);

    for (let i = 0; i < 200 && floorStarts.length === 0; i++) {
      world.simulate(16);
    }
    expect(floorStarts).toEqual([ball]);
    // the ball's own start was pending too and is dropped: it left the world before it ran
    expect(ballStarts).toBe(0);
    // the partner heard the contact end through `removeFromWorld`, exactly once, with `null`
    expect(floorEnds).toEqual([null]);
    expect(world.handleIdEntityMap.has(ball.nativeBody.id)).toBe(false);
    for (let i = 0; i < 10; i++) {
      world.simulate(16);
    }
    expect(floorStarts.length).toBe(1);
    expect(floorEnds.length).toBe(1);
  });
});
