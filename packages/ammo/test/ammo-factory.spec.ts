import { Shape3DDescriptor } from '@gg-web-engine/core';
import { AmmoFactory, AmmoWorldComponent } from '../src';

describe('AmmoFactory', () => {
  let world: AmmoWorldComponent;
  let factory: AmmoFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new AmmoWorldComponent();
    await world.init();
    factory = world.factory;
    world.gravity = { x: 0, y: 0, z: 0 };
  });

  afterAll(() => {
    world.dispose();
  });

  const shapes: { name: string; shape: Shape3DDescriptor }[] = [
    { name: 'PLANE', shape: { shape: 'PLANE' } },
    { name: 'BOX', shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } } },
    { name: 'SPHERE', shape: { shape: 'SPHERE', radius: 1 } },
    { name: 'CAPSULE', shape: { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 } },
    { name: 'CYLINDER', shape: { shape: 'CYLINDER', radius: 0.5, height: 1 } },
    { name: 'CONE', shape: { shape: 'CONE', radius: 0.5, height: 1 } },
    {
      name: 'COMPOUND',
      shape: {
        shape: 'COMPOUND',
        children: [
          { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, position: { x: 0, y: 0, z: 0 } },
          { shape: { shape: 'SPHERE', radius: 0.5 }, position: { x: 0, y: 0, z: 1 } },
        ],
      },
    },
    {
      name: 'CONVEX_HULL',
      shape: {
        shape: 'CONVEX_HULL',
        vertices: [
          { x: -1, y: -1, z: -1 },
          { x: 1, y: -1, z: -1 },
          { x: 1, y: 1, z: -1 },
          { x: -1, y: 1, z: -1 },
          { x: 0, y: 0, z: 1 },
        ],
      },
    },
    {
      name: 'MESH',
      shape: {
        shape: 'MESH',
        vertices: [
          { x: -1, y: -1, z: 0 },
          { x: 1, y: -1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        faces: [[0, 1, 2]],
      },
    },
  ];

  describe.each(shapes)('$name shape', ({ shape }) => {
    it('should create a static rigid body without throwing', () => {
      const body = factory.createRigidBody({ shape, body: { dynamic: false, mass: 0 } }, { position: { x: 1, y: 2, z: 3 } });
      body.addToWorld({ physicsWorld: world } as any);
      expect(body.position).toEqual({ x: 1, y: 2, z: 3 });
      world.simulate(16);
    });

    it('should create a trigger without throwing', () => {
      const trigger = factory.createTrigger(shape, { position: { x: 0, y: 0, z: 0 } });
      trigger.addToWorld({ physicsWorld: world } as any);
      world.simulate(16);
      trigger.checkOverlaps();
    });
  });

  it('should throw a clear error for an unsupported shape', () => {
    expect(() => factory.createRigidBody({
      shape: { shape: 'NOT_A_SHAPE' } as any,
      body: { dynamic: false, mass: 0 },
    })).toThrow(/not implemented for Ammo\.js/);
  });
});
