import { Rapier2dFactory, Rapier2dWorldComponent } from '../../src';

describe('Rapier2dRigidBodyComponent clone', () => {
  let world: Rapier2dWorldComponent;
  let factory: Rapier2dFactory;

  beforeEach(async () => {
    world = new Rapier2dWorldComponent();
    factory = new Rapier2dFactory(world);
    await world.init();
  });

  afterEach(() => {
    world.dispose();
  });

  const box = { shape: 'BOX' as const, dimensions: { x: 1, y: 1 } };

  const createCompound = () =>
    factory.createRigidBody(
      {
        shape: { shape: 'COMPOUND', children: [{ shape: box }, { shape: box, position: { x: 0, y: -2 } }] },
        body: { bodyType: 'dynamic', mass: 2, restitution: 0 },
      },
      { position: { x: 0, y: -5 } },
    );

  it('keeps the mass of a compound body', () => {
    const original = createCompound();
    const copy = original.clone();
    original.addToWorld({ physicsWorld: world } as any);
    copy.addToWorld({ physicsWorld: world } as any);
    expect(copy.nativeBody!.mass()).toBeCloseTo(original.nativeBody!.mass(), 5);
    expect(copy.bodyOptions.mass).toBeCloseTo(2, 5);
  });

  it('keeps ccd, canSleep, friction and restitution', () => {
    const original = factory.createRigidBody(
      {
        shape: box,
        body: { bodyType: 'dynamic', mass: 1, ccd: true, canSleep: false, friction: 0.9, restitution: 0.4 },
      },
      { position: { x: 0, y: 0 } },
    );
    const copy = original.clone();
    expect(copy.bodyOptions).toEqual(original.bodyOptions);
    copy.addToWorld({ physicsWorld: world } as any);
    expect(copy.nativeBody!.isCcdEnabled()).toBe(true);
  });

  it('carries the collision groups over', () => {
    const original = factory.createRigidBody({ shape: box, body: { bodyType: 'dynamic', mass: 1 } });
    original.ownCollisionGroups = [3];
    original.interactWithCollisionGroups = [5, 6];
    const copy = original.clone();
    expect(copy.ownCollisionGroups).toEqual([3]);
    expect(copy.interactWithCollisionGroups).toEqual([5, 6]);
    original.addToWorld({ physicsWorld: world } as any);
    copy.addToWorld({ physicsWorld: world } as any);
    expect(copy.nativeBody!.collider(0).collisionGroups()).toBe(original.nativeBody!.collider(0).collisionGroups());
  });

  it('reports collisions between two clones', () => {
    // Rapier reports a contact when either collider asks for events, so both bodies are clones here
    const floor = factory
      .createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 20, y: 1 } }, body: { bodyType: 'static' } },
        { position: { x: 0, y: 0.5 } },
      )
      .clone();
    floor.addToWorld({ physicsWorld: world } as any);
    const copy = createCompound().clone();
    copy.addToWorld({ physicsWorld: world } as any);
    let collided = false;
    copy.onCollisionStart.subscribe(e => (collided = collided || e.otherBody === floor));
    for (let t = 0; t < 3000 && !collided; t += 16) {
      world.simulate(16);
    }
    expect(collided).toBe(true);
  });

  it('keeps its own pose when the original is removed from the world and added again', () => {
    // `removeFromWorld` writes the live pose into the stored descriptor; a clone sharing that
    // descriptor would be dragged along with it (and vice versa)
    const ggWorld = { physicsWorld: world } as any;
    world.gravity = { x: 0, y: 0 };
    const original = factory.createRigidBody({ shape: box, body: { bodyType: 'dynamic', mass: 1 } });
    original.addToWorld(ggWorld);
    const copy = original.clone();
    copy.addToWorld(ggWorld);
    original.position = { x: 5, y: -3 };
    original.rotation = 0.7;
    copy.position = { x: -2, y: 4 };
    world.simulate(16);
    original.removeFromWorld(ggWorld);
    original.addToWorld(ggWorld);
    copy.removeFromWorld(ggWorld);
    copy.addToWorld(ggWorld);
    expect(original.position.x).toBeCloseTo(5, 3);
    expect(original.position.y).toBeCloseTo(-3, 3);
    expect(original.rotation).toBeCloseTo(0.7, 5);
    expect(copy.position.x).toBeCloseTo(-2, 3);
    expect(copy.position.y).toBeCloseTo(4, 3);
    expect(copy.rotation).toBeCloseTo(0, 5);
  });

  it('copies the live pose and velocity of an original that is in the world', () => {
    const ggWorld = { physicsWorld: world } as any;
    world.gravity = { x: 0, y: 0 };
    const original = factory.createRigidBody({ shape: box, body: { bodyType: 'dynamic', mass: 1 } });
    original.addToWorld(ggWorld);
    original.position = { x: 5, y: -3 };
    original.rotation = 0.7;
    original.linearVelocity = { x: 3, y: 0 };
    original.angularVelocity = 2;
    const copy = original.clone();
    copy.addToWorld(ggWorld);
    expect(copy.position.x).toBeCloseTo(5, 5);
    expect(copy.position.y).toBeCloseTo(-3, 5);
    expect(copy.rotation).toBeCloseTo(0.7, 5);
    expect(copy.linearVelocity.x).toBeCloseTo(3, 5);
    expect(copy.angularVelocity).toBeCloseTo(2, 5);
  });
});
