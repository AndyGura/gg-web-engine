import { Point2 } from '../models/points';

export class Pnt2 {
  /** clone point */
  static clone(p: Point2): Point2 {
    return {...p};
  }
  /** add point b to point a */
  static add(a: Point2, b: Point2): Point2 {
    a.x += b.x;
    a.y += b.y;
    return a;
  }
}
