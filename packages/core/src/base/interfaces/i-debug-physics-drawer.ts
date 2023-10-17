import { IDisplayObjectComponent } from '../components/rendering/i-display-object.component';
import { Point3 } from '../models/points';
import { IVisualSceneComponent } from '../components/rendering/i-visual-scene.component';

export interface IDebugPhysicsDrawer<D, R, VS extends IVisualSceneComponent<D, R> = IVisualSceneComponent<D, R>>
  extends IDisplayObjectComponent<D, R, VS> {
  drawContactPoint(point: D, normal: D, color?: Point3): void;

  drawLine(from: D, to: D, color?: Point3): void;

  update(): void;
}
