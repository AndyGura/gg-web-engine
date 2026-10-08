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
});

describe('Rapier2dCharacterControllerComponent removed from the world and added again', () => {
  it('keeps the position it had when removed', async () => {
    const world = new Rapier2dWorldComponent();
    const factory = new Rapier2dFactory(world);
    await world.init();
    const cc = factory.createCharacterController({ radius: 10, centersDistance: 20 } as any);
    const ggWorld = { physicsWorld: world } as any;
    cc.addToWorld(ggWorld);
    cc.position = { x: 40, y: -20 };
    cc.removeFromWorld(ggWorld);
    cc.addToWorld(ggWorld);
    expect(cc.position.x).toBeCloseTo(40, 3);
    expect(cc.position.y).toBeCloseTo(-20, 3);
    world.dispose();
  });
});
