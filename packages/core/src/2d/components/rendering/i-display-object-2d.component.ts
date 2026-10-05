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

  /**
   * A color multiplied over this object's own colors, e.g. to color a white or grayscale sprite per
   * player. `0xffffff` (the default) leaves the colors unchanged. Applies to every child added with
   * `addChild` too.
   */
  tint: number;

  /**
   * Opacity from `0` (invisible) to `1` (opaque, the default). Applies to every child added with
   * `addChild` too, multiplied with the child's own opacity.
   */
  opacity: number;
}
