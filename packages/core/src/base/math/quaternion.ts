import { Point3, Point4 } from '../models/points';
import { Pnt3 } from './point3';
import { Mtrx4 } from './matrix4';

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
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    };
  }

  static combineRotations(...quaternions: Point4[]): Point4 {
    let result = { w: 1, x: 0, y: 0, z: 0 };
    for (const quat of quaternions) {
      result = this.mult(result, quat);
    }
    return result;
  }

  /** linear interpolation */
  static lerp(a: Point4, b: Point4, t: number): Point4 {
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      z: a.z + t * (b.z - a.z),
      w: a.w + t * (b.w - a.w),
    };
  }

  /** spherical interpolation */
  static slerp(a: Point4, b: Point4, t: number): Point4 {
    let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    let theta = Math.acos(dot);
    let sinTheta = Math.sin(theta);

    let x = (a.x * Math.sin((1 - t) * theta)) / sinTheta + (b.x * Math.sin(t * theta)) / sinTheta;
    let y = (a.y * Math.sin((1 - t) * theta)) / sinTheta + (b.y * Math.sin(t * theta)) / sinTheta;
    let z = (a.z * Math.sin((1 - t) * theta)) / sinTheta + (b.z * Math.sin(t * theta)) / sinTheta;
    let w = (a.w * Math.sin((1 - t) * theta)) / sinTheta + (b.w * Math.sin(t * theta)) / sinTheta;

    if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(w)) {
      // happens when they are equal
      return Qtrn.clone(a);
    }
    return { x, y, z, w };
  }

  /** creates quaternion from simple angle around axis. Assumes that axis vector is normalized */
  static fromAngle(axis: Point3, angle: number) {
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
    const halfAngle = angle / 2,
      s = Math.sin(halfAngle);
    return {
      ...Pnt3.scalarMult(axis, s),
      w: Math.cos(halfAngle),
    };
  }

  /** creates quaternion from 4-dimension rotation matrix */
  static fromMatrix4(m: number[]): Point4 {
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
    const m11 = m[0],
      m12 = m[4],
      m13 = m[8],
      m21 = m[1],
      m22 = m[5],
      m23 = m[9],
      m31 = m[2],
      m32 = m[6],
      m33 = m[10],
      trace = m11 + m22 + m33;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      return {
        x: (m32 - m23) * s,
        y: (m13 - m31) * s,
        z: (m21 - m12) * s,
        w: 0.25 / s,
      };
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
      return {
        x: 0.25 * s,
        y: (m12 + m21) / s,
        z: (m13 + m31) / s,
        w: (m32 - m23) / s,
      };
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
      return {
        x: (m12 + m21) / s,
        y: 0.25 * s,
        z: (m23 + m32) / s,
        w: (m13 - m31) / s,
      };
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
      return {
        x: (m13 + m31) / s,
        y: (m23 + m32) / s,
        z: 0.25 * s,
        w: (m21 - m12) / s,
      };
    }
  }

  /** creates a quaternion from euler */
  static fromEuler(e: Point3): Point4 {
    const roll = e.x;
    const pitch = e.y;
    const yaw = e.z;

    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    const qw = cr * cp * cy + sr * sp * sy;
    const qx = sr * cp * cy - cr * sp * sy;
    const qy = cr * sp * cy + sr * cp * sy;
    const qz = cr * cp * sy - sr * sp * cy;

    return { w: qw, x: qx, y: qy, z: qz };
  }

  /** converts a quaternion to euler */
  static toEuler(q: Point4): Point3 {
    const qw = q.w;
    const qx = q.x;
    const qy = q.y;
    const qz = q.z;

    const sinr_cosp = 2 * (qw * qx + qy * qz);
    const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (qw * qy - qz * qx);
    const pitch = Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp);

    const siny_cosp = 2 * (qw * qz + qx * qy);
    const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return { x: roll, y: pitch, z: yaw };
  }

  /** creates a rotation for object, so it will look at some point in space */
  static lookAt(eye: Point3, target: Point3, up: Point3): Point4 {
    return this.fromMatrix4(Mtrx4.lookAt(eye, target, up));
  }
}
