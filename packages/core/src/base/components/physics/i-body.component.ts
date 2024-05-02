import { IEntity } from '../../entities/i-entity';
import { IWorldComponent } from '../i-world-component';
import { GgWorld, PhysicsTypeDocRepo, VisualTypeDocRepo } from '../../gg-world';
import { CollisionGroup, DebugBodySettings } from '../../models/body-options';

export interface IBodyComponent<D, R, TypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, VisualTypeDocRepo<D, R>, TypeDoc> {
  entity: IEntity | null;

  position: D;
  rotation: R;

  name: string;

  get ownCollisionGroups(): CollisionGroup[];

  set ownCollisionGroups(value: CollisionGroup[] | 'all');

  get interactWithCollisionGroups(): CollisionGroup[];

  set interactWithCollisionGroups(value: CollisionGroup[] | 'all');

  readonly debugBodySettings: DebugBodySettings;

  clone(): IBodyComponent<D, R, TypeDoc>;

  addToWorld(world: GgWorld<D, R, VisualTypeDocRepo<D, R>, TypeDoc>): void;

  removeFromWorld(world: GgWorld<D, R, VisualTypeDocRepo<D, R>, TypeDoc>): void;
}
