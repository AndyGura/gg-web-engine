import { Point2 } from '../../base/models/points';
import { Body2DOptions } from './body-options';

export type Shape2DDescriptor = (
  { shape: 'SQUARE', dimensions: Point2 }
  | { shape: 'CIRCLE', radius: number }
  // TODO add more
  );

export type BodyShape2DDescriptor = Partial<Body2DOptions> & Shape2DDescriptor;
