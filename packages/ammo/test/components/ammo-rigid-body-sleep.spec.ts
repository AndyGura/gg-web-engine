import { Pnt3 } from '@gg-web-engine/core';
import { AmmoFactory, AmmoWorldComponent } from '../../src';

describe('AmmoRigidBodyComponent sleep API', () => {
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

  it('reports a fresh dynamic body as not sleeping', () => {
    const box = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    box.addToWorld({ physicsWorld: world } as any);

    expect(box.isSleeping).toBe(false);
  });

  it('sleep() forces isSleeping true, wakeUp() flips it back', () => {
    const box = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    box.addToWorld({ physicsWorld: world } as any);

    box.sleep();
    expect(box.isSleeping).toBe(true);

    box.wakeUp();
    expect(box.isSleeping).toBe(false);
  });

  it('a position write on a sleeping body wakes it back up', () => {
    const box = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    box.addToWorld({ physicsWorld: world } as any);

    box.sleep();
    expect(box.isSleeping).toBe(true);

    box.position = { x: 1, y: 2, z: 3 };
    expect(box.isSleeping).toBe(false);
  });

  it('a static body always reports not sleeping, and sleep()/wakeUp() are no-ops', () => {
    const floor = factory.createRigidBody(
      { shape: { shape: 'PLANE' }, body: { bodyType: 'static' } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    expect(floor.isSleeping).toBe(false);

    floor.sleep();
    expect(floor.isSleeping).toBe(false);

    floor.wakeUp();
    expect(floor.isSleeping).toBe(false);
  });

  describe('canSleep', () => {
    const restFor = (seconds: number) => {
      for (let i = 0; i < seconds * 60; i++) {
        world.simulate(1000 / 60);
      }
    };

    it('lets a resting dynamic body fall asleep by default', () => {
      const body = factory.createRigidBody({ shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } }, { position: { x: 0, y: 0, z: 0 } });
      body.addToWorld({ physicsWorld: world } as any);

      restFor(5);
      expect(body.bodyOptions.canSleep).toBe(true);
      expect(body.isSleeping).toBe(true);
    });

    it('keeps a canSleep: false body awake while resting, and sleep() is a no-op on it', () => {
      const body = factory.createRigidBody({ shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1, canSleep: false } }, { position: { x: 0, y: 0, z: 0 } });
      body.addToWorld({ physicsWorld: world } as any);

      restFor(5);
      expect(body.isSleeping).toBe(false);

      body.sleep();
      expect(body.isSleeping).toBe(false);
      expect(body.bodyOptions.canSleep).toBe(false);
      expect(body.clone().bodyOptions.canSleep).toBe(false);
    });
  });
});
