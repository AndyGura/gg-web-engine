import { IRendererEntity, Point3, Point4 } from '../../base';
import { IRenderer3dComponent } from '../components/rendering/i-renderer-3d.component';
import { IVisualScene3dComponent } from '../components/rendering/i-visual-scene-3d.component';
import { ICameraComponent } from '../components/rendering/i-camera.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';

export class Renderer3dEntity<
    VS extends IVisualScene3dComponent = IVisualScene3dComponent,
    CC extends ICameraComponent<VS> = ICameraComponent<VS>,
    RC extends IRenderer3dComponent<VS, CC> = IRenderer3dComponent<VS, CC>,
  >
  extends IRendererEntity<Point3, Point4, VS, RC>
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

  public get camera(): CC {
    return this.renderer.camera;
  }
}
