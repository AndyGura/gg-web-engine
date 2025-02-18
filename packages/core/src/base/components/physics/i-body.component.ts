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

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup>;

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all');

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup>;

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all');

  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBodySettings;

  clone(): IBodyComponent<D, R, TypeDoc>;

  addToWorld(world: GgWorld<D, R, VisualTypeDocRepo<D, R>, TypeDoc>): void;

  removeFromWorld(world: GgWorld<D, R, VisualTypeDocRepo<D, R>, TypeDoc>): void;
}
