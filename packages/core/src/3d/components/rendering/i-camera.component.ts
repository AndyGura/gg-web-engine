import { IDisplayObject3dComponent } from './i-display-object-3d.component';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

export interface ICameraComponent<TypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IDisplayObject3dComponent<TypeDoc> {
  get supportsFov(): boolean;

  get fov(): number;

  set fov(f: number);
}
