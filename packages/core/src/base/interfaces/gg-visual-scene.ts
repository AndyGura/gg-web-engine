import { GgDebugPhysicsDrawer } from './gg-debug-physics-drawer';

export interface GgVisualScene<D, R> {
  readonly factory: any; // type defined in sub-interfaces

  readonly debugPhysicsDrawerClass?: { new (): GgDebugPhysicsDrawer<D, R> };

  init(): Promise<void>;

  dispose(): void;
}
