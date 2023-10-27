import { IDebugPhysicsDrawer } from '../../interfaces/i-debug-physics-drawer';
import { IComponent } from '../i-component';

export interface IVisualSceneComponent<D, R> extends IComponent {
  readonly factory: any; // type defined in sub-interfaces

  readonly debugPhysicsDrawerClass?: { new (): IDebugPhysicsDrawer<D, R> };

  init(): Promise<void>;
}
