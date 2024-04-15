import { GgWorld, PhysicsTypeDocRepo } from '../../gg-world';
import { IDebugPhysicsDrawer } from '../../interfaces/i-debug-physics-drawer';
import { IComponent } from '../i-component';
import { CollisionGroup } from '../../models/body-options';

export interface IPhysicsWorldComponent<D, R, TypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IComponent {
  readonly factory: TypeDoc['factory'];
  gravity: D;

  get physicsDebugViewActive(): boolean;

  init(): Promise<void>;

  /**
   * Runs simulation of the physics world.
   *
   * @param delta delta time from last tick in milliseconds.
   */
  simulate(delta: number): void;

  registerCollisionGroup(): CollisionGroup;

  deregisterCollisionGroup(group: CollisionGroup): void;

  startDebugger(world: GgWorld<D, R>, drawer: IDebugPhysicsDrawer<D, R>): void;

  stopDebugger(world: GgWorld<D, R>): void;
}
