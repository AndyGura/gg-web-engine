import { IRendererComponent, Point3, Point4 } from '../../../base';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

export abstract class IRenderer3dComponent<
  VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
> extends IRendererComponent<Point3, Point4, VTypeDoc> {}
