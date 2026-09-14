import { CollisionEvent, Point3 } from '@gg-web-engine/core';
import { AmmoRigidBodyComponent, AmmoWorldComponent } from '../../src';

describe('AmmoRigidBodyComponent collision events', () => {
  let world: AmmoWorldComponent;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new AmmoWorldComponent();
    await world.init();
    world.gravity = { x: 0, y: 0, z: -9.82 };
  });

  afterAll(() => {
    world.dispose();
  });

  function createFloor(): AmmoRigidBodyComponent {
    const floor = world.factory.createRigidBody(
      { shape: { shape: 'PLANE' }, body: { dynamic: false } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);
    return floor;
  }

  function createFallingBox(z: number): AmmoRigidBodyComponent {
    const box = world.factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { dynamic: true, mass: 1 } },
      { position: { x: 0, y: 0, z } },
    );
    box.addToWorld({ physicsWorld: world } as any);
    return box;
  }

  it('should fire onCollisionStart on the falling body when it lands on a static floor', () => {
    const floor = createFloor();
    const box = createFallingBox(5);

    const startEvents: CollisionEvent<Point3, AmmoRigidBodyComponent>[] = [];
    box.onCollisionStart.subscribe(e => startEvents.push(e));

    for (let i = 0; i < 300 && startEvents.length === 0; i++) {
      world.simulate(16);
    }

    expect(startEvents.length).toBeGreaterThan(0);
    const event = startEvents[0];
    expect(event.otherBody).toBe(floor);
    expect(event.impulse).toBeGreaterThan(0);
    // normal should be roughly vertical (box landing on a flat floor)
    expect(Math.abs(event.normal.z)).toBeGreaterThan(0.9);
    expect(Math.abs(event.normal.x)).toBeLessThan(0.2);
    expect(Math.abs(event.normal.y)).toBeLessThan(0.2);
  });

  it('should fire the reciprocal event on the other body with a negated normal', () => {
    const floor = createFloor();
    const box = createFallingBox(5);

    const boxEvents: CollisionEvent<Point3, AmmoRigidBodyComponent>[] = [];
    const floorEvents: CollisionEvent<Point3, AmmoRigidBodyComponent>[] = [];
    box.onCollisionStart.subscribe(e => boxEvents.push(e));
    floor.onCollisionStart.subscribe(e => floorEvents.push(e));

    for (let i = 0; i < 300 && (boxEvents.length === 0 || floorEvents.length === 0); i++) {
      world.simulate(16);
    }

    expect(boxEvents.length).toBeGreaterThan(0);
    expect(floorEvents.length).toBeGreaterThan(0);

    const boxEvent = boxEvents[0];
    const floorEvent = floorEvents[0];
    expect(boxEvent.otherBody).toBe(floor);
    expect(floorEvent.otherBody).toBe(box);

    // normals should point opposite directions (box's away-from-self points down, floor's points up)
    expect(boxEvent.normal.z).toBeLessThan(0);
    expect(floorEvent.normal.z).toBeGreaterThan(0);

    // relativeVelocity should be consistent negations of each other
    expect(boxEvent.relativeVelocity.x).toBeCloseTo(-floorEvent.relativeVelocity.x, 5);
    expect(boxEvent.relativeVelocity.y).toBeCloseTo(-floorEvent.relativeVelocity.y, 5);
    expect(boxEvent.relativeVelocity.z).toBeCloseTo(-floorEvent.relativeVelocity.z, 5);
  });

  it('should not keep re-firing onCollisionStart once a body has settled at rest', () => {
    const floor = createFloor();
    const box = createFallingBox(3);

    const startEvents: CollisionEvent<Point3, AmmoRigidBodyComponent>[] = [];
    box.onCollisionStart.subscribe(e => startEvents.push(e));

    // let it fall, land, and settle
    for (let i = 0; i < 400; i++) {
      world.simulate(16);
    }

    expect(startEvents.length).toBeGreaterThanOrEqual(1);
    const countAfterSettling = startEvents.length;

    // keep simulating well past settling - should not re-fire for the same resting pair
    for (let i = 0; i < 200; i++) {
      world.simulate(16);
    }

    expect(startEvents.length).toBe(countAfterSettling);
  });

  it('should fire onCollisionEnd when a resting body is knocked away and separates', () => {
    const floor = createFloor();
    const box = createFallingBox(3);

    // let it settle onto the floor first
    for (let i = 0; i < 200; i++) {
      world.simulate(16);
    }

    const endEvents: (AmmoRigidBodyComponent | null)[] = [];
    box.onCollisionEnd.subscribe(e => endEvents.push(e));

    // knock the box straight up and away from the floor
    box.linearVelocity = { x: 0, y: 0, z: 20 };

    for (let i = 0; i < 60 && endEvents.length === 0; i++) {
      world.simulate(16);
    }

    expect(endEvents.length).toBeGreaterThan(0);
    expect(endEvents[0]).toBe(floor);
  });

  it('should not fire the rigid body collision events for a trigger overlapping a rigid body', () => {
    const floor = createFloor();
    const trigger = world.factory.createTrigger(
      { shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } },
      { position: { x: 0, y: 0, z: 5 } },
    );
    trigger.addToWorld({ physicsWorld: world } as any);
    const box = createFallingBox(4);

    const boxStartEvents: CollisionEvent<Point3, AmmoRigidBodyComponent>[] = [];
    box.onCollisionStart.subscribe(e => boxStartEvents.push(e));
    let triggerEntered = false;
    trigger.onEntityEntered.subscribe(obj => {
      if (obj === box) {
        triggerEntered = true;
      }
    });

    for (let i = 0; i < 200; i++) {
      world.simulate(16);
      trigger.checkOverlaps();
    }

    expect(triggerEntered).toBe(true);
    // the box eventually lands on the real floor - but every recorded onCollisionStart must be
    // against the floor, never against the trigger (which has no collision response at all).
    expect(boxStartEvents.length).toBeGreaterThan(0);
    for (const event of boxStartEvents) {
      expect(event.otherBody).toBe(floor);
    }
  });

  describe('enableCollisionEvents', () => {
    it('should never fire onCollisionStart/onCollisionEnd while disabled', () => {
      world.enableCollisionEvents = false;
      const floor = createFloor();
      const box = createFallingBox(5);

      const startEvents: CollisionEvent<Point3, AmmoRigidBodyComponent>[] = [];
      const endEvents: (AmmoRigidBodyComponent | null)[] = [];
      box.onCollisionStart.subscribe(e => startEvents.push(e));
      box.onCollisionEnd.subscribe(e => endEvents.push(e));

      for (let i = 0; i < 300; i++) {
        world.simulate(16);
      }
      // sanity: the box still actually physically landed on/near the floor - only event emission
      // is disabled, not collision response/simulation itself.
      expect(box.position.z).toBeGreaterThan(floor.position.z);
      expect(box.position.z).toBeLessThan(1);

      box.linearVelocity = { x: 0, y: 0, z: 5 };
      for (let i = 0; i < 60; i++) {
        world.simulate(16);
      }

      expect(startEvents).toHaveLength(0);
      expect(endEvents).toHaveLength(0);
    });

    it('should resume firing normally once re-enabled', () => {
      world.enableCollisionEvents = false;
      createFloor();
      const box = createFallingBox(5);

      for (let i = 0; i < 150; i++) {
        world.simulate(16);
      }

      world.enableCollisionEvents = true;
      const startEvents: CollisionEvent<Point3, AmmoRigidBodyComponent>[] = [];
      box.onCollisionStart.subscribe(e => startEvents.push(e));

      for (let i = 0; i < 150; i++) {
        world.simulate(16);
      }

      expect(startEvents.length).toBeGreaterThan(0);
    });
  });
});
