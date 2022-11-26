import { Point3, Point4 } from '../../base/models/points';
import { Body3DOptions } from './body-options';

export type GgDummy = { name: string, position: Point3, rotation: Point4 } & any;
export type GgCurve = { name: string, cyclic: boolean, points: Point3[] } & any;
export type GgRigidBody = { name: string, position: Point3, rotation: Point4, } & BodyPrimitiveDescriptor;

export type BodyPrimitiveDescriptor = Partial<Body3DOptions> & (
  { shape: 'BOX', dimensions: Point3 } |
  { shape: 'CONE' | 'CYLINDER', radius: number, height: number } |
  { shape: 'CAPSULE', radius: number, centersDistance: number } |
  { shape: 'SPHERE', radius: number } |
  { shape: 'COMPOUND', children: BodyPrimitiveDescriptor[] } |
  { shape: 'CONVEX_HULL', vertices: Point3[] } |
  { shape: 'MESH', vertices: Point3[], faces: [number, number, number][] }
);

export type GgMeta = {
  dummies: GgDummy[],
  curves: GgCurve[],
  rigidBodies: GgRigidBody[],
}
