import { IEntity, Point2, TickOrder } from '../../base';
import { Gg2dWorldTypeDocVPatch, VisualTypeDocRepo2D } from '../gg-2d-world';

/**
 * Wraps a parallax layer component (`VTypeDoc['parallaxLayer']`, see `IParallaxLayer2dComponent`)
 * so it can be added to a world, found by name and removed with its level. Created by
 * `Gg2dWorld.addParallaxLayer` or the `"ParallaxLayer"` level-JSON class. The layer positions
 * itself from each renderer's camera, so this entity has nothing to do per tick.
 * @template VTypeDoc - The visual type document repository
 */
export class ParallaxLayer2dEntity<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D> extends IEntity<
  Point2,
  number,
  Gg2dWorldTypeDocVPatch<VTypeDoc>
> {
  static readonly entityTypeName: string = 'ParallaxLayer2dEntity';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  constructor(public readonly layer: VTypeDoc['parallaxLayer']) {
    super();
    this.addComponents(this.layer);
  }
}
