import { Pnt2 } from '@gg-web-engine/core';
import { Rapier2dFactory, Rapier2dWorldComponent } from '../../src';

describe('Rapier2dRigidBodyComponent removed from the world and added again', () => {
  let world: Rapier2dWorldComponent;
  let factory: Rapier2dFactory;

  beforeEach(async () => {
    world = new Rapier2dWorldComponent();
    factory = new Rapier2dFactory(world);
    await world.init();
    world.gravity = Pnt2.O;
  });

  afterEach(() => {
    world.dispose();
  });

  it('keeps the pose and velocity it had when removed', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0 } },
    );
    const ggWorld = { physicsWorld: world } as any;
    body.addToWorld(ggWorld);
    body.position = { x: 5, y: -3 };
    body.rotation = 0.7;
    body.linearVelocity = { x: 1, y: 0 };
    body.angularVelocity = 0.5;
    world.simulate(100);
    const position = body.position;
    const rotation = body.rotation;
    const linvel = body.linearVelocity;
    const angvel = body.angularVelocity;

    body.removeFromWorld(ggWorld);
    body.addToWorld(ggWorld);

    expect(body.position.x).toBeCloseTo(position.x, 3);
    expect(body.position.y).toBeCloseTo(position.y, 3);
    expect(body.rotation).toBeCloseTo(rotation, 5);
    expect(body.linearVelocity.x).toBeCloseTo(linvel.x, 3);
    expect(body.angularVelocity).toBeCloseTo(angvel, 5);
  });
  it('a clone made after a move starts where the source was', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0 } },
    );
    const ggWorld = { physicsWorld: world } as any;
    body.addToWorld(ggWorld);
    body.position = { x: 5, y: -3 };
    body.removeFromWorld(ggWorld);
    expect(body.clone().position).toEqual({ x: 5, y: -3 });
  });

  it('a clone made after a move keeps the velocity the source had', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0 } },
    );
    const ggWorld = { physicsWorld: world } as any;
    body.addToWorld(ggWorld);
    body.linearVelocity = { x: 1, y: 2 };
    body.angularVelocity = 0.5;
    body.removeFromWorld(ggWorld);
    const copy = body.clone();
    expect(copy.linearVelocity).toEqual({ x: 1, y: 2 });
    expect(copy.angularVelocity).toBe(0.5);
    copy.addToWorld(ggWorld);
    expect(copy.linearVelocity.x).toBeCloseTo(1, 5);
    expect(copy.angularVelocity).toBeCloseTo(0.5, 5);
  });
});

describe('Rapier2dCharacterControllerComponent removed from the world and added again', () => {
  it('keeps the position it had when removed', async () => {
    const world = new Rapier2dWorldComponent();
    const factory = new Rapier2dFactory(world);
    await world.init();
    const cc = factory.createCharacterController({ radius: 0.4, centersDistance: 1 } as any);
    const ggWorld = { physicsWorld: world } as any;
    cc.addToWorld(ggWorld);
    cc.position = { x: 4, y: -2 };
    cc.removeFromWorld(ggWorld);
    cc.addToWorld(ggWorld);
    expect(cc.position.x).toBeCloseTo(4, 3);
    expect(cc.position.y).toBeCloseTo(-2, 3);
    world.dispose();
  });
});
