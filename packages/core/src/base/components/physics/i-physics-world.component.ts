import { PhysicsTypeDocRepo } from '../../gg-world';
import { IComponent } from '../i-component';
import { CollisionGroup } from '../../models/body-options';
import { Subject } from 'rxjs';

/**
 * Interface representing a physics world component.
 *
 * @template D - Data type used for representing physics properties.
 * @template R - Type representing the physics engine's rigid body.
 * @template TypeDoc - Physics typings repository.
 */
export interface IPhysicsWorldComponent<D, R, TypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IComponent {
  /**
   * Factory function for creating physics-related objects.
   */
  readonly factory: TypeDoc['factory'];

  /**
   * The gravity vector affecting the physics world.
   */
  gravity: D;

  /**
   * Event emitter that emits newly added physics components.
   */
  readonly added$: Subject<TypeDoc['rigidBody'] | TypeDoc['trigger'] | any>;

  /**
   * Event emitter that emits just removed physics components.
   */
  readonly removed$: Subject<TypeDoc['rigidBody'] | TypeDoc['trigger'] | any>;

  /**
   * List of currently added physics components in the world.
   */
  readonly children: (TypeDoc['rigidBody'] | TypeDoc['trigger'] | any)[];

  /**
   * The main collision group. All physics bodies have this collision group set by default.
   */
  readonly mainCollisionGroup: CollisionGroup;

  /**
   * Initializes the physics world component.
   *
   * @returns A promise that resolves when initialization is complete.
   */
  init(): Promise<void>;

  /**
   * Runs the simulation of the physics world for the given time step.
   *
   * @param delta - The time step in milliseconds since the last update.
   */
  simulate(delta: number): void;

  /**
   * Registers and returns a new collision group.
   *
   * @returns A newly registered collision group.
   */
  registerCollisionGroup(): CollisionGroup;

  /**
   * Deregisters a previously registered collision group.
   *
   * @param group - The collision group to be removed.
   */
  deregisterCollisionGroup(group: CollisionGroup): void;
}
