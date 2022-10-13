export interface GgPhysicsWorld<D, R> {

  init(): void;

  /**
   * Runs simulation of the physics world.
   *
   * @param delta delta time from last tick in milliseconds.
   */
  simulate(delta: number): void;

  dispose(): void;
}
