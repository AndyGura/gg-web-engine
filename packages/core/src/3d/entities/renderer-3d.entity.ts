import { IRendererEntity, Point3, Point4 } from '../../base';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { VisualTypeDocRepo3D } from '../gg-3d-world';

export class Renderer3dEntity<TypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IRendererEntity<Point3, Point4, TypeDoc>
  implements IPositionable3d
{
  public get position(): Point3 {
    return this.renderer.camera.position;
  }

  set position(value: Point3) {
    this.renderer.camera.position = value;
  }

  public get rotation(): Point4 {
    return this.renderer.camera.rotation;
  }

  set rotation(value: Point4) {
    this.renderer.camera.rotation = value;
  }

  public get camera(): TypeDoc['camera'] {
    return this.renderer.camera;
  }
}
