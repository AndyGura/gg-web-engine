import { IRenderableEntity, Point3, Point4 } from '../../base';
import { Gg3dWorld, PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from '../gg-3d-world';

export abstract class IRenderable3dEntity<
  TypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
> extends IRenderableEntity<Point3, Point4, TypeDoc, PTypeDoc> {
  protected _world: Gg3dWorld<TypeDoc, PTypeDoc> | null = null;
  get world(): Gg3dWorld<TypeDoc, PTypeDoc> | null {
    return this._world;
  }
}
