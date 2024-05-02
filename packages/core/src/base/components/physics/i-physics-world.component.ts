import { PhysicsTypeDocRepo } from '../../gg-world';
import { IComponent } from '../i-component';
import { CollisionGroup } from '../../models/body-options';
import { Subject } from 'rxjs';
import { IBodyComponent } from './i-body.component';

export interface IPhysicsWorldComponent<D, R, TypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IComponent {
  readonly factory: TypeDoc['factory'];
  gravity: D;

  readonly added$: Subject<IBodyComponent<D, R, TypeDoc>>;
  readonly removed$: Subject<IBodyComponent<D, R, TypeDoc>>;

  init(): Promise<void>;

  /**
   * Runs simulation of the physics world.
   *
   * @param delta delta time from last tick in milliseconds.
   */
  simulate(delta: number): void;

  registerCollisionGroup(): CollisionGroup;

  deregisterCollisionGroup(group: CollisionGroup): void;
}
