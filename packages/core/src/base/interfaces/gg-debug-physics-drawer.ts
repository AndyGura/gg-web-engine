import { Point3 } from '../models/points';
import { GgObject } from './gg-object';

export interface GgDebugPhysicsDrawer<D, R> extends GgObject<D, R> {
  drawContactPoint(point: D, normal: D, color?: Point3): void;

  drawLine(from: D, to: D, color?: Point3): void;

  update(): void;
}
