import { Pnt3, Point3, Point4, Qtrn } from '../../../src';

describe(`Qtrn`, () => {

  describe(`rotAround`, () => {
    it('should return the same quaternion if rotated by zero angle', () => {
      const quat: Point4 = { x: 0.707, y: 0, z: 0, w: 0.707 };
      const updated = Qtrn.rotAround(quat, { x: 0, y: 0, z: 1 }, 0);
      expect(updated).toEqual(quat);
    });
    it('should do Y turn', () => {
      const quat: Point4 = { x: -0.222236, y: -0.411159, z: 0.258291, w: 0.812649 };
      const updated = Qtrn.rotAround(quat, { x: 0, y: 1, z: 0 }, Math.PI / 6);
      expect(updated.x).toBeCloseTo(-0.147813);
      expect(updated.y).toBeCloseTo(-0.1868);
      expect(updated.z).toBeCloseTo(0.307009);
      expect(updated.w).toBeCloseTo(0.891375);
    });
  });

  describe(`fromTo`, () => {
    const expectRotatesOnto = (from: Point3, to: Point3) => {
      const rotated = Pnt3.rot(Pnt3.norm(from), Qtrn.fromTo(from, to));
      const target = Pnt3.norm(to);
      expect(rotated.x).toBeCloseTo(target.x);
      expect(rotated.y).toBeCloseTo(target.y);
      expect(rotated.z).toBeCloseTo(target.z);
    };

    it('rotates `from` onto `to`', () => {
      expectRotatesOnto(Pnt3.Z, { x: 0.3, y: -0.2, z: 1 });
      expectRotatesOnto({ x: 1, y: 2, z: 3 }, { x: -3, y: 0.5, z: 2 });
      expectRotatesOnto(Pnt3.Z, Pnt3.X);
    });

    it('handles opposite and identical directions', () => {
      expectRotatesOnto(Pnt3.Z, Pnt3.nZ);
      expectRotatesOnto(Pnt3.X, Pnt3.nX);
      expect(Qtrn.fromTo(Pnt3.Z, { x: 0, y: 0, z: 5 })).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    });

    it('returns the identity for a zero-length vector', () => {
      expect(Qtrn.fromTo(Pnt3.O, Pnt3.Z)).toEqual(Qtrn.O);
    });

    it('stays close to the identity for a direction close to `from`, whichever side it tilts to', () => {
      // regression: SurfaceFollowingEntity oriented its planes with Qtrn.lookAt, whose twist around
      // the normal flipped with the sign of a nearly flat road's tiny tilt
      for (const tilt of [1e-4, -1e-4]) {
        const q = Qtrn.fromTo(Pnt3.Z, Pnt3.norm({ x: tilt, y: tilt, z: 1 }));
        expect(Math.abs(q.w)).toBeGreaterThan(0.99999);
      }
    });
  });
});
