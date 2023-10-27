import { IVisualSceneComponent, Point2, RendererOptions } from '../../../base';
import { IGg2dObjectFactory } from '../../factories';
import { IRenderer2dComponent } from './i-renderer-2d.component';

export interface IVisualScene2dComponent extends IVisualSceneComponent<Point2, number> {
  readonly factory: IGg2dObjectFactory;

  createRenderer(canvas?: HTMLCanvasElement, rendererOptions?: Partial<RendererOptions>): IRenderer2dComponent;
}
