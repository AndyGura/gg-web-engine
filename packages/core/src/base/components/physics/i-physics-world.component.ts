import { PhysicsTypeDocRepo } from '../../gg-world';
import { IComponent } from '../i-component';
import { CollisionGroup } from '../../models/body-options';
import { Subject } from 'rxjs';
import { RaycastOptions, RaycastResult } from '../../models/raycasting';

/**
 * Interface representing a physics world component.
 *
 * @template D - Data type used for representing physics properties.
 * @template R - Type representing the physics engine's rigid body.
 * @template TypeDoc - Physics typings repository.
 */
export interface IPhysicsWorldComponent<D, R, PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IComponent {
  /**
   * Factory function for creating physics-related objects.
   */
  readonly factory: PTypeDoc['factory'];

  /**
   * The gravity vector affecting the physics world.
   */
  gravity: D;

  /**
   * Event emitter that emits newly added physics components.
   */
  readonly added$: Subject<PTypeDoc['rigidBody'] | PTypeDoc['trigger'] | any>;

  /**
   * Event emitter that emits just removed physics components.
   */
  readonly removed$: Subject<PTypeDoc['rigidBody'] | PTypeDoc['trigger'] | any>;

  /**
   * List of currently added physics components in the world.
   */
  readonly children: (PTypeDoc['rigidBody'] | PTypeDoc['trigger'] | any)[];

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

  /**
   * Performs a raycast in the physics world.
   *
   * @param options - The options for the raycast.
   * @returns The result of the raycast.
   */
  raycast(options: RaycastOptions<D>): RaycastResult<D, PTypeDoc['rigidBody'] | PTypeDoc['trigger']>;
}
