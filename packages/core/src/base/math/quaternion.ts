import { Point3, Point4 } from '../models/points';
import { Pnt3 } from './point3';
import { Mtrx4 } from './matrix4';

/**
 * Helper class with static functions, containing util functions, related to Quaternion (represented as Point4 type).
 * In terms of rotation, a quaternion is a mathematical representation of an orientation or rotation in 3D space.
 * It consists of a scalar component and a vector component, and can be written as q = w + xi + yj + zk, where w is the
 * scalar component, and i, j, and k are the vector components. The scalar component, w, represents the amount of
 * rotation, and the vector component, (x, y, z), represents the axis of rotation. The length of the vector component
 * represents the amount of rotation around the axis. Quaternions are often used in 3D computer graphics and animation
 * because they can be used to interpolate between two rotations, and they can avoid some of the issues with using
 * Euler angles (such as gimbal lock).
 */
export class Qtrn {
  /** empty rotation */
  static get O(): Point4 {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  /**
   * Returns a new quaternion instance with the same values as the given quaternion object.
   * @param q The Point4 object to clone.
   * @returns A new Point4 instance with the same values as the given Point4 object.
   */
  static clone(q: Point4): Point4 {
    return { x: q.x, y: q.y, z: q.z, w: q.w };
  }

  /** spread quaternion components */
  static spr(p: Point4): [number, number, number, number] {
    return [p.x, p.y, p.z, p.w];
  }

  /**
   * Returns the sum of two Point4 objects.
   * @param a The first Point4 object to add.
   * @param b The second Point4 object to add.
   * @returns The sum of the two Point4 objects.
   */
  static add(a: Point4, b: Point4): Point4 {
    const w = a.w + b.w;
    const x = a.x + b.x;
    const y = a.y + b.y;
    const z = a.z + b.z;
    const magnitude = Math.sqrt(w * w + x * x + y * y + z * z);
    return { w: w / magnitude, x: x / magnitude, y: y / magnitude, z: z / magnitude };
  }

  /**
   * Returns the result of multiplying two Point4 objects. This can be used for combining rotations
   * @param a The first Point4 object to multiply.
   * @param b The second Point4 object to multiply.
   * @returns The product of the two Point4 objects.
   */
  static mult(a: Point4, b: Point4): Point4 {
    return {
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    };
  }

  /**
   * Calculates and returns the conjugate of a quaternion.
   * The conjugate of a quaternion is obtained by changing the sign of its vector components.
   * @param q The Point4 (quaternion) object.
   * @returns The conjugate of the quaternion passed as argument.
   */
  static conjugate(q: Point4): Point4 {
    return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  }

  /**
   * Returns the opposite of a quaternion.
   * It's obtained by negating all quaternion elements(x, y, z and w).
   * @param q The Point4 (quaternion) object.
   * @returns The opposite of the quaternion passed as argument.
   */
  static opposite(q: Point4): Point4 {
    return { x: -q.x, y: -q.y, z: -q.z, w: -q.w };
  }

  /**
   * Combines an arbitrary number of quaternions by multiplying them together in order.
   * @param quaternions The quaternions to combine.
   * @returns The combined quaternion.
   */
  static combineRotations(...quaternions: Point4[]): Point4 {
    let result = { w: 1, x: 0, y: 0, z: 0 };
    for (const quat of quaternions) {
      result = this.mult(result, quat);
    }
    return result;
  }

  /**
   * Performs a linear interpolation between two Point4 objects.
   * @param a The first Point4 object.
   * @param b The second Point4 object.
   * @param t The interpolation factor.
   * @returns The interpolated Point4 object.
   */
  static lerp(a: Point4, b: Point4, t: number): Point4 {
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      z: a.z + t * (b.z - a.z),
      w: a.w + t * (b.w - a.w),
    };
  }

  /**
   * Performs a spherical linear interpolation between two Point4 objects.
   * @param a The first Point4 object.
   * @param b The second Point4 object.
   * @param t The interpolation factor.
   * @returns The interpolated Point4 object.
   */
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

  /**
   * Converts an angle and an axis of rotation into a quaternion
   * @param axis the axis of rotation
   * @param angle the angle of rotation in radians
   * @returns a quaternion representing the rotation
   */
  static fromAngle(axis: Point3, angle: number) {
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
    const halfAngle = angle / 2,
      s = Math.sin(halfAngle);
    return {
      ...Pnt3.scalarMult(axis, s),
      w: Math.cos(halfAngle),
    };
  }

  /**
   * Converts a 4x4 matrix representing a rotation into a quaternion
   * @param m the matrix representing the rotation
   * @returns a quaternion representing the rotation
   */
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

  /**
   * Creates a quaternion from euler
   * @param e the euler vector
   * @returns a quaternion representing the rotation
   */
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

  /**
   * Converts a quaternion to euler
   * @param q Point4 object
   * @returns an Euler vector, representing the same rotation
   */
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

  /**
   * Returns a quaternion that represents the rotation required to align an object to face towards a target point.
   * @param eye - The position of the camera or object that needs to be rotated to face the target point.
   * @param target - The target point to look at
   * @param up - The up direction of the object
   * @returns A new quaternion representing the rotation required to face towards the target point.
   */
  static lookAt(eye: Point3, target: Point3, up: Point3 = Pnt3.Z): Point4 {
    return this.fromMatrix4(Mtrx4.lookAt(eye, target, up));
  }

  /**
   * Returns a quaternion that represents the input quaternion, rotated around provided axis vector by provided angle.
   * Assumes that axis vector is already normalized
   * @param q - Input quaternion.
   * @param axis - Axis vector
   * @param angle - Angle
   * @returns A new quaternion representing the updated rotation.
   */
  static rotAround(q: Point4, axis: Point3, angle: number): Point4 {
    const sinHalfAngle = Math.sin(angle / 2);
    const rotationQuat = {
      w: Math.cos(angle / 2),
      x: axis.x * sinHalfAngle,
      y: axis.y * sinHalfAngle,
      z: axis.z * sinHalfAngle,
    };
    return this.mult(rotationQuat, q);
  }
}
