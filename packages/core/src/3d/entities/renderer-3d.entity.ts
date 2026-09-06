import { IRendererEntity, Point3, Point4 } from '../../base';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { VisualTypeDocRepo3D } from '../gg-3d-world';

export class Renderer3dEntity<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IRendererEntity<Point3, Point4, VTypeDoc>
  implements IPositionable3d {}
