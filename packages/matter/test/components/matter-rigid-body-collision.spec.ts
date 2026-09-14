import { CollisionEvent, Pnt2, Point2 } from '@gg-web-engine/core';
import { MatterFactory, MatterRigidBodyComponent, MatterWorldComponent } from '../../src';

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
    // static floor, top edge sits at y = -5
    const floor = factory.createRigidBody(
      { shape: { shape: 'SQUARE', dimensions: { x: 50, y: 10 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { dynamic: true, mass: 1 } },
      { position: { x: 0, y: -20 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 10 };
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
      { shape: { shape: 'SQUARE', dimensions: { x: 50, y: 10 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { dynamic: true, mass: 1 } },
      { position: { x: 0, y: -20 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 10 };
    ball.nativeBody.frictionAir = 0;

    world.gravity = { x: 0, y: 1 };

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
      { shape: { shape: 'SQUARE', dimensions: { x: 50, y: 10 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { dynamic: true, mass: 1 } },
      { position: { x: 0, y: -20 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 10 };
    ball.nativeBody.frictionAir = 0;

    let endEvents: (MatterRigidBodyComponent | null)[] = [];
    ball.onCollisionEnd.subscribe(e => endEvents.push(e));

    for (let i = 0; i < 200 && endEvents.length === 0; i++) {
      world.simulate(16);
      if (i === 50) {
        // knock it straight back up, away from the floor, once it's had a chance to touch
        ball.linearVelocity = { x: 0, y: -10 };
      }
    }

    expect(endEvents.length).toBeGreaterThan(0);
    expect(endEvents[0]).toBe(floor);
  });

  it('should emit onCollisionEnd(null) on the remaining body when the other body is removed from the world while still touching', () => {
    const floor = factory.createRigidBody(
      { shape: { shape: 'SQUARE', dimensions: { x: 50, y: 10 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { dynamic: true, mass: 1 } },
      { position: { x: 0, y: -20 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 10 };
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
    const trigger = factory.createTrigger({ shape: 'SQUARE', dimensions: { x: 50, y: 10 } }, { position: { x: 0, y: 0 } });
    trigger.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { dynamic: true, mass: 1 } },
      { position: { x: 0, y: -20 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    ball.linearVelocity = { x: 0, y: 10 };
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
});
