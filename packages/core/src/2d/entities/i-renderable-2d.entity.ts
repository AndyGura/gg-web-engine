import { IRenderableEntity, Point2 } from '../../base';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from '../gg-2d-world';

export abstract class IRenderable2dEntity<
  TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo,
> extends IRenderableEntity<Point2, number, TypeDoc> {
  protected _world: Gg2dWorld<TypeDoc> | null = null;
  get world(): Gg2dWorld<TypeDoc> | null {
    return this._world;
  }
}
