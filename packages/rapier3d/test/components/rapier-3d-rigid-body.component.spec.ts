import { Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

describe('Rapier3dRigidBodyComponent.bodyOptions', () => {
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

  it("reads back a dynamic body's mass/friction/restitution/ccd exactly as created", () => {
    const body = factory.createRigidBody(
      {
        shape: { shape: 'SPHERE', radius: 1 },
        body: { bodyType: 'dynamic', mass: 5, friction: 0.3, restitution: 0.7, ccd: true },
      },
      { position: { x: 0, y: 0, z: 0 } },
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
        { shape: { shape: 'SPHERE', radius: 1 }, body: { bodyType, mass: 1, ccd: true } },
        { position: { x: 0, y: 0, z: 0 } },
      );
      body.addToWorld({ physicsWorld: world } as any);

      expect(body.bodyOptions.bodyType).toBe(bodyType);
      expect(body.bodyOptions.ccd).toBe(false);
    },
  );

  it('reflects a mutated ownCollisionGroups/interactWithCollisionGroups live', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'SPHERE', radius: 1 }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);

    body.ownCollisionGroups = [3];
    body.interactWithCollisionGroups = [5, 6];

    expect(body.bodyOptions.ownCollisionGroups).toEqual([3]);
    expect(body.bodyOptions.interactWithCollisionGroups).toEqual([5, 6]);
  });
});
