import { BodyOptions, DebugBodySettings, DebugBodyType } from '../../base';
import { Shape3DDescriptor } from './shapes';

export interface Body3DOptions extends BodyOptions {}

export class DebugBody3DSettings extends DebugBodySettings<Shape3DDescriptor> {
  constructor(
    type: DebugBodyType,
    shape: Shape3DDescriptor,
    ignoreTransform: boolean = false,
    color: number | undefined = undefined,
  ) {
    super(type, shape, ignoreTransform, color);
  }
}
