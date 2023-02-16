import { Point2 } from '../models/points';

export class Pnt2 {
  /** clone point */
  static clone(p: Point2): Point2 {
    return { ...p };
  }

  /** add point b to point a */
  static add(a: Point2, b: Point2): Point2 {
    a.x += b.x;
    a.y += b.y;
    return a;
  }

  /** normalize */
  static norm(p: Point2): Point2 {
    const length = Math.sqrt(p.x ** 2 + p.y ** 2);
    return {
      x: p.x / length,
      y: p.y / length,
    };
  }
}
