import { Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';
import { Rapier3dRigidBodyComponent } from '../../src/components/rapier-3d-rigid-body.component';

describe('Rapier3dRigidBodyComponent collision events', () => {
  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier3dWorldComponent();
    factory = new Rapier3dFactory(world);
    await world.init();
  });

  afterAll(() => {
    world.dispose();
  });

  // Small steps, mirroring Rapier3dTriggerComponent's own spec: a single huge `simulate()` call
  // detects a contact a whole step late (narrow-phase runs against start-of-step positions), which
  // would make a "did it fire at all" assertion flaky. `world.simulate()` now dispatches collision
  // events internally (see `Rapier3dWorldComponent.dispatchCollisionEvents`), so no extra per-step
  // hook is needed here the way `Rapier3dTriggerComponent.checkOverlaps()` needs calling for triggers.
  const advance = (totalMs: number, stepMs = 16) => {
    for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
      world.simulate(stepMs);
    }
  };

  const createFloor = () => {
    const floor = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 20, y: 20, z: 1 } }, body: { bodyType: 'static' } },
      { position: { x: 0, y: 0, z: -0.5 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);
    return floor;
  };

  const createBall = (z: number) => {
    // restitution 0 so the ball settles without bouncing, keeping the "no further onCollisionStart
    // once resting" assertion below unambiguous.
    const ball = factory.createRigidBody(
      { shape: { shape: 'SPHERE', radius: 1 }, body: { bodyType: 'dynamic', mass: 1, restitution: 0 } },
      { position: { x: 0, y: 0, z } },
    );
    ball.addToWorld({ physicsWorld: world } as any);
    return ball;
  };

  it('fires onCollisionStart on the falling body with a resolved otherBody, positive impulse, and a physically sane contact', () => {
    const floor = createFloor();
    const ball = createBall(5);

    const ballEvents: any[] = [];
    ball.onCollisionStart.subscribe(e => ballEvents.push(e));

    advance(2000);

    expect(ballEvents.length).toBeGreaterThanOrEqual(1);
    const event = ballEvents[0];
    expect(event.otherBody).toBe(floor);
    expect(event.impulse).toBeGreaterThan(0);
    // The ball starts above the floor - `normal` points away from the ball (this body) towards the
    // floor (`otherBody`), so it should point roughly straight down.
    expect(event.normal.z).toBeLessThan(-0.9);
    expect(Math.abs(event.normal.x)).toBeLessThan(0.2);
    expect(Math.abs(event.normal.y)).toBeLessThan(0.2);
    // contact point should sit right around the floor's top surface (z = 0), not somewhere wild.
    expect(event.position.z).toBeGreaterThan(-1);
    expect(event.position.z).toBeLessThan(1);
  });

  it('fires the reciprocal onCollisionStart on the other body too, with a consistently-oriented normal/relativeVelocity', () => {
    const floor = createFloor();
    const ball = createBall(5);

    const ballEvents: any[] = [];
    const floorEvents: any[] = [];
    ball.onCollisionStart.subscribe(e => ballEvents.push(e));
    floor.onCollisionStart.subscribe(e => floorEvents.push(e));

    advance(2000);

    expect(ballEvents.length).toBeGreaterThanOrEqual(1);
    expect(floorEvents.length).toBeGreaterThanOrEqual(1);
    const ballEvent = ballEvents[0];
    const floorEvent = floorEvents[0];

    expect(floorEvent.otherBody).toBe(ball);
    expect(ballEvent.otherBody).toBe(floor);

    // floor's normal points away from the floor towards the ball above it (up); the ball's points
    // away from the ball towards the floor below it (down) - opposite directions.
    expect(floorEvent.normal.z).toBeGreaterThan(0.9);
    expect(ballEvent.normal.z).toBeLessThan(-0.9);

    // relativeVelocity is "otherBody's velocity relative to this body", read from each body's own
    // `linvel()` *after* this step's solve already ran (see `Rapier3dWorldComponent.
    // dispatchCollisionEvents`'s doc) - not the pre-response approach velocity the ball actually hit
    // at, since Rapier's constraint solver has already resolved the contact (and, with the default
    // Baumgarte-style bias, can leave a small outward/separating residual velocity behind) by the
    // time `drainCollisionEvents` reports it as `started`. What must still hold regardless: the two
    // reciprocal readings are exact negations of each other (floor is stationary throughout, so this
    // is really just `-ball.linvel().z` vs `ball.linvel().z`).
    expect(floorEvent.relativeVelocity.z).toBeCloseTo(-ballEvent.relativeVelocity.z, 5);

    expect(floorEvent.impulse).toBeCloseTo(ballEvent.impulse, 5);
  });

  it('does not keep re-firing onCollisionStart for a body resting stably on another', () => {
    const floor = createFloor();
    const ball = createBall(3);
    void floor;

    let startCount = 0;
    ball.onCollisionStart.subscribe(() => startCount++);

    advance(1500); // fall and land
    const countAfterLanding = startCount;
    expect(countAfterLanding).toBeGreaterThanOrEqual(1);

    advance(1500); // keep resting, several hundred more simulate() calls
    expect(startCount).toBe(countAfterLanding);
  });

  it('fires onCollisionEnd when a body is knocked away and separates from what it was touching', () => {
    const floor = createFloor();
    const ball = createBall(3);

    let endedWith: Rapier3dRigidBodyComponent | null | undefined;
    let endCount = 0;
    ball.onCollisionEnd.subscribe(other => {
      endCount++;
      endedWith = other;
    });

    advance(1500); // let it land and settle
    expect(endCount).toBe(0);

    // zero gravity so the teleported ball doesn't immediately fall back down and re-collide within
    // this test's own observation window
    world.gravity = Pnt3.O;
    ball.position = { x: 0, y: 0, z: 20 };
    advance(500);

    expect(endCount).toBeGreaterThanOrEqual(1);
    expect(endedWith).toBe(floor);
  });

  it("does not fire a rigid body's onCollisionStart for a trigger overlap (triggers stay sensor-only)", () => {
    world.gravity = Pnt3.O;
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);

    const ball = createBall(0); // spawned already overlapping the trigger volume

    let ballCollisionStarts = 0;
    ball.onCollisionStart.subscribe(() => ballCollisionStarts++);
    let triggerEnters = 0;
    trigger.onEntityEntered.subscribe(() => triggerEnters++);

    advance(500);
    trigger.checkOverlaps();

    expect(triggerEnters).toBeGreaterThanOrEqual(1);
    expect(ballCollisionStarts).toBe(0);
  });

  it('completes onCollisionStart/onCollisionEnd on dispose, matching matter/ammo', () => {
    const ball = createBall(0);

    let startCompleted = false;
    let endCompleted = false;
    ball.onCollisionStart.subscribe({ complete: () => (startCompleted = true) });
    ball.onCollisionEnd.subscribe({ complete: () => (endCompleted = true) });

    ball.dispose();

    expect(startCompleted).toBe(true);
    expect(endCompleted).toBe(true);
  });
});
