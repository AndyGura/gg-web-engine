import { BodyOptions, DebugBodySettings } from '../../base';
import { Shape2DDescriptor } from './shapes';

export interface Body2DOptions extends BodyOptions {}

export type DebugBody2DSettings = DebugBodySettings & { shape: Shape2DDescriptor };
