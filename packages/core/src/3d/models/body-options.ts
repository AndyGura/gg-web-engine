import { BodyOptions, DebugBodySettings } from '../../base';
import { Shape3DDescriptor } from './shapes';

export interface Body3DOptions extends BodyOptions {}

export type DebugBody3DSettings = DebugBodySettings & { shape: Shape3DDescriptor };
