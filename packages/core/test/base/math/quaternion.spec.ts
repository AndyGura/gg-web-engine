import { Point4, Qtrn } from '../../../src';

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
});
