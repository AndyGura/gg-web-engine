import { Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

describe('Rapier3dRigidBodyComponent mass properties', () => {
  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;

  beforeEach(async () => {
    world = new Rapier3dWorldComponent();
    factory = new Rapier3dFactory(world);
    await world.init();
  });

  afterEach(() => {
    world.dispose();
  });

  const box = { shape: 'BOX' as const, dimensions: { x: 1, y: 1, z: 1 } };

  it("puts a compound body's centre of mass at its origin, with the inertia it has about it", () => {
    const body = factory.createRigidBody(
      {
        shape: { shape: 'COMPOUND', children: [{ shape: box }, { shape: box, position: { x: 0, y: 0, z: 2 } }] },
        body: { bodyType: 'dynamic', mass: 2 },
      },
      { position: Pnt3.O },
    );
    body.addToWorld({ physicsWorld: world } as any);
    const native = body.nativeBody!;
    expect(native.mass()).toBeCloseTo(2, 5);
    expect(Pnt3.len(native.localCom())).toBeLessThan(1e-5);
    // two 1 kg unit boxes, one at the origin, one 2 m above it: each has m/6 about its own centre,
    // the upper one adds m * d^2 = 4 around x and y
    const inertia = [native.principalInertia().x, native.principalInertia().y, native.principalInertia().z].sort(
      (a, b) => a - b,
    );
    expect(inertia[0]).toBeCloseTo(1 / 3, 4);
    expect(inertia[1]).toBeCloseTo(1 / 3 + 4, 4);
    expect(inertia[2]).toBeCloseTo(1 / 3 + 4, 4);
    expect(body.bodyOptions.mass).toBeCloseTo(2, 5);
  });

  it('spreads the mass of a compound by volume', () => {
    const body = factory.createRigidBody(
      {
        shape: {
          shape: 'COMPOUND',
          children: [
            { shape: { shape: 'BOX', dimensions: { x: 2, y: 2, z: 2 } }, position: { x: -1, y: 0, z: 0 } },
            { shape: box, position: { x: 4, y: 0, z: 0 } },
          ],
        },
        body: { bodyType: 'dynamic', mass: 9 },
      },
      { position: Pnt3.O },
    );
    body.addToWorld({ physicsWorld: world } as any);
    const native = body.nativeBody!;
    // 8 kg at x=-1 and 1 kg at x=4: inertia around z about the origin includes 8 * 1 + 1 * 16
    const izz = (8 * (4 + 4)) / 12 + (1 * 2) / 12 + 8 + 16;
    const inertia = native.principalInertia();
    expect([inertia.x, inertia.y, inertia.z].some(v => Math.abs(v - izz) < 1e-3)).toBe(true);
  });

  it('keeps the same properties after being removed and added again', () => {
    const body = factory.createRigidBody(
      {
        shape: { shape: 'COMPOUND', children: [{ shape: box }, { shape: box, position: { x: 0, y: 0, z: 2 } }] },
        body: { bodyType: 'dynamic', mass: 2 },
      },
      { position: Pnt3.O },
    );
    const ggWorld = { physicsWorld: world } as any;
    body.addToWorld(ggWorld);
    body.removeFromWorld(ggWorld);
    body.addToWorld(ggWorld);
    expect(body.nativeBody!.mass()).toBeCloseTo(2, 5);
    expect(Pnt3.len(body.nativeBody!.localCom())).toBeLessThan(1e-5);
  });

  it('leaves a single centred shape alone', () => {
    const body = factory.createRigidBody({ shape: box, body: { bodyType: 'dynamic', mass: 3 } }, { position: Pnt3.O });
    body.addToWorld({ physicsWorld: world } as any);
    expect(body.nativeBody!.mass()).toBeCloseTo(3, 5);
    expect(body.nativeBody!.principalInertia().x).toBeCloseTo((3 * 2) / 12, 5);
  });
});
