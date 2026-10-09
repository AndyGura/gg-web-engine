import { Pnt2 } from '@gg-web-engine/core';
import { MatterFactory, MatterWorldComponent } from '../../src';

const STEP = 1000 / 60;

describe('MatterRigidBodyComponent force API', () => {
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

  const circle = (mass = 2) => {
    const body = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'dynamic', mass } },
      { position: { x: 0, y: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);
    // matter-js damps every body's velocity by `frictionAir` (1% a step) by default; off, so the
    // integration below is checkable against F / m exactly
    body.nativeBody.frictionAir = 0;
    return body;
  };

  it('a force re-applied every tick accelerates the body by F / m', () => {
    const body = circle(2);
    for (let i = 0; i < 60; i++) {
      body.applyForce({ x: 10, y: 0 });
      world.simulate(STEP);
    }
    expect(body.linearVelocity.x).toBeCloseTo(5, 1);
    expect(body.linearVelocity.y).toBeCloseTo(0, 6);
  });

  it('a force acts on the next simulate() call only', () => {
    const body = circle(2);
    body.applyForce({ x: 10, y: 0 });
    world.simulate(STEP);
    const afterOne = body.linearVelocity.x;
    expect(afterOne).toBeGreaterThan(0);
    world.simulate(STEP);
    expect(body.linearVelocity.x).toBeCloseTo(afterOne, 6);
  });

  it('a force applied while the body is out of the world is dropped, not banked', () => {
    const body = circle(2);
    body.removeFromWorld({ physicsWorld: world } as any);
    for (let i = 0; i < 60; i++) {
      body.applyForce({ x: 10, y: 0 });
    }
    body.addToWorld({ physicsWorld: world } as any);
    world.simulate(STEP);
    expect(body.linearVelocity.x).toBeCloseTo(0, 6);
  });

  it('an impulse changes the velocity by J / m at once', () => {
    const body = circle(2);
    body.applyImpulse({ x: 0, y: 4 });
    expect(body.linearVelocity.y).toBeCloseTo(2, 6);
  });

  it('a torque over one second equals the same torque impulse', () => {
    const spun = circle(2);
    for (let i = 0; i < 60; i++) {
      spun.applyTorque(3);
      world.simulate(STEP);
    }
    const kicked = circle(2);
    kicked.applyTorqueImpulse(3);
    expect(spun.angularVelocity).toBeGreaterThan(0);
    expect(spun.angularVelocity).toBeCloseTo(kicked.angularVelocity, 2);
  });

  it('a force at a point off the centre of mass also spins the body', () => {
    const body = circle(2);
    body.applyForce({ x: 0, y: 10 }, { x: 1, y: 0 });
    world.simulate(STEP);
    expect(body.linearVelocity.y).toBeGreaterThan(0);
    expect(body.angularVelocity).toBeGreaterThan(0);
    const kicked = circle(2);
    kicked.applyImpulse({ x: 0, y: 1 }, { x: 1, y: 0 });
    expect(kicked.angularVelocity).toBeGreaterThan(0);
  });

  it('a static body ignores forces and impulses', () => {
    const body = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: 0 } },
    );
    body.addToWorld({ physicsWorld: world } as any);
    body.applyForce({ x: 10, y: 0 });
    body.applyImpulse({ x: 10, y: 0 });
    body.applyTorque(1);
    body.applyTorqueImpulse(1);
    world.simulate(STEP);
    expect(body.position).toEqual({ x: 0, y: 0 });
  });

  it('a force wakes a sleeping body', () => {
    const body = circle(2);
    body.sleep();
    expect(body.isSleeping).toBe(true);
    body.applyForce({ x: 10, y: 0 });
    expect(body.isSleeping).toBe(false);
    world.simulate(STEP);
    expect(body.linearVelocity.x).toBeGreaterThan(0);
  });
});
