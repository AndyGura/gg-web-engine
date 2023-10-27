import { IRendererEntity, Point2 } from '../../base';
import { IRenderer2dComponent } from '../components/rendering/i-renderer-2d.component';
import { IVisualScene2dComponent } from '../components/rendering/i-visual-scene-2d.component';

export class Renderer2dEntity<RC extends IRenderer2dComponent = IRenderer2dComponent> extends IRendererEntity<
  Point2,
  number,
  IVisualScene2dComponent,
  RC
> {}
