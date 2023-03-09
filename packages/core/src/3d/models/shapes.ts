import { Point3, Point4 } from '../../base/models/points';
import { Body3DOptions } from './body-options';

export type Shape3DDescriptor = (
  { shape: 'BOX', dimensions: Point3 }
  | { shape: 'CONE' | 'CYLINDER', radius: number, height: number }
  | { shape: 'CAPSULE', radius: number, centersDistance: number }
  | { shape: 'SPHERE', radius: number }
  | { shape: 'COMPOUND', children: (Shape3DDescriptor & { position?: Point3, rotation?: Point4 })[] }
  | { shape: 'CONVEX_HULL', vertices: Point3[] }
  | { shape: 'MESH', vertices: Point3[], faces: [number, number, number][] }
  );

export type BodyShape3DDescriptor = Partial<Body3DOptions> & Shape3DDescriptor
