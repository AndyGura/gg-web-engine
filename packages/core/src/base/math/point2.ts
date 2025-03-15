import { Point2, Polar } from '../models/points';
import { lerpAngle } from './numbers';

export class Pnt2 {
  /** empty vector */
  static get O(): Point2 {
    return { x: 0, y: 0 };
  }

  /** basis X vector */
  static get X(): Point2 {
    return { x: 1, y: 0 };
  }

  /** basis Y vector */
  static get Y(): Point2 {
    return { x: 0, y: 1 };
  }

  /** basis -X vector */
  static get nX(): Point2 {
    return { x: -1, y: 0 };
  }

  /** basis -Y vector */
  static get nY(): Point2 {
    return { x: 0, y: -1 };
  }

  /** clone point */
  static clone(p: Point2): Point2 {
    return { x: p.x, y: p.y };
  }

  /** spread point components */
  static spr(p: Point2): [number, number] {
    return [p.x, p.y];
  }

  /** get negation of the point */
  static neg(p: Point2): Point2 {
    return { x: -p.x, y: -p.y };
  }

  /** add point b to point a */
  static add(a: Point2, b: Point2): Point2 {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  /** subtract point b from point a */
  static sub(a: Point2, b: Point2): Point2 {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  /** scale point b by point. The result is the point, where each component is a product of appropriate components of input points */
  static scale(a: Point2, s: Point2): Point2 {
    return { x: a.x * s.x, y: a.y * s.y };
  }

  /** average point between a and b */
  static avg(a: Point2, b: Point2): Point2 {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** round point components */
  static round(p: Point2): Point2 {
    return { x: Math.round(p.x), y: Math.round(p.y) };
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
    const length = Pnt2.len(p);
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

  /** dot multiplication */
  static dot(a: Point2, b: Point2): number {
    return a.x * b.x + a.y * b.y;
  }

  /** linear interpolation */
  static lerp(a: Point2, b: Point2, t: number): Point2 {
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    };
  }

  /** linear interpolation (spherical/polar) */
  static slerp(a: Point2, b: Point2, t: number): Point2 {
    const as = Pnt2.toPolar(a);
    const bs = Pnt2.toPolar(b);
    return Pnt2.fromPolar({
      radius: as.radius + t * (bs.radius - as.radius),
      phi: lerpAngle(as.phi, bs.phi, t),
    });
  }

  /** angle between vectors in radians */
  static angle(a: Point2, b: Point2): number {
    const magnitudeProduct = Pnt2.len(a) * Pnt2.len(b);
    return Math.acos(Pnt2.dot(a, b) / magnitudeProduct);
  }

  /** rotate point around zero by provided angle */
  static rot(p: Point2, angle: number): Point2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos,
    };
  }

  /** rotate point around pivot by provided angle */
  static rotAround(p: Point2, pivot: Point2, angle: number): Point2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const p0 = { x: p.x - pivot.x, y: p.y - pivot.y };
    return {
      x: p0.x * cos - p0.y * sin + pivot.x,
      y: p0.x * sin + p0.y * cos + pivot.y,
    };
  }

  /**
   * Converts a cartesian 2D point to a polar coordinate system,
   * phi == 0 is faced towards X axis direction
   * @param p - The cartesian 2D point.
   * @returns The polar coordinates as an object with radius and phi properties.
   */
  static toPolar(p: Point2): Polar {
    const radius = Math.sqrt(p.x * p.x + p.y * p.y);
    return {
      radius,
      phi: radius == 0 ? 0 : Math.atan2(p.y, p.x),
    };
  }

  /**
   * Converts a polar coordinate system to a cartesian 2D point. Used polar coordinates,
   * where phi == 0 is faced towards X axis direction
   * @param p - The polar coordinate system.
   * @returns The cartesian 2D point as an object with x and y properties.
   */
  static fromPolar(p: Polar): Point2 {
    return {
      x: p.radius * Math.cos(p.phi),
      y: p.radius * Math.sin(p.phi),
    };
  }
}
