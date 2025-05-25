import { IVisualSceneComponent, Point3, Point4 } from '../../../base';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

export interface IVisualScene3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IVisualSceneComponent<Point3, Point4, VTypeDoc> {
  readonly loader: VTypeDoc['loader'];
}
