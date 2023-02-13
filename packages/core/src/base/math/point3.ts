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
    let qvec: Point4 = {x: v.x, y: v.y, z: v.z, w: 0};
    let qinv: Point4 = {x: -q.x, y: -q.y, z: -q.z, w: q.w};
    let res = Qtrn.mult(q, Qtrn.mult(qvec, qinv));
    return {x: res.x, y: res.y, z: res.z};
  }
}
