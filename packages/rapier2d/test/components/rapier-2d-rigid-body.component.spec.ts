import { Pnt2 } from '@gg-web-engine/core';
import { Rapier2dFactory, Rapier2dWorldComponent } from '../../src';

describe('Rapier2dRigidBodyComponent.bodyOptions', () => {
  let world: Rapier2dWorldComponent;
  let factory: Rapier2dFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier2dWorldComponent();
    factory = new Rapier2dFactory(world);
    await world.init();
    world.gravity = Pnt2.O;
  });

  afterAll(() => {
    world.dispose();
  });

  it('reads back a dynamic body\'s mass/friction/restitution/ccd exactly as created', () => {
    const body = factory.createRigidBody(
      {
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 5, friction: 0.3, restitution: 0.7, ccd: true },
      },
      { position: { x: 0, y: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    expect(body.bodyOptions).toMatchObject({
      bodyType: 'dynamic',
      mass: 5,
      friction: 0.3,
      restitution: 0.7,
      ccd: true,
    });
  });

  it.each(['static', 'kinematic_pos', 'kinematic_vel'] as const)(
    'reports bodyType "%s" correctly, with ccd always false for a non-dynamic body',
    bodyType => {
      const body = factory.createRigidBody(
        { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType, mass: 1, ccd: true } },
        { position: { x: 0, y: 0 } },
      );
      body.addToWorld({ physicsWorld: world } as any);

      expect(body.bodyOptions.bodyType).toBe(bodyType);
      expect(body.bodyOptions.ccd).toBe(false);
    },
  );

  it('reflects a mutated ownCollisionGroups/interactWithCollisionGroups live', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    body.ownCollisionGroups = [3];
    body.interactWithCollisionGroups = [5, 6];

    expect(body.bodyOptions.ownCollisionGroups).toEqual([3]);
    expect(body.bodyOptions.interactWithCollisionGroups).toEqual([5, 6]);
  });
});
