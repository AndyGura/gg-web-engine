import { IRendererComponent, Point2 } from '../../../base';
import { IVisualScene2dComponent } from './i-visual-scene-2d.component';

export abstract class IRenderer2dComponent<
  VS extends IVisualScene2dComponent = IVisualScene2dComponent,
> extends IRendererComponent<Point2, number, VS> {}
