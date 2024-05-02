import { IComponent } from '../i-component';
import { VisualTypeDocRepo } from '../../gg-world';

export interface IVisualSceneComponent<D, R, TypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IComponent {
  readonly factory: TypeDoc['factory'];

  init(): Promise<void>;
}
