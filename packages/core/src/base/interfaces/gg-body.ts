import { GgPhysicsWorld } from './gg-physics-world';

export interface GgBody<D, R> {
  position: D;
  rotation: R;
  scale: D;

  name: string;

  addToWorld(world: GgPhysicsWorld<D, R>): void;

  removeFromWorld(world: GgPhysicsWorld<D, R>): void;

  dispose(): void;
}
