import { IDisplayObject3dComponent } from './i-display-object-3d.component';
import { IVisualScene3dComponent } from './i-visual-scene-3d.component';

export interface ICameraComponent<VS extends IVisualScene3dComponent = IVisualScene3dComponent>
  extends IDisplayObject3dComponent<VS> {
  get supportsFov(): boolean;

  get fov(): number;

  set fov(f: number);
}
