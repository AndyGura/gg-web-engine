import { Point3, Point4 } from '../models/points';
import { Qtrn } from './quaternion';

export class Pnt3 {
  /** clone point */
  static clone(p: Point3): Point3 {
    return { ...p };
  }

  /** add point b to point a */
  static add(a: Point3, b: Point3): Point3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  /** subtract point b from point a */
  static sub(a: Point3, b: Point3): Point3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  /** calculate vector length (squared) */
  static lenSq(v: Point3) {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  }

  /** calculate vector length */
  static len(v: Point3) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /** cross vectors */
  static cross(a: Point3, b: Point3): Point3 {
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    return {
      x: ay * bz - az * by,
      y: az * bx - ax * bz,
      z: ax * by - ay * bx,
    }
  }

  /** normalize */
  static norm(p: Point3): Point3 {
    const length = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
    if (length === 0) {
      return p;
    }
    return {
      x: p.x / length,
      y: p.y / length,
      z: p.z / length
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

  /** rotate point a with quaternion q */
  static rot(p: Point3, q: Point4): Point3 {
    // faster version of:
    // let qvec: Point4 = {x: v.x, y: v.y, z: v.z, w: 0};
    // let qinv: Point4 = {x: -q.x, y: -q.y, z: -q.z, w: q.w};
    // let res = Qtrn.mult(q, Qtrn.mult(qvec, qinv));
    // return {x: res.x, y: res.y, z: res.z};
    const { x, y, z } = p;
    return {
      x: q.w * q.w * x + 2 * q.y * q.w * z - 2 * q.z * q.w * y + q.x * q.x * x + 2 * q.y * q.x * y + 2 * q.z * q.x * z - q.y * q.y * x - q.z * q.z * x,
      y: 2 * q.x * q.y * x + q.y * q.y * y + 2 * q.z * q.y * z + 2 * q.w * q.z * x - q.z * q.z * y + q.w * q.w * y - 2 * q.x * q.w * z - q.x * q.x * y,
      z: 2 * q.x * q.z * x + 2 * q.y * q.z * y + q.z * q.z * z - 2 * q.w * q.y * x - q.y * q.y * z + 2 * q.w * q.x * y - q.x * q.x * z + q.w * q.w * z
    };
  }

  /** rotate point around axis a (normalized vector) */
  static rotAround(p: Point3, axis: Point3, angle: number): Point3 {
    return this.rot(p, Qtrn.fromAngle(axis, angle));
  }
}
