import { IVisualSceneComponent, Point2 } from '../../../base';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';

export interface IVisualScene2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IVisualSceneComponent<Point2, number, VTypeDoc> {}
