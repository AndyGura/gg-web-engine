import { Point2 } from '../../base';
import { Body2DOptions } from './body-options';

export type Shape2DDescriptor = { shape: 'SQUARE'; dimensions: Point2 } | { shape: 'CIRCLE'; radius: number };
// TODO add more shapes

export type BodyShape2DDescriptor = { shape: Shape2DDescriptor; body: Partial<Body2DOptions> };
