import { CollisionEvent, Pnt2, Point2 } from '@gg-web-engine/core';
import { Rapier2dFactory, Rapier2dRigidBodyComponent, Rapier2dWorldComponent } from '../../src';
import { ActiveEvents, ColliderDesc } from '@dimforge/rapier2d-compat';

describe('Rapier2dRigidBodyComponent onCollisionStart/onCollisionEnd', () => {
  let world: Rapier2dWorldComponent;
  let factory: Rapier2dFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier2dWorldComponent();
    factory = new Rapier2dFactory(world);
    await world.init();
    world.gravity = { x: 0, y: -9.82 };
  });

  afterAll(() => {
    world.dispose();
  });

  function settle(steps: number, dtMs = 16): void {
    for (let i = 0; i < steps; i++) {
      world.simulate(dtMs);
    }
  }

  function makeFloorAndBall(): { floor: Rapier2dRigidBodyComponent; ball: Rapier2dRigidBodyComponent } {
    const floor = factory.createRigidBody(
      { shape: { shape: 'SQUARE', dimensions: { x: 20, y: 2 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: -1 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'dynamic', mass: 2 } },
      { position: { x: 0, y: 5 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);

    // a freshly-created collider may not be visible to the broad-phase until the world has
    // stepped at least once - settle a zero-length step before relying on it.
    world.simulate(0);
    return { floor, ball };
  }

  it('fires onCollisionStart on the falling body when it lands on a static floor, with a sane contact', () => {
    const { floor, ball } = makeFloorAndBall();

    const ballEvents: CollisionEvent<Point2, Rapier2dRigidBodyComponent>[] = [];
    const floorEvents: CollisionEvent<Point2, Rapier2dRigidBodyComponent>[] = [];
    ball.onCollisionStart.subscribe(e => ballEvents.push(e));
    floor.onCollisionStart.subscribe(e => floorEvents.push(e));

    settle(200);

    expect(ballEvents.length).toBeGreaterThanOrEqual(1);
    expect(floorEvents.length).toBeGreaterThanOrEqual(1);

    const ballEvent = ballEvents[0];
    expect(ballEvent.otherBody).toBe(floor);
    expect(ballEvent.impulse).toBeGreaterThan(0);
    // the ball fell straight down onto a flat floor - the contact normal should be predominantly
    // vertical, not sideways.
    expect(Math.abs(ballEvent.normal.y)).toBeGreaterThan(Math.abs(ballEvent.normal.x));
    // the contact point should sit roughly at the floor's top surface (y ≈ 0), not somewhere wild.
    expect(ballEvent.position.y).toBeGreaterThan(-1);
    expect(ballEvent.position.y).toBeLessThan(1);

    const floorEvent = floorEvents[0];
    expect(floorEvent.otherBody).toBe(ball);
    expect(floorEvent.impulse).toBeGreaterThan(0);
    // reciprocal event: normal must point the opposite way, same contact position.
    expect(floorEvent.normal.x).toBeCloseTo(-ballEvent.normal.x, 5);
    expect(floorEvent.normal.y).toBeCloseTo(-ballEvent.normal.y, 5);
    expect(floorEvent.position.x).toBeCloseTo(ballEvent.position.x, 5);
    expect(floorEvent.position.y).toBeCloseTo(ballEvent.position.y, 5);
    // relativeVelocity is the other body's velocity relative to this one - opposite sign for
    // each side of the same pair.
    expect(floorEvent.relativeVelocity.x).toBeCloseTo(-ballEvent.relativeVelocity.x, 5);
    expect(floorEvent.relativeVelocity.y).toBeCloseTo(-ballEvent.relativeVelocity.y, 5);
  });

  it('does not keep re-firing onCollisionStart once a pair is resting in stable contact', () => {
    const { ball } = makeFloorAndBall();

    const events: CollisionEvent<Point2, Rapier2dRigidBodyComponent>[] = [];
    ball.onCollisionStart.subscribe(e => events.push(e));

    settle(200); // fall and land
    expect(events.length).toBeGreaterThanOrEqual(1);
    const countAfterLanding = events.length;

    settle(150); // keep resting
    expect(events.length).toBe(countAfterLanding);
  });

  it('fires onCollisionEnd reciprocally on both bodies when a resting contact separates', () => {
    const { floor, ball } = makeFloorAndBall();
    settle(200); // let it land and settle first

    const ballEndEvents: (Rapier2dRigidBodyComponent | null)[] = [];
    const floorEndEvents: (Rapier2dRigidBodyComponent | null)[] = [];
    ball.onCollisionEnd.subscribe(e => ballEndEvents.push(e));
    floor.onCollisionEnd.subscribe(e => floorEndEvents.push(e));

    // knock the ball away from the floor
    ball.linearVelocity = { x: 0, y: 20 };
    settle(30);

    expect(ballEndEvents.length).toBeGreaterThanOrEqual(1);
    expect(ballEndEvents[0]).toBe(floor);
    expect(floorEndEvents.length).toBeGreaterThanOrEqual(1);
    expect(floorEndEvents[0]).toBe(ball);
  });

  it(
    'fires onCollisionEnd with null on the surviving body when the other body is removed mid-contact, ' +
      "and not on the removed body's own stream",
    () => {
      const { floor, ball } = makeFloorAndBall();
      settle(200); // let it land and settle first

      const floorEndEvents: (Rapier2dRigidBodyComponent | null)[] = [];
      const ballEndEvents: (Rapier2dRigidBodyComponent | null)[] = [];
      floor.onCollisionEnd.subscribe(e => floorEndEvents.push(e));
      ball.onCollisionEnd.subscribe(e => ballEndEvents.push(e));

      ball.removeFromWorld({ physicsWorld: world } as any);

      expect(floorEndEvents.length).toBe(1);
      expect(floorEndEvents[0]).toBeNull();
      // the body being removed is the one vanishing, not the one experiencing a contact ending -
      // only the surviving partner (floor) should hear about it.
      expect(ballEndEvents.length).toBe(0);
    },
  );

  it('never dispatches a collision event when both colliders resolve to the same body (compound body)', () => {
    // Two colliders on one rigid body - the multi-collider ("compound") shape case. Rapier itself
    // never generates a real broad-phase pair between colliders of the same body, so the guard is
    // exercised directly by forcing `drainCollisionEvents` to report a pair whose two collider
    // handles both belong to this one body, exactly as a spurious/defensive edge case would look.
    const bodyDescr = factory.createRigidBodyDescr({ bodyType: 'dynamic', mass: 1 }, { position: { x: 0, y: 5 } });
    const colliderDescrs = [
      ColliderDesc.cuboid(0.5, 0.5).setActiveEvents(ActiveEvents.COLLISION_EVENTS),
      ColliderDesc.cuboid(0.5, 0.5).setTranslation(0.4, 0).setActiveEvents(ActiveEvents.COLLISION_EVENTS),
    ];
    const compound = new Rapier2dRigidBodyComponent(
      world,
      colliderDescrs,
      { shape: 'SQUARE', dimensions: { x: 1, y: 1 } },
      bodyDescr,
      {
        friction: 0.5,
        restitution: 0.1,
        ownCollisionGroups: [world.mainCollisionGroup],
        interactWithCollisionGroups: [world.mainCollisionGroup],
        ccd: false,
      },
    );
    compound.addToWorld({ physicsWorld: world } as any);
    world.simulate(0);

    const nativeBody = compound.nativeBody!;
    expect(nativeBody.numColliders()).toBe(2);
    const h1 = nativeBody.collider(0).handle;
    const h2 = nativeBody.collider(1).handle;

    const events: CollisionEvent<Point2, Rapier2dRigidBodyComponent>[] = [];
    compound.onCollisionStart.subscribe(e => events.push(e));

    jest.spyOn(world.eventQueue, 'drainCollisionEvents').mockImplementation(f => f(h1, h2, true));

    world.simulate(16);

    expect(events.length).toBe(0);
  });

  it('completes onCollisionStart/onCollisionEnd on dispose, matching matter/ammo', () => {
    const { ball } = makeFloorAndBall();

    let startCompleted = false;
    let endCompleted = false;
    ball.onCollisionStart.subscribe({ complete: () => (startCompleted = true) });
    ball.onCollisionEnd.subscribe({ complete: () => (endCompleted = true) });

    ball.dispose();

    expect(startCompleted).toBe(true);
    expect(endCompleted).toBe(true);
  });

  it('does not fire onCollisionStart on a rigid body for a trigger overlap (sensor, no collision response)', () => {
    const trigger = factory.createTrigger(
      { shape: 'SQUARE', dimensions: { x: 20, y: 20 } },
      { position: { x: 0, y: 0 } },
    );
    trigger.addToWorld({ physicsWorld: world } as any);

    // spawned clear of the trigger's top edge (square half-height 10, centered at y=0) so the
    // overlap genuinely starts *after* subscribing below, not at spawn time.
    const ball = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 15 } },
    );
    ball.addToWorld({ physicsWorld: world } as any);

    // a freshly-created collider may not be visible to the broad-phase until the world has
    // stepped at least once. Safe to do before subscribing: the ball isn't overlapping anything
    // yet at this position, so this can't itself generate the event under test.
    world.simulate(0);

    // no floor in this scene, and zero gravity - the only thing the ball can ever touch is the
    // sensor trigger volume it's about to drift straight through.
    world.gravity = Pnt2.O;
    ball.linearVelocity = { x: 0, y: -2 };

    const ballCollisionEvents: CollisionEvent<Point2, Rapier2dRigidBodyComponent>[] = [];
    let enteredTrigger = false;
    ball.onCollisionStart.subscribe(e => ballCollisionEvents.push(e));
    trigger.onEntityEntered.subscribe(other => {
      if (other === ball) {
        enteredTrigger = true;
      }
    });

    settle(300);

    expect(enteredTrigger).toBe(true);
    expect(ballCollisionEvents.length).toBe(0);
  });
});
