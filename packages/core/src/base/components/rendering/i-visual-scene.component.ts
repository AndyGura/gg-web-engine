import { IDebugPhysicsDrawer } from '../../interfaces/i-debug-physics-drawer';
import { IComponent } from '../i-component';
import { VisualTypeDocRepo } from '../../gg-world';

export interface IVisualSceneComponent<D, R, TypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IComponent {
  readonly factory: TypeDoc['factory'];

  readonly debugPhysicsDrawerClass?: { new (): IDebugPhysicsDrawer<D, R, TypeDoc> };

  init(): Promise<void>;
}
