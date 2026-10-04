import { IDisplayObjectComponent, Point2 } from '../../../base';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';

export interface IDisplayObject2dComponent<
  VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
> extends IDisplayObjectComponent<Point2, number, VTypeDoc> {
  /**
   * Draw order: objects with a higher `zIndex` are drawn on top of lower ones, and equal values keep
   * the order they were added in. Default `0`. Parallax layers default to `-1` (behind the world).
   */
  zIndex: number;
}
