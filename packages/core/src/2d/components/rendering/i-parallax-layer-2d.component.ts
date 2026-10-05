import { IDisplayObject2dComponent } from './i-display-object-2d.component';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';
import { ResolvedParallaxLayer2dOpts } from '../../models/environment';
import { Point2 } from '../../../base';

/**
 * A repeating backdrop (or foreground) texture that scrolls at its own rate as the camera moves,
 * created by `IDisplayObject2dComponentFactory.createParallaxLayer` and usually wrapped in a
 * `ParallaxLayer2dEntity`. Every renderer repositions it for its own camera right before drawing, so
 * it needs no ticking and looks right in each view when several renderers share a world. It zooms
 * and rotates with the camera like the rest of the world.
 */
export interface IParallaxLayer2dComponent<
  VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
> extends IDisplayObject2dComponent<VTypeDoc> {
  /** The layer's settings with every default filled in, so passing them back to `createParallaxLayer`
   * reproduces it. `parallax`, `offset` and `zIndex` reflect later changes. */
  readonly layerOptions: ResolvedParallaxLayer2dOpts<VTypeDoc['texture']>;

  /** See `ParallaxLayer2dOpts.parallax`. */
  parallax: Point2;

  /** See `ParallaxLayer2dOpts.offset`. */
  offset: Point2;

  /** Narrows `clone()`'s return type: a cloned layer is still a layer. */
  clone(): IParallaxLayer2dComponent<VTypeDoc>;
}
