import { IRendererEntity, Pnt3, Point3, Point4, Qtrn } from '../../base';
import { IRenderer3dComponent } from '../components/rendering/i-renderer-3d.component';
import { IVisualScene3dComponent } from '../components/rendering/i-visual-scene-3d.component';
import { ICameraComponent } from '../components/rendering/i-camera.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';

export class Renderer3dEntity<
    VS extends IVisualScene3dComponent = IVisualScene3dComponent,
    RC extends IRenderer3dComponent<VS> = IRenderer3dComponent<VS>,
    CC extends ICameraComponent<VS> = ICameraComponent<VS>,
  >
  extends IRendererEntity<Point3, Point4, VS, RC>
  implements IPositionable3d
{
  private _position = Pnt3.O;
  public get position(): Point3 {
    return this._position;
  }

  set position(value: Point3) {
    this.camera_.position = value;
    this._position = value;
  }

  private _rotation = Qtrn.O;
  public get rotation(): Point4 {
    return this._rotation;
  }

  set rotation(value: Point4) {
    this.camera_.rotation = value;
    this._rotation = value;
  }

  public get camera(): CC {
    return this.camera_;
  }

  constructor(public readonly renderer: RC, protected camera_: CC) {
    super(renderer);
    this.addComponents(camera_);
    this.position = camera_.position;
    this.rotation = camera_.rotation;
  }
}
