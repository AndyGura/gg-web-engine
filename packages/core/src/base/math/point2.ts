import { Point2 } from '../models/points';

export class Pnt2 {
  /** clone point */
  static clone(p: Point2): Point2 {
    return { x: p.x, y: p.y };
  }

  /** add point b to point a */
  static add(a: Point2, b: Point2): Point2 {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  /** subtract point b from point a */
  static sub(a: Point2, b: Point2): Point2 {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  /** normalize */
  static norm(p: Point2): Point2 {
    const length = Math.sqrt(p.x ** 2 + p.y ** 2);
    return {
      x: p.x / length,
      y: p.y / length,
    };
  }

  /** scalar multiplication */
  static scalarMult(p: Point2, m: number): Point2 {
    return {
      x: p.x * m,
      y: p.y * m,
    };
  }

  /** linear interpolation */
  static lerp(a: Point2, b: Point2, t: number): Point2 {
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    };
  }
}
