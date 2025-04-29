import { IRendererEntity, Point2 } from '../../base';
import { VisualTypeDocRepo2D } from '../gg-2d-world';

export class Renderer2dEntity<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D> extends IRendererEntity<
  Point2,
  number,
  VTypeDoc
> {}
