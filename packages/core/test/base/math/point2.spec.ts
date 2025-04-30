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

});
