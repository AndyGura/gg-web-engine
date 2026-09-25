import { Pnt2 } from '@gg-web-engine/core';
import { MatterFactory, MatterWorldComponent } from '../../src';

describe('MatterRigidBodyComponent.bodyOptions', () => {
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

  it('reads back the mass/friction/restitution a dynamic body was actually created with', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'dynamic', mass: 5, friction: 0.3, restitution: 0.7 } },
      { position: { x: 0, y: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    expect(body.bodyOptions.bodyType).toBe('dynamic');
    expect(body.bodyOptions.mass).toBe(5);
    expect(body.bodyOptions.friction).toBe(0.3);
    expect(body.bodyOptions.restitution).toBe(0.7);
    expect(body.bodyOptions.ccd).toBe(false);
  });

  it('echoes the originally-requested bodyType/ccd even though matter-js degrades both', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'SQUARE', dimensions: { x: 1, y: 1 } }, body: { bodyType: 'kinematic_pos', mass: 1, ccd: true } },
      { position: { x: 0, y: 0 } },
    );

    expect(body.bodyOptions.bodyType).toBe('kinematic_pos');
    expect(body.bodyOptions.ccd).toBe(true);
  });

  it('reflects a mutated ownCollisionGroups/interactWithCollisionGroups live', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0 } },
    );

    body.ownCollisionGroups = [3];
    body.interactWithCollisionGroups = [5, 6];

    expect(body.bodyOptions.ownCollisionGroups).toEqual([3]);
    expect(body.bodyOptions.interactWithCollisionGroups).toEqual([5, 6]);
  });
});
