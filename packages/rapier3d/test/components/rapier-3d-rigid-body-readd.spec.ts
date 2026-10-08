import { Pnt3, Qtrn } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

describe('Rapier3dRigidBodyComponent removed from the world and added again', () => {
  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;

  beforeEach(async () => {
    world = new Rapier3dWorldComponent();
    factory = new Rapier3dFactory(world);
    await world.init();
    world.gravity = Pnt3.O;
  });

  afterEach(() => {
    world.dispose();
  });

  it('keeps the pose and velocity it had when removed', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    const ggWorld = { physicsWorld: world } as any;
    body.addToWorld(ggWorld);
    body.position = { x: 5, y: -3, z: 2 };
    const rotation = Qtrn.fromAngle(Pnt3.Z, Math.PI / 3);
    body.rotation = rotation;
    body.linearVelocity = { x: 1, y: 0, z: 0 };
    body.angularVelocity = { x: 0, y: 0, z: 0.5 };
    world.simulate(100);
    const position = body.position;
    const rotationBefore = body.rotation;
    const linvel = body.linearVelocity;
    const angvel = body.angularVelocity;

    body.removeFromWorld(ggWorld);
    expect(body.position).toEqual(position);
    body.addToWorld(ggWorld);

    expect(body.position.x).toBeCloseTo(position.x, 5);
    expect(body.position.y).toBeCloseTo(position.y, 5);
    expect(body.position.z).toBeCloseTo(position.z, 5);
    expect(body.rotation.z).toBeCloseTo(rotationBefore.z, 5);
    expect(body.rotation.w).toBeCloseTo(rotationBefore.w, 5);
    expect(body.linearVelocity.x).toBeCloseTo(linvel.x, 5);
    expect(body.angularVelocity.z).toBeCloseTo(angvel.z, 5);
  });

  it('a clone made after a move starts where the source was', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    const ggWorld = { physicsWorld: world } as any;
    body.addToWorld(ggWorld);
    body.position = { x: 5, y: -3, z: 2 };
    body.removeFromWorld(ggWorld);
    expect(body.clone().position).toEqual({ x: 5, y: -3, z: 2 });
  });

  it('a clone made after a move keeps the velocity the source had', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    const ggWorld = { physicsWorld: world } as any;
    body.addToWorld(ggWorld);
    body.linearVelocity = { x: 1, y: 2, z: 3 };
    body.angularVelocity = { x: 0, y: 0, z: 0.5 };
    body.removeFromWorld(ggWorld);
    const copy = body.clone();
    expect(copy.linearVelocity).toEqual({ x: 1, y: 2, z: 3 });
    expect(copy.angularVelocity).toEqual({ x: 0, y: 0, z: 0.5 });
    copy.addToWorld(ggWorld);
    expect(copy.linearVelocity.x).toBeCloseTo(1, 5);
    expect(copy.angularVelocity.z).toBeCloseTo(0.5, 5);
  });
});

describe('Rapier3dCharacterControllerComponent removed from the world and added again', () => {
  it('keeps the position it had when removed', async () => {
    const world = new Rapier3dWorldComponent();
    const factory = new Rapier3dFactory(world);
    await world.init();
    const cc = factory.createCharacterController({ radius: 0.3, centersDistance: 1 } as any);
    const ggWorld = { physicsWorld: world } as any;
    cc.addToWorld(ggWorld);
    cc.position = { x: 4, y: -2, z: 1 };
    cc.removeFromWorld(ggWorld);
    cc.addToWorld(ggWorld);
    expect(cc.position).toEqual({ x: 4, y: -2, z: 1 });
    world.dispose();
  });
});
