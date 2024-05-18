import { IRenderableEntity, Point2 } from '../../base';
import { Gg2dWorld, PhysicsTypeDocRepo2D, VisualTypeDocRepo2D } from '../gg-2d-world';

export abstract class IRenderable2dEntity<
  TypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
  PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D,
> extends IRenderableEntity<Point2, number, TypeDoc, PTypeDoc> {
  protected _world: Gg2dWorld<TypeDoc, PTypeDoc> | null = null;
  get world(): Gg2dWorld<TypeDoc, PTypeDoc> | null {
    return this._world;
  }
}
