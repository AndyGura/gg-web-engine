import { PhysicsTypeDocRepo } from '../../gg-world';
import { IComponent } from '../i-component';
import { CollisionGroup } from '../../models/body-options';
import { Subject } from 'rxjs';

export interface IPhysicsWorldComponent<D, R, TypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IComponent {
  readonly factory: TypeDoc['factory'];
  gravity: D;

  /** event emitter, emits newly added physics components */
  readonly added$: Subject<TypeDoc['rigidBody'] | TypeDoc['trigger'] | any>;
  /** event emitter, emits just removed physics components */
  readonly removed$: Subject<TypeDoc['rigidBody'] | TypeDoc['trigger'] | any>;
  /** list of currently added to world physics components */
  readonly children: (TypeDoc['rigidBody'] | TypeDoc['trigger'] | any)[];

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
