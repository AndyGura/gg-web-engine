import { GgDebugPhysicsDrawer } from './gg-debug-physics-drawer';
import { GgWorld } from '../gg-world';

export interface GgPhysicsWorld<D, R> {
  readonly factory: any; // type defined in sub-interfaces
  gravity: D;
  timeScale: number;
  get physicsDebugViewActive(): boolean;

  init(): Promise<void>;

  /**
   * Runs simulation of the physics world.
   *
   * @param delta delta time from last tick in milliseconds.
   */
  simulate(delta: number): void;

  startDebugger(world: GgWorld<D, R>, drawer: GgDebugPhysicsDrawer<D, R>): void;

  stopDebugger(world: GgWorld<D, R>): void;

  dispose(): void;
}
