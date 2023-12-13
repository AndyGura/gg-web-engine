import { IVisualSceneComponent, Point2, RendererOptions } from '../../../base';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';

export interface IVisualScene2dComponent<TypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IVisualSceneComponent<Point2, number, TypeDoc> {
  createRenderer(canvas?: HTMLCanvasElement, rendererOptions?: Partial<RendererOptions>): TypeDoc['renderer'];
}
