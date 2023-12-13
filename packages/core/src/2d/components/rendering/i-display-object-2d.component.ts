import { IDisplayObjectComponent, Point2 } from '../../../base';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';

export interface IDisplayObject2dComponent<TypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IDisplayObjectComponent<Point2, number, TypeDoc> {}
