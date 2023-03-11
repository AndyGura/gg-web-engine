import { GgPhysicsWorld } from './gg-physics-world';
import { GgEntity } from '../entities/gg-entity';

export interface GgBody<D, R> {
  position: D;
  rotation: R;
  scale: D;

  name: string;

  entity: GgEntity | null;

  addToWorld(world: GgPhysicsWorld<D, R>): void;

  removeFromWorld(world: GgPhysicsWorld<D, R>): void;

  dispose(): void;

  /** clear velocities etc. */
  resetMotion(): void;
}
