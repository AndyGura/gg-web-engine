import { Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

describe('Rapier3dRigidBodyComponent clone', () => {
  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;

  beforeEach(async () => {
    world = new Rapier3dWorldComponent();
    factory = new Rapier3dFactory(world);
    await world.init();
  });

  afterEach(() => {
    world.dispose();
  });

  const box = { shape: 'BOX' as const, dimensions: { x: 1, y: 1, z: 1 } };

  const createCompound = () =>
    factory.createRigidBody(
      {
        shape: { shape: 'COMPOUND', children: [{ shape: box }, { shape: box, position: { x: 0, y: 0, z: 2 } }] },
        body: { bodyType: 'dynamic', mass: 2, restitution: 0 },
      },
      { position: { x: 0, y: 0, z: 5 } },
    );

  it('keeps the mass and centre of mass of a compound body', () => {
    const original = createCompound();
    const copy = original.clone();
    original.addToWorld({ physicsWorld: world } as any);
    copy.addToWorld({ physicsWorld: world } as any);
    expect(copy.nativeBody!.mass()).toBeCloseTo(original.nativeBody!.mass(), 5);
    expect(Pnt3.len(copy.nativeBody!.localCom())).toBeLessThan(1e-5);
    expect(copy.bodyOptions.mass).toBeCloseTo(2, 5);
  });

  it('reports collisions between two clones', () => {
    // Rapier reports a contact when either collider asks for events, so both bodies are clones here
    const floor = factory
      .createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 20, y: 20, z: 1 } }, body: { bodyType: 'static' } },
        { position: { x: 0, y: 0, z: -0.5 } },
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
});
