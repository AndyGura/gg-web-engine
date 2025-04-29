import { IEntity } from '../entities/i-entity';
import { GgWorld, GgWorldTypeDocRepo } from '../gg-world';
import { IComponent } from './i-component';

export interface IWorldComponent<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>>
  extends IComponent {
  entity: IEntity | null;

  addToWorld(world: GgWorld<D, R, TypeDoc>): void;

  removeFromWorld(world: GgWorld<D, R, TypeDoc>, dispose?: boolean): void;
}
