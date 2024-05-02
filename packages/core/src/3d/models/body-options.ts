import { BodyOptions } from '../../base';
import { Shape3DDescriptor } from './shapes';

export interface Body3DOptions extends BodyOptions {}

export type DebugBody3DSettings = {
  shape: Shape3DDescriptor;
  color: number;
};
