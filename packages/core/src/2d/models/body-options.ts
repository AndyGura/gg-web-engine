import { BodyOptions, DebugBodySettings, DebugBodyType } from '../../base';
import { Shape2DDescriptor } from './shapes';

export interface Body2DOptions extends BodyOptions {}

export class DebugBody2DSettings extends DebugBodySettings<Shape2DDescriptor> {
  constructor(
    type: DebugBodyType,
    shape: Shape2DDescriptor,
    ignoreTransform: boolean = false,
    color: number | undefined = undefined,
  ) {
    super(type, shape, ignoreTransform, color);
  }
}
