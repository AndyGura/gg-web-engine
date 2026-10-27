import { AnimationFunction, AnimationMixer, lerpNumber, Pnt3, Point3, Point4, Qtrn } from '../../../../base';
import { takeUntil } from 'rxjs';
import { Gg3dWorld, Gg3dWorldTypeDocVPatch, VisualTypeDocRepo3D } from '../../../gg-3d-world';
import { Renderer3dEntity } from '../../renderer-3d.entity';
import { IFrameSwitchable } from '../../../interfaces/i-frame-switchable';
import { Frame3d } from '../../../models/frame-3d';

export type Camera3dAnimationArgs = {
  position: Point3;
  target: Point3;
  up?: Point3;
  fov?: number;
};

const defaultUp = Pnt3.Z;
const defaultFov = 65;

export class Camera3dAnimator<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends AnimationMixer<Camera3dAnimationArgs, Point3, Point4, Gg3dWorldTypeDocVPatch<VTypeDoc>>
  implements IFrameSwitchable
{
  static readonly entityTypeName: string = 'Camera3dAnimator';
  constructor(
    public entity: Renderer3dEntity<VTypeDoc>,
    protected _animationFunction: AnimationFunction<Camera3dAnimationArgs>,
  ) {
    super(_animationFunction, (a, b, t) => ({
      position: Pnt3.lerp(a.position, b.position, t),
      target: Pnt3.lerp(a.target, b.target, t),
      up: Pnt3.lerp(a.up || defaultUp, b.up || defaultUp, t),
      fov: lerpNumber(a.fov || defaultFov, b.fov || defaultFov, t),
    }));
  }

  /**
   * Maps what the animation function returns (in the coordinates of the frame the animation was
   * written for) into the world's current local coordinates - see {@link onFrameSwitch}.
   */
  protected outputFrame: Frame3d = Frame3d.IDENTITY;

  /**
   * `IFrameSwitchable`: from now on, the camera positions, targets and up vectors the animation function returns are moved by `delta` too, so an animation under way carries on
   * along the same global path. The animated entity is moved by the world itself.
   */
  public onFrameSwitch(delta: Frame3d): void {
    this.outputFrame = delta.compose(this.outputFrame);
  }

  onSpawned(world: Gg3dWorld<Gg3dWorldTypeDocVPatch<VTypeDoc>>) {
    super.onSpawned(world);
    this.value$.pipe(takeUntil(this._onRemoved$)).subscribe(value => this.applyPositioning(value));
  }

  protected applyPositioning(value: Camera3dAnimationArgs) {
    const position = this.outputFrame.toGlobalPoint(value.position);
    const target = this.outputFrame.toGlobalPoint(value.target);
    const up = this.outputFrame.toGlobalDirection(value.up || defaultUp);
    this.entity.position = position;
    this.entity.rotation = Qtrn.lookAt(position, target, up);
    this.entity.camera.fov = value.fov || defaultFov;
  }
}
