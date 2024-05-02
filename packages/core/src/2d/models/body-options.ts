import { BodyOptions } from '../../base';
import { Shape2DDescriptor } from './shapes';

export interface Body2DOptions extends BodyOptions {}

export type DebugBody2DSettings = {
  shape: Shape2DDescriptor;
  color: number;
};
