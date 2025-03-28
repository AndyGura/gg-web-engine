import { Point2, Point3, Point4 } from '../../base';
import { Body3DOptions } from './body-options';

export type Shape3DDescriptor = { collisionMargin?: number } & (
  | { shape: 'PLANE' }
  | { shape: 'BOX'; dimensions: Point3 }
  | { shape: 'CONE' | 'CYLINDER'; radius: number; height: number }
  | { shape: 'CAPSULE'; radius: number; centersDistance: number }
  | { shape: 'SPHERE'; radius: number }
  | { shape: 'COMPOUND'; children: { position?: Point3; rotation?: Point4; shape: Shape3DDescriptor }[] }
  | { shape: 'CONVEX_HULL'; vertices: Point3[] }
  | { shape: 'MESH'; vertices: Point3[]; faces: [number, number, number][] }
);

export type Shape3DMeshDescriptor =
  | { shape: 'PLANE'; dimensions?: Point2; segments?: Point2 }
  | { shape: 'BOX'; dimensions: Point3; segments?: Point3 }
  | { shape: 'CONE' | 'CYLINDER'; radius: number; height: number; radialSegments?: number; heightSegments?: number }
  | { shape: 'CAPSULE'; radius: number; centersDistance: number; capSegments?: number; radialSegments?: number }
  | { shape: 'SPHERE'; radius: number; widthSegments?: number; heightSegments?: number }
  | { shape: 'COMPOUND'; children: { position?: Point3; rotation?: Point4; shape: Shape3DMeshDescriptor }[] }
  | { shape: 'CONVEX_HULL'; vertices: Point3[] }
  | { shape: 'MESH'; vertices: Point3[]; faces: [number, number, number][] };

export type BodyShape3DDescriptor = { shape: Shape3DDescriptor; body: Partial<Body3DOptions> };
