import { IDisplayObjectComponent } from '../components/rendering/i-display-object.component';
import { Point3 } from '../models/points';
import { VisualTypeDocRepo } from '../gg-world';

export interface IDebugPhysicsDrawer<D, R, TypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IDisplayObjectComponent<D, R, TypeDoc> {
  drawContactPoint(point: D, normal: D, color?: Point3): void;

  drawLine(from: D, to: D, color?: Point3): void;

  update(): void;
}
