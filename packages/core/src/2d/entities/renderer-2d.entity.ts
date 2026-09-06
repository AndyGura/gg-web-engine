import { IRendererEntity, Point2 } from '../../base';
import { VisualTypeDocRepo2D } from '../gg-2d-world';
import { IPositionable2d } from '../interfaces/i-positionable-2d';

export class Renderer2dEntity<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IRendererEntity<Point2, number, VTypeDoc>
  implements IPositionable2d {}
