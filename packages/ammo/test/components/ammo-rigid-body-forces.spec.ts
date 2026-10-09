import { Pnt3 } from '@gg-web-engine/core';
import { AmmoFactory, AmmoWorldComponent } from '../../src';

const STEP = 1000 / 60;

describe('AmmoRigidBodyComponent force API', () => {
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

  const sphere = (mass = 2) => {
    const body = factory.createRigidBody(
      { shape: { shape: 'SPHERE', radius: 1 }, body: { bodyType: 'dynamic', mass } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);
    return body;
  };

  it('a force re-applied every tick accelerates the body by F / m', () => {
    const body = sphere(2);
    for (let i = 0; i < 60; i++) {
      body.applyForce({ x: 10, y: 0, z: 0 });
      world.simulate(STEP);
    }
    expect(body.linearVelocity.x).toBeCloseTo(5, 1);
    expect(body.linearVelocity.y).toBeCloseTo(0, 6);
  });

  it('a force acts on the next simulate() call only', () => {
    const body = sphere(2);
    body.applyForce({ x: 10, y: 0, z: 0 });
    world.simulate(STEP);
    const afterOne = body.linearVelocity.x;
    expect(afterOne).toBeGreaterThan(0);
    world.simulate(STEP);
    expect(body.linearVelocity.x).toBeCloseTo(afterOne, 6);
  });

  it('a force applied while the body is out of the world is dropped, not banked', () => {
    const body = sphere(2);
    body.removeFromWorld({ physicsWorld: world } as any);
    for (let i = 0; i < 60; i++) {
      body.applyForce({ x: 10, y: 0, z: 0 });
    }
    body.addToWorld({ physicsWorld: world } as any);
    world.simulate(STEP);
    expect(body.linearVelocity.x).toBeCloseTo(0, 6);
  });

  it('an impulse changes the velocity by J / m at once', () => {
    const body = sphere(2);
    body.applyImpulse({ x: 0, y: 4, z: 0 });
    expect(body.linearVelocity.y).toBeCloseTo(2, 6);
  });

  it('a torque over one second equals the same torque impulse', () => {
    const spun = sphere(2);
    for (let i = 0; i < 60; i++) {
      spun.applyTorque({ x: 0, y: 0, z: 3 });
      world.simulate(STEP);
    }
    const kicked = sphere(2);
    kicked.applyTorqueImpulse({ x: 0, y: 0, z: 3 });
    expect(spun.angularVelocity.z).toBeGreaterThan(0);
    expect(spun.angularVelocity.z).toBeCloseTo(kicked.angularVelocity.z, 1);
  });

  it('a force at a point off the centre of mass also spins the body', () => {
    const body = sphere(2);
    body.applyForce({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 });
    world.simulate(STEP);
    expect(body.linearVelocity.y).toBeGreaterThan(0);
    expect(body.angularVelocity.z).toBeGreaterThan(0);
    const kicked = sphere(2);
    kicked.applyImpulse({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(kicked.angularVelocity.z).toBeGreaterThan(0);
  });

  it('a static body ignores forces and impulses', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0, z: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);
    body.applyForce({ x: 10, y: 0, z: 0 });
    body.applyImpulse({ x: 10, y: 0, z: 0 });
    body.applyTorque({ x: 0, y: 0, z: 1 });
    body.applyTorqueImpulse({ x: 0, y: 0, z: 1 });
    world.simulate(STEP);
    expect(body.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('a force wakes a sleeping body', () => {
    const body = sphere(2);
    body.sleep();
    expect(body.isSleeping).toBe(true);
    body.applyForce({ x: 10, y: 0, z: 0 });
    expect(body.isSleeping).toBe(false);
    world.simulate(STEP);
    expect(body.linearVelocity.x).toBeGreaterThan(0);
  });
});
