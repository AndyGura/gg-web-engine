import { Point2 } from '../../base';
import { Body2DOptions } from './body-options';

export type Shape2DDescriptor = { collisionMargin?: number } & (
  | { shape: 'SQUARE'; dimensions: Point2 } // TODO rename to "BOX"
  | { shape: 'CIRCLE'; radius: number }
  | { shape: 'CAPSULE'; radius: number; centersDistance: number }
  | { shape: 'CONVEX_HULL'; vertices: Point2[] }
  | { shape: 'POLYGON'; vertices: Point2[] }
);
// TODO implement these
// | { shape: 'COMPOUND'; children: {
//   position?: Point2;
//   rotation?: number;
//   shape: Shape2DDescriptor;
// }[] }

export type BodyShape2DDescriptor = { shape: Shape2DDescriptor; body: Partial<Body2DOptions> };
