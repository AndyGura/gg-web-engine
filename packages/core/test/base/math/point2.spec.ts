import { Pnt2, Point2 } from '../../../src';

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

describe(`Pnt2`, () => {

  describe('rot', () => {

    it('should rotate point correctly', () => {
      const point: Point2 = { x: 1, y: 0 };
      expect(Pnt2.rot(point, Math.PI / 6)).toMatchObject({
        x: expect.toBeAround(Math.sqrt(3) / 2),
        y: expect.toBeAround(0.5),
      });
    });

  });

  describe('rotAround', () => {

    it('should rotate point correctly', () => {
      const point: Point2 = { x: 35, y: 13 };
      expect(Pnt2.rotAround(point, { x: 34, y: 13 }, Math.PI / 6)).toMatchObject({
        x: expect.toBeAround(34 + Math.sqrt(3) / 2),
        y: expect.toBeAround(13.5),
      });
    });

  });


  describe('angle', () => {
    it('returns 0 instead of NaN when either vector has zero length', () => {
      expect(Pnt2.angle(Pnt2.O, { x: 1, y: 2 })).toBe(0);
      expect(Pnt2.angle({ x: 1, y: 2 }, Pnt2.O)).toBe(0);
    });

    it('does not return NaN for almost identical vectors', () => {
      const angle = Pnt2.angle({ x: 2.9611996755771295, y: 0.48093292813229027 }, { x: 0.9870665585257098, y: 0.16031097604409816 });
      expect(angle).not.toBeNaN();
      expect(angle).toBeCloseTo(0);
    });
  });
});
