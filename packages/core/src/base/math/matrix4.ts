import { Point3, Point4 } from '../models/points';
import { Pnt3 } from './point3';

export class Mtrx4 {
  /** creates a rotation matrix for object, so it will look at some point in space */
  static lookAt(eye: Point3, target: Point3, up: Point3): number[] {
    let z: Point3 = Pnt3.sub(eye, target);
    if (Pnt3.lenSq(z) === 0) {
      // same position
      z = { ...z, z: 1 };
    } else {
      z = Pnt3.norm(z);
    }
    let x = Pnt3.cross(up, z);
    if (Pnt3.lenSq(x) === 0) {
      // up and z are parallel
      if (Math.abs(up.z) === 1) {
        z = { ...z, x: z.x + 0.0001 };
      } else {
        z = { ...z, z: z.z + 0.0001 };
      }
      z = Pnt3.norm(z);
      x = Pnt3.cross(up, z);
    }
    x = Pnt3.norm(x);
    let y = Pnt3.cross(z, x);
    return [x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0];
  }
}
