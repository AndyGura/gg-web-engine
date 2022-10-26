export interface GgPhysicsWorld<D, R> {

  readonly factory: any; // type defined in sub-interfaces

  init(): Promise<void>;

  /**
   * Runs simulation of the physics world.
   *
   * @param delta delta time from last tick in milliseconds.
   */
  simulate(delta: number): void;

  dispose(): void;
}
