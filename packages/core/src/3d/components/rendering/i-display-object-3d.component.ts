import { IDisplayObjectComponent, Point3, Point4 } from '../../../base';
import { IVisualScene3dComponent } from './i-visual-scene-3d.component';

export interface IDisplayObject3dComponent<VS extends IVisualScene3dComponent = IVisualScene3dComponent>
  extends IDisplayObjectComponent<Point3, Point4, VS> {}
