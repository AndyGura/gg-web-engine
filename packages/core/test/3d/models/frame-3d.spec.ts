import { Frame3d, Gg3dWorld, Pnt3, Point3, Point4, Qtrn } from '../../../src';

const expectPoint = (a: Point3, b: Point3, eps: number) => {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(eps);
  expect(Math.abs(a.z - b.z)).toBeLessThanOrEqual(eps);
};

/** same rotation (q and -q are equal rotations) */
const expectRotation = (a: Point4, b: Point4, eps: number) => {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  expect(1 - dot).toBeLessThanOrEqual(eps);
};

const YAWS = [0, 0.3, -1.2, Math.PI / 2, Math.PI, -Math.PI, Math.PI - 1e-9, -Math.PI + 1e-9, 2.5, -3];
const POSITIONS: Point3[] = [
  Pnt3.O,
  { x: 3, y: -4, z: 1.5 },
  { x: 100_000, y: -100_000, z: 250 },
  { x: -98_765.4321, y: 123_456.789, z: -12 },
];
const POINTS: Point3[] = [Pnt3.O, { x: 1, y: 2, z: 3 }, { x: -250.5, y: 512.25, z: -7 }, { x: 0.001, y: -0.002, z: 0 }];
const ROTATIONS: Point4[] = [
  Qtrn.O,
  Qtrn.fromEuler({ x: 0.2, y: -0.4, z: 1.1 }),
  Qtrn.fromEuler({ x: Math.PI / 2, y: 0, z: -2.9 }),
  Qtrn.fromAngle(Pnt3.norm({ x: 1, y: 1, z: 1 }), 2),
];

describe('Frame3d', () => {
  it('defaults to identity, mapping everything to itself', () => {
    const f = new Frame3d();
    expect(f.isIdentity).toBe(true);
    expect(Frame3d.IDENTITY.isIdentity).toBe(true);
    const p = { x: 1.5, y: -2, z: 3 };
    expect(f.toGlobalPoint(p)).toEqual(p);
    expect(f.toLocalPoint(p)).toEqual(p);
    expect(f.toGlobalDirection(p)).toEqual(p);
    expect(f.toLocalDirection(p)).toEqual(p);
    const q = ROTATIONS[1];
    expect(f.toGlobalRotation(q)).toEqual(q);
    expect(f.toLocalRotation(q)).toEqual(q);
  });

  it('maps local to global as rotZ(yaw) * local + position', () => {
    const f = new Frame3d({ x: 10, y: 20, z: 5 }, Math.PI / 2);
    expectPoint(f.toGlobalPoint({ x: 1, y: 0, z: 2 }), { x: 10, y: 21, z: 7 }, 1e-12);
    expectPoint(f.toGlobalDirection(Pnt3.X), Pnt3.Y, 1e-15);
    expectPoint(f.toGlobalDirection(Pnt3.Z), Pnt3.Z, 0);
    // a body facing local +X faces global +Y
    expectPoint(Pnt3.rot(Pnt3.X, f.toGlobalRotation(Qtrn.O)), Pnt3.Y, 1e-15);
    expectRotation(f.rotation, Qtrn.fromAngle(Pnt3.Z, Math.PI / 2), 1e-15);
  });

  it('keeps yaw in (-PI, PI]', () => {
    expect(new Frame3d(Pnt3.O, Math.PI).yaw).toBe(Math.PI);
    expect(new Frame3d(Pnt3.O, -Math.PI).yaw).toBeCloseTo(Math.PI, 12);
    expect(new Frame3d(Pnt3.O, 3 * Math.PI).yaw).toBeCloseTo(Math.PI, 12);
    expect(new Frame3d(Pnt3.O, 7).yaw).toBeCloseTo(7 - 2 * Math.PI, 12);
    expect(new Frame3d(Pnt3.O, -7).yaw).toBeCloseTo(-7 + 2 * Math.PI, 12);
  });

  it('rejects non-finite values', () => {
    expect(() => new Frame3d({ x: NaN, y: 0, z: 0 })).toThrow();
    expect(() => new Frame3d(Pnt3.O, Infinity)).toThrow();
  });

  describe.each(POSITIONS.flatMap(position => YAWS.map(yaw => [position, yaw] as const)))(
    'round trips at position %j, yaw %d',
    (position, yaw) => {
      const f = new Frame3d(position, yaw);

      it('points', () => {
        for (const p of POINTS) {
          expectPoint(f.toLocalPoint(f.toGlobalPoint(p)), p, 1e-9);
          const g = Pnt3.add(position, p);
          expectPoint(f.toGlobalPoint(f.toLocalPoint(g)), g, 1e-9);
        }
      });

      it('directions (rotation only, length kept)', () => {
        for (const v of POINTS) {
          const g = f.toGlobalDirection(v);
          expect(Pnt3.len(g)).toBeCloseTo(Pnt3.len(v), 9);
          expectPoint(f.toLocalDirection(g), v, 1e-12);
          // a direction is the difference of two points
          expectPoint(g, Pnt3.sub(f.toGlobalPoint(v), f.toGlobalPoint(Pnt3.O)), 1e-9);
        }
      });

      it('rotations', () => {
        for (const q of ROTATIONS) {
          const g = f.toGlobalRotation(q);
          expectRotation(f.toLocalRotation(g), q, 1e-14);
          // a body's local axis, rotated globally, equals the axis rotated locally then converted
          const axis = { x: 0.3, y: -0.7, z: 0.2 };
          expectPoint(Pnt3.rot(axis, g), f.toGlobalDirection(Pnt3.rot(axis, q)), 1e-12);
        }
      });

      it('inverse and compose', () => {
        const inv = f.inverse();
        for (const p of POINTS) {
          expectPoint(inv.toGlobalPoint(p), f.toLocalPoint(p), 1e-9);
        }
        expect(f.compose(inv).equals(Frame3d.IDENTITY, 1e-9, 1e-12)).toBe(true);
        expect(inv.compose(f).equals(Frame3d.IDENTITY, 1e-9, 1e-12)).toBe(true);
      });
    },
  );

  it('compose applies the inner frame first', () => {
    const a = new Frame3d({ x: 100_000, y: 5, z: 1 }, 1.1);
    const b = new Frame3d({ x: -3, y: 7, z: 2 }, -2.4);
    const ab = a.compose(b);
    for (const p of POINTS) {
      expectPoint(ab.toGlobalPoint(p), a.toGlobalPoint(b.toGlobalPoint(p)), 1e-9);
    }
    for (const q of ROTATIONS) {
      expectRotation(ab.toGlobalRotation(q), a.toGlobalRotation(b.toGlobalRotation(q)), 1e-14);
    }
  });

  it('newFrame.inverse().compose(oldFrame) moves local content so its global pose is kept', () => {
    const oldFrame = new Frame3d({ x: 99_000, y: -42_000, z: 10 }, 2.9);
    const newFrame = new Frame3d({ x: 99_800, y: -41_500, z: 0 }, -3.1);
    const delta = newFrame.inverse().compose(oldFrame);
    const p = { x: 312.5, y: -77.25, z: 4 };
    const q = ROTATIONS[2];
    expectPoint(newFrame.toGlobalPoint(delta.toGlobalPoint(p)), oldFrame.toGlobalPoint(p), 1e-8);
    expectRotation(newFrame.toGlobalRotation(delta.toGlobalRotation(q)), oldFrame.toGlobalRotation(q), 1e-14);
  });

  it('equals compares yaw on the circle', () => {
    const a = new Frame3d({ x: 1, y: 2, z: 3 }, Math.PI);
    const b = new Frame3d({ x: 1, y: 2, z: 3 }, -Math.PI + 1e-12);
    expect(a.equals(b, 0, 1e-9)).toBe(true);
    expect(a.equals(b)).toBe(false);
  });

  it('is immutable plain data', () => {
    const f = new Frame3d({ x: 1, y: 2, z: 3 }, 0.5);
    expect(Object.isFrozen(f)).toBe(true);
    expect(Object.isFrozen(f.position)).toBe(true);
    expect(JSON.parse(JSON.stringify(f))).toEqual({ position: { x: 1, y: 2, z: 3 }, yaw: 0.5 });
    expect(Frame3d.from(f)).toBe(f);
    expect(Frame3d.from({ position: { x: 1, y: 2, z: 3 }, yaw: 0.5 }).equals(f)).toBe(true);
  });
});

describe('Gg3dWorld.frame', () => {
  it('is identity by default', () => {
    const world = new Gg3dWorld({});
    expect(world.frame.isIdentity).toBe(true);
    const p = { x: 1, y: 2, z: 3 };
    expect(world.toGlobalPoint(p)).toEqual(p);
    expect(world.toLocalRotation(Qtrn.O)).toEqual(Qtrn.O);
    world.dispose();
  });

  it('takes an initial frame from the constructor and delegates the helpers to it', () => {
    const world = new Gg3dWorld({ frame: { position: { x: 50_000, y: 0, z: 0 }, yaw: Math.PI / 2 } });
    expect(world.frame).toBeInstanceOf(Frame3d);
    expectPoint(world.toGlobalPoint({ x: 1, y: 0, z: 0 }), { x: 50_000, y: 1, z: 0 }, 1e-9);
    expectPoint(world.toLocalPoint({ x: 50_000, y: 1, z: 0 }), { x: 1, y: 0, z: 0 }, 1e-9);
    expectPoint(world.toGlobalDirection(Pnt3.X), Pnt3.Y, 1e-15);
    expectPoint(world.toLocalDirection(Pnt3.Y), Pnt3.X, 1e-15);
    expectRotation(world.toGlobalRotation(Qtrn.O), Qtrn.fromAngle(Pnt3.Z, Math.PI / 2), 1e-15);
    expectRotation(world.toLocalRotation(world.toGlobalRotation(ROTATIONS[1])), ROTATIONS[1], 1e-14);
    world.dispose();
  });

  it('emits frame$ on change only, and completes on dispose', () => {
    const world = new Gg3dWorld({});
    const seen: Frame3d[] = [];
    let completed = false;
    world.frame$.subscribe({ next: f => seen.push(f), complete: () => (completed = true) });
    world.frame = { position: { x: 1, y: 2, z: 3 }, yaw: 0.25 };
    world.frame = { position: { x: 1, y: 2, z: 3 }, yaw: 0.25 };
    world.frame = Frame3d.IDENTITY;
    expect(seen.map(f => f.toJSON())).toEqual([
      { position: { x: 0, y: 0, z: 0 }, yaw: 0 },
      { position: { x: 1, y: 2, z: 3 }, yaw: 0.25 },
      { position: { x: 0, y: 0, z: 0 }, yaw: 0 },
    ]);
    world.dispose();
    expect(completed).toBe(true);
  });
});
