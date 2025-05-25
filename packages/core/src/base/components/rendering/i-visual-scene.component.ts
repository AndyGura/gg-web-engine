import { IComponent } from '../i-component';
import { VisualTypeDocRepo } from '../../gg-world';
import { RendererOptions } from './i-renderer.component';

export interface IVisualSceneComponent<D, R, VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IComponent {
  readonly factory: VTypeDoc['factory'];

  init(): Promise<void>;

  createRenderer(
    camera: VTypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']>,
  ): VTypeDoc['renderer'];
}
