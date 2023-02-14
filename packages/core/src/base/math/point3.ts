import { Point2, Point3, Point4 } from '../models/points';
import { Qtrn } from './quaternion';

export class Pnt3 {
  /** clone point */
  static clone(p: Point3): Point3 {
    return {...p};
  }
  /** add point b to point a */
  static add(a: Point3, b: Point3): Point3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }
  /** rotate point a with quaternion q */
  static rot(v: Point3, q: Point4): Point3 {
    // faster version of:
    // let qvec: Point4 = {x: v.x, y: v.y, z: v.z, w: 0};
    // let qinv: Point4 = {x: -q.x, y: -q.y, z: -q.z, w: q.w};
    // let res = Qtrn.mult(q, Qtrn.mult(qvec, qinv));
    // return {x: res.x, y: res.y, z: res.z};
    const { x, y, z } = v;
    return {
      x: q.w * q.w * x + 2 * q.y * q.w * z - 2 * q.z * q.w * y + q.x * q.x * x + 2 * q.y * q.x * y + 2 * q.z * q.x * z - q.y * q.y * x - q.z * q.z * x,
      y: 2 * q.x * q.y * x + q.y * q.y * y + 2 * q.z * q.y * z + 2 * q.w * q.z * x - q.z * q.z * y + q.w * q.w * y - 2 * q.x * q.w * z - q.x * q.x * y,
      z: 2 * q.x * q.z * x + 2 * q.y * q.z * y + q.z * q.z * z - 2 * q.w * q.y * x - q.y * q.y * z + 2 * q.w * q.x * y - q.x * q.x * z + q.w * q.w * z
    };
  }
}
