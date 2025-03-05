import { Pnt3, Point3, Spherical } from '../../../src';

// TODO move in some generic place
expect.extend({
  toBeAround(actual: number, expected: number, precision = 2) {
    const pass = Math.abs(expected - actual) < Math.pow(10, -precision) / 2;
    if (pass) {
      return {
        message: () => `expected ${actual} not to be around ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${actual} to be around ${expected}`,
        pass: false,
      };
    }
  },
});
declare global {
  namespace jest {
    // @ts-ignore
    interface Expect<R> {
      toBeAround(actual: number, expected: number, precision?: number): R;
    }
  }
}

describe(`Pnt3`, () => {

  describe('angle', () => {
    it('returns angle between almost identical vectors, handling precision error', () => {
      const a = {
          x: 2.9611996755771295,
          y: 0.48093292813229027,
          z: 0
      };
      const b = {
          x: 0.9870665585257098,
          y: 0.16031097604409816,
          z: 0
      };
      const angle = Pnt3.angle(a, b);
      expect(angle).not.toBeNaN();
      expect(angle).toBeAround(0);
    });
  });

  describe('toSpherical', () => {
    it('returns correct spherical coordinates for a point on the x-axis', () => {
      const point: Point3 = { x: 1, y: 0, z: 0 };
      const expected: Spherical = { radius: 1, theta: 0, phi: Math.PI / 2 };
      expect(Pnt3.toSpherical(point)).toMatchObject({
        radius: expect.toBeAround(expected.radius),
        theta: expect.toBeAround(expected.theta),
        phi: expect.toBeAround(expected.phi),
      });
    });

    it('returns correct spherical coordinates for a point on the y-axis', () => {
      const point: Point3 = { x: 0, y: 1, z: 0 };
      const expected: Spherical = { radius: 1, theta: Math.PI / 2, phi: Math.PI / 2 };
      expect(Pnt3.toSpherical(point)).toMatchObject({
        radius: expect.toBeAround(expected.radius),
        theta: expect.toBeAround(expected.theta),
        phi: expect.toBeAround(expected.phi),
      });
    });

    it('returns correct spherical coordinates for a point on the z-axis', () => {
      const point: Point3 = { x: 0, y: 0, z: 1 };
      const expected: Spherical = { radius: 1, theta: 0, phi: 0 };
      expect(Pnt3.toSpherical(point)).toMatchObject({
        radius: expect.toBeAround(expected.radius),
        theta: expect.toBeAround(expected.theta),
        phi: expect.toBeAround(expected.phi),
      });
    });

    it('returns correct spherical coordinates for a point in the positive octant', () => {
      const point: Point3 = { x: 1, y: 1, z: 1 };
      const expected: Spherical = {
        radius: Math.sqrt(3),
        theta: Math.atan2(1, 1),
        phi: Math.acos(1 / Math.sqrt(3)),
      };
      expect(Pnt3.toSpherical(point)).toMatchObject({
        radius: expect.toBeAround(expected.radius),
        theta: expect.toBeAround(expected.theta),
        phi: expect.toBeAround(expected.phi),
      });
    });
  });

  describe('fromSpherical', () => {
    it('returns correct cartesian coordinates for a point on the x-axis', () => {
      const spherical: Spherical = { radius: 1, theta: 0, phi: Math.PI / 2 };
      const expected: Point3 = { x: 1, y: 0, z: 0 };
      expect(Pnt3.fromSpherical(spherical)).toMatchObject({
        x: expect.toBeAround(expected.x),
        y: expect.toBeAround(expected.y),
        z: expect.toBeAround(expected.z),
      });
    });

    it('returns correct cartesian coordinates for a point on the y-axis', () => {
      const spherical: Spherical = { radius: 1, theta: Math.PI / 2, phi: Math.PI / 2 };
      const expected: Point3 = { x: 0, y: 1, z: 0 };
      expect(Pnt3.fromSpherical(spherical)).toMatchObject({
        x: expect.toBeAround(expected.x),
        y: expect.toBeAround(expected.y),
        z: expect.toBeAround(expected.z),
      });
    });

    it('returns correct cartesian coordinates for a point on the z-axis', () => {
      const spherical: Spherical = { radius: 1, theta: 0, phi: 0 };
      const expected: Point3 = { x: 0, y: 0, z: 1 };
      expect(Pnt3.fromSpherical(spherical)).toMatchObject({
        x: expect.toBeAround(expected.x),
        y: expect.toBeAround(expected.y),
        z: expect.toBeAround(expected.z),
      });
    });

    it('returns correct cartesian coordinates for a point in the positive octant', () => {
      const spherical: Spherical = {
        radius: Math.sqrt(3),
        theta: Math.atan2(1, 1),
        phi: Math.acos(1 / Math.sqrt(3)),
      };
      const expected: Point3 = { x: 1, y: 1, z: 1 };
      expect(Pnt3.fromSpherical(spherical)).toMatchObject({
        x: expect.toBeAround(expected.x),
        y: expect.toBeAround(expected.y),
        z: expect.toBeAround(expected.z),
      });
    });
  });

});
