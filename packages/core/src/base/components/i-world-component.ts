import { IEntity } from '../entities/i-entity';
import { GgWorld, PhysicsTypeDocRepo, VisualTypeDocRepo } from '../gg-world';

export interface IWorldComponent<
  D,
  R,
  VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>,
  PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>,
> {
  entity: IEntity | null;

  addToWorld(world: GgWorld<D, R, VTypeDoc, PTypeDoc>): void;

  removeFromWorld(world: GgWorld<D, R, VTypeDoc, PTypeDoc>, dispose?: boolean): void;

  dispose(): void;
}
