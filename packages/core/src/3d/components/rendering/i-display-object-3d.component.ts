import { IDisplayObjectComponent, Point3, Point4 } from '../../../base';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

export interface IDisplayObject3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IDisplayObjectComponent<Point3, Point4, VTypeDoc> {}
