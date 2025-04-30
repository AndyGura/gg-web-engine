import { IRenderableEntity, Point3, Point4 } from '../../base';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../gg-3d-world';

export abstract class IRenderable3dEntity<
  TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo,
> extends IRenderableEntity<Point3, Point4, TypeDoc> {
  protected _world: Gg3dWorld<TypeDoc> | null = null;
  get world(): Gg3dWorld<TypeDoc> | null {
    return this._world;
  }
}
