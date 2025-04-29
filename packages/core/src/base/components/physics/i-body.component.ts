import { IEntity } from '../../entities/i-entity';
import { IWorldComponent } from '../i-world-component';
import { GgWorld, GgWorldTypeDocRepo, PhysicsTypeDocRepo } from '../../gg-world';
import { CollisionGroup, DebugBodySettings } from '../../models/body-options';

export interface IBodyComponent<D, R, PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, GgWorldTypeDocRepo<D, R> & { pTypeDoc: PTypeDoc }> {
  entity: IEntity | null;

  position: D;
  rotation: R;

  name: string;

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup>;

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all');

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup>;

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all');

  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBodySettings<any>;

  clone(): IBodyComponent<D, R, PTypeDoc>;

  addToWorld(world: GgWorld<D, R, GgWorldTypeDocRepo<D, R> & { pTypeDoc: PTypeDoc }>): void;

  removeFromWorld(world: GgWorld<D, R, GgWorldTypeDocRepo<D, R> & { pTypeDoc: PTypeDoc }>): void;
}
