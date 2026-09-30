import { Pnt2 } from '@gg-web-engine/core';
import { MatterFactory, MatterWorldComponent } from '../../src';

describe('MatterRigidBodyComponent sleep API', () => {
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

  it('reports a fresh dynamic body as not sleeping', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    expect(body.isSleeping).toBe(false);
  });

  it('sleep() forces isSleeping true, wakeUp() flips it back - regardless of the world engine\'s enableSleeping setting', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    body.sleep();
    expect(body.isSleeping).toBe(true);

    body.wakeUp();
    expect(body.isSleeping).toBe(false);
  });

  it('a position write on a sleeping body does NOT wake it back up - unlike every other adapter', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    body.sleep();
    expect(body.isSleeping).toBe(true);

    body.position = { x: 1, y: 2 };
    expect(body.isSleeping).toBe(true);
    // the write itself is not silently dropped - a caller that must write state on a sleeping
    // body without waking it (the whole point of this adapter's setters preserving sleep state)
    // still sees the new position take effect.
    expect(body.position).toEqual({ x: 1, y: 2 });
  });

  it('a static body always reports not sleeping, and sleep()/wakeUp() are no-ops', () => {
    const floor = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 10, y: 1 } }, body: { bodyType: 'static' } },
      { position: { x: 0, y: 0 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    expect(floor.isSleeping).toBe(false);

    floor.sleep();
    expect(floor.isSleeping).toBe(false);

    floor.wakeUp();
    expect(floor.isSleeping).toBe(false);
  });
});
