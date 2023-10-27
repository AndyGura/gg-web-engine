import { IDisplayObjectComponent, Point2 } from '../../../base';
import { IVisualScene2dComponent } from './i-visual-scene-2d.component';

export interface IDisplayObject2dComponent<VS extends IVisualScene2dComponent = IVisualScene2dComponent>
  extends IDisplayObjectComponent<Point2, number, VS> {}
