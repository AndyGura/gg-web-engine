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

  /** calculate vector length (squared) */
  static lenSq(v: Point2) {
    return v.x * v.x + v.y * v.y;
  }

  /** calculate vector length */
  static len(v: Point2) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  /** distance between points */
  static dist(a: Point2, b: Point2): number {
    return Pnt2.len(Pnt2.sub(a, b));
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

  /** angle between vectors in radians */
  static angle(a: Point2, b: Point2): number {
    const dotProduct = a.x * b.x + a.y * b.y;
    const magnitudeProduct = Math.sqrt(a.x ** 2 + a.y ** 2) * Math.sqrt(b.x ** 2 + b.y ** 2);
    return Math.acos(dotProduct / magnitudeProduct);
  }
}
