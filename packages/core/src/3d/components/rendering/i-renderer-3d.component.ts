import { IRendererComponent, Point3, Point4 } from '../../../base';
import { IVisualScene3dComponent } from './i-visual-scene-3d.component';
import { ICameraComponent } from './i-camera.component';

export abstract class IRenderer3dComponent<
  VS extends IVisualScene3dComponent = IVisualScene3dComponent,
  CC extends ICameraComponent = ICameraComponent,
> extends IRendererComponent<Point3, Point4, VS> {
  abstract camera: CC;
}
