import { IRendererComponent, Point2 } from '../../../base';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';

export abstract class IRenderer2dComponent<
  TypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
> extends IRendererComponent<Point2, number, TypeDoc> {}
