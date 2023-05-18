import { Point2 } from '../../base/models/points';
import { GgPositionableEntity } from '../../base/entities/gg-positionable-entity';
import { Pnt2 } from '../../base/math/point2';

export abstract class GgPositionable2dEntity extends GgPositionableEntity<Point2, number> {
  getDefaultPosition(): Point2 {
    return Pnt2.O;
  }

  getDefaultRotation(): number {
    return 0;
  }

  getDefaultScale(): Point2 {
    return { x: 1, y: 1 };
  }
}
