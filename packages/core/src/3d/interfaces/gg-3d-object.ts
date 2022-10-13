import { Point3, Point4 } from '../../base/models/points';
import { GgObject } from '../../base/interfaces/gg-object';

export interface Gg3dObject extends GgObject<Point3, Point3> {
  quaternion: Point4;
}
