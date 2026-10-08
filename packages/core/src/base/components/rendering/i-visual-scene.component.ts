import { IComponent } from '../i-component';
import { VisualTypeDocRepo } from '../../gg-world';
import { RendererOptions } from './i-renderer.component';

export interface IVisualSceneComponent<
  D,
  R,
  VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>,
> extends IComponent {
  /**
   * Short, stable name of the rendering library behind this scene (`'three'`, `'pixi'`, ...), the
   * same for every instance of an adapter. Shown in the dev console's world info and handy in logs
   * or bug reports; never meant for branching gameplay code on.
   */
  readonly backendName: string;

  readonly factory: VTypeDoc['factory'];

  init(): Promise<void>;

  createRenderer(
    camera: VTypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']>,
  ): VTypeDoc['renderer'];
}
