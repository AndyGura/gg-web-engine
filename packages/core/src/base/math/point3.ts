import { Point3, Point4, Spherical } from '../models/points';
import { Qtrn } from './quaternion';

export class Pnt3 {
  /** empty vector */
  static get O(): Point3 {
    return { x: 0, y: 0, z: 0 };
  }

  /** basis X vector */
  static get X(): Point3 {
    return { x: 1, y: 0, z: 0 };
  }

  /** basis Y vector */
  static get Y(): Point3 {
    return { x: 0, y: 1, z: 0 };
  }

  /** basis Z vector */
  static get Z(): Point3 {
    return { x: 0, y: 0, z: 1 };
  }

  /** basis -X vector */
  static get nX(): Point3 {
    return { x: -1, y: 0, z: 0 };
  }

  /** basis -Y vector */
  static get nY(): Point3 {
    return { x: 0, y: -1, z: 0 };
  }

  /** basis -Z vector */
  static get nZ(): Point3 {
    return { x: 0, y: 0, z: -1 };
  }

  /** clone point */
  static clone(p: Point3): Point3 {
    return { x: p.x, y: p.y, z: p.z };
  }

  /** spread point components */
  static spr(p: Point3): [number, number, number] {
    return [p.x, p.y, p.z];
  }

  /** get negation of the point */
  static neg(p: Point3): Point3 {
    return { x: -p.x, y: -p.y, z: -p.z };
  }

  /** add point b to point a */
  static add(a: Point3, b: Point3): Point3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  /** subtract point b from point a */
  static sub(a: Point3, b: Point3): Point3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  /** scale point b by point. The result is the point, where each component is a product of appropriate components of input points */
  static scale(a: Point3, s: Point3): Point3 {
    return { x: a.x * s.x, y: a.y * s.y, z: a.z * s.z };
  }

  /** average point between a and b */
  static avg(a: Point3, b: Point3): Point3 {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  }

  /** round point components */
  static round(p: Point3): Point3 {
    return { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) };
  }

  /** calculate vector length (squared) */
  static lenSq(v: Point3) {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  }

  /** calculate vector length */
  static len(v: Point3) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /** distance between points */
  static dist(a: Point3, b: Point3): number {
    return Pnt3.len(Pnt3.sub(a, b));
  }

  /** cross vectors */
  static cross(a: Point3, b: Point3): Point3 {
    const ax = a.x,
      ay = a.y,
      az = a.z;
    const bx = b.x,
      by = b.y,
      bz = b.z;
    return {
      x: ay * bz - az * by,
      y: az * bx - ax * bz,
      z: ax * by - ay * bx,
    };
  }

  /** normalize */
  static norm(p: Point3): Point3 {
    const length = Pnt3.len(p);
    if (length === 0) {
      return p;
    }
    return {
      x: p.x / length,
      y: p.y / length,
      z: p.z / length,
    };
  }

  /** scalar multiplication */
  static scalarMult(p: Point3, m: number): Point3 {
    return {
      x: p.x * m,
      y: p.y * m,
      z: p.z * m,
    };
  }

  /** dot multiplication */
  static dot(a: Point3, b: Point3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /** linear interpolation */
  static lerp(a: Point3, b: Point3, t: number): Point3 {
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      z: a.z + t * (b.z - a.z),
    };
  }

  /** angle between vectors in radians */
  static angle(a: Point3, b: Point3): number {
    const magnitudeProduct = Pnt3.len(a) * Pnt3.len(b);
    let cos = Pnt3.dot(a, b) / magnitudeProduct;
    // this can happen due to precision error
    cos = Math.min(1, Math.max(cos, -1));
    return Math.acos(cos);
  }

  /** rotate point a with quaternion q */
  static rot(p: Point3, q: Point4): Point3 {
    // faster version of:
    // let qvec: Point4 = {x: v.x, y: v.y, z: v.z, w: 0};
    // let qinv: Point4 = {x: -q.x, y: -q.y, z: -q.z, w: q.w};
    // let res = Qtrn.mult(q, Qtrn.mult(qvec, qinv));
    // return {x: res.x, y: res.y, z: res.z};
    const { x, y, z } = p;
    return {
      x:
        q.w * q.w * x +
        2 * q.y * q.w * z -
        2 * q.z * q.w * y +
        q.x * q.x * x +
        2 * q.y * q.x * y +
        2 * q.z * q.x * z -
        q.y * q.y * x -
        q.z * q.z * x,
      y:
        2 * q.x * q.y * x +
        q.y * q.y * y +
        2 * q.z * q.y * z +
        2 * q.w * q.z * x -
        q.z * q.z * y +
        q.w * q.w * y -
        2 * q.x * q.w * z -
        q.x * q.x * y,
      z:
        2 * q.x * q.z * x +
        2 * q.y * q.z * y +
        q.z * q.z * z -
        2 * q.w * q.y * x -
        q.y * q.y * z +
        2 * q.w * q.x * y -
        q.x * q.x * z +
        q.w * q.w * z,
    };
  }

  /** rotate point around axis a (normalized vector) */
  static rotAround(p: Point3, axis: Point3, angle: number): Point3 {
    return this.rot(p, Qtrn.fromAngle(axis, angle));
  }

  /**
   * Converts a cartesian 3D point to a spherical coordinate system, where theta is azimuth and phi is inclination,
   * theta == 0 is faced towards X axis direction, and phi == 0 is faced towards zenith (Z axis)
   * @param p - The cartesian 3D point.
   * @returns The spherical coordinates as an object with radius, theta, and phi properties.
   */
  static toSpherical(p: Point3): Spherical {
    const radius = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    return {
      radius,
      theta: radius == 0 ? 0 : Math.atan2(p.y, p.x),
      phi: radius == 0 ? 0 : Math.atan2(Math.sqrt(p.x * p.x + p.y * p.y), p.z),
    };
  }

  /**
   * Converts a spherical coordinate system to a cartesian 3D point. Used spherical coordinates, where theta is azimuth
   * and phi is inclination, theta == 0 is faced towards X axis direction, and phi == 0 is faced towards zenith (Z axis)
   * @param s - The spherical coordinate system.
   * @returns The cartesian 3D point as an object with x, y, and z properties.
   */
  static fromSpherical(s: Spherical): Point3 {
    return {
      x: s.radius * Math.sin(s.phi) * Math.cos(s.theta),
      y: s.radius * Math.sin(s.phi) * Math.sin(s.theta),
      z: s.radius * Math.cos(s.phi),
    };
  }
}
