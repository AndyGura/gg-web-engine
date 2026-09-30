import { Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

describe('Rapier3dRigidBodyComponent sleep API', () => {
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

  it('reports a fresh dynamic body as not sleeping', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'SPHERE', radius: 1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    expect(body.isSleeping).toBe(false);
  });

  it('sleep() forces isSleeping true, wakeUp() flips it back', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'SPHERE', radius: 1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    body.sleep();
    expect(body.isSleeping).toBe(true);

    body.wakeUp();
    expect(body.isSleeping).toBe(false);
  });

  it('a position write on a sleeping body wakes it back up', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'SPHERE', radius: 1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    body.sleep();
    expect(body.isSleeping).toBe(true);

    body.position = { x: 1, y: 2, z: 3 };
    expect(body.isSleeping).toBe(false);
  });

  it('a static body always reports not sleeping, and sleep()/wakeUp() are no-ops', () => {
    const floor = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 10, y: 10, z: 1 } }, body: { bodyType: 'static' } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    expect(floor.isSleeping).toBe(false);

    floor.sleep();
    expect(floor.isSleeping).toBe(false);

    floor.wakeUp();
    expect(floor.isSleeping).toBe(false);
  });
});
