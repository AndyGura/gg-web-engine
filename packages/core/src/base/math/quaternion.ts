import { Point4 } from '../models/points';

export class Qtrn {
  /** clone quaternion */
  static clone(q: Point4): Point4 {
    return { ...q };
  }

  /** add quaternion b to quaternion a */
  static add(a: Point4, b: Point4): Point4 {
    const w = a.w + b.w;
    const x = a.x + b.x;
    const y = a.y + b.y;
    const z = a.z + b.z;
    const magnitude = Math.sqrt(w * w + x * x + y * y + z * z);
    return { w: w / magnitude, x: x / magnitude, y: y / magnitude, z: z / magnitude };
  }

  static mult(a: Point4, b: Point4): Point4 {
    return {
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
    };
  }

  static combineRotations(...quaternions: Point4[]): Point4 {
    let result = {w: 1, x: 0, y: 0, z: 0};
    for (const quat of quaternions) {
      result = this.mult(result, quat);
    }
    return result;
  }


  static lerp(a: Point4, b: Point4, t: number): Point4 {
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      z: a.z + t * (b.z - a.z),
      w: a.w + t * (b.w - a.w)
    };
  }

  static slerp(a: Point4, b: Point4, t: number): Point4 {
    let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    let theta = Math.acos(dot);
    let sinTheta = Math.sin(theta);

    let x = a.x * Math.sin((1 - t) * theta) / sinTheta + b.x * Math.sin(t * theta) / sinTheta;
    let y = a.y * Math.sin((1 - t) * theta) / sinTheta + b.y * Math.sin(t * theta) / sinTheta;
    let z = a.z * Math.sin((1 - t) * theta) / sinTheta + b.z * Math.sin(t * theta) / sinTheta;
    let w = a.w * Math.sin((1 - t) * theta) / sinTheta + b.w * Math.sin(t * theta) / sinTheta;

    return { x, y, z, w };
  }
}
