import { AnimationFunction, AnimationMixer, Pnt3, Point3, Point4, Qtrn } from '../../../../base';
import { takeUntil } from 'rxjs';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../../../gg-3d-world';
import { IPositionable3d } from '../../../interfaces/i-positionable-3d';
import { IFrameSwitchable } from '../../../interfaces/i-frame-switchable';
import { Frame3d } from '../../../models/frame-3d';

type Positioning3d = {
  position: Point3;
  rotation: Point4;
};

export class Entity3dPositioningAnimator<T extends IPositionable3d = IPositionable3d>
  extends AnimationMixer<Positioning3d, Point3, Point4, Gg3dWorldTypeDocRepo>
  implements IFrameSwitchable
{
  static readonly entityTypeName: string = 'Entity3dPositioningAnimator';
  constructor(
    public entity: T,
    protected _animationFunction: AnimationFunction<Positioning3d>,
  ) {
    super(_animationFunction, (a, b, t) => ({
      position: Pnt3.lerp(a.position, b.position, t),
      rotation: Qtrn.slerp(a.rotation, b.rotation, t),
    }));
  }

  /**
   * Maps what the animation function returns (in the coordinates of the frame the animation was
   * written for) into the world's current local coordinates - see {@link onFrameSwitch}.
   */
  protected outputFrame: Frame3d = Frame3d.IDENTITY;

  /**
   * `IFrameSwitchable`: from now on, the positions and rotations the animation function returns are moved by `delta` too, so an animation under way carries on
   * along the same global path. The animated entity is moved by the world itself.
   */
  public onFrameSwitch(delta: Frame3d): void {
    this.outputFrame = delta.compose(this.outputFrame);
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
    this.value$.pipe(takeUntil(this._onRemoved$)).subscribe(value => this.applyPositioning(value));
  }

  protected applyPositioning(value: Positioning3d) {
    this.entity.position = this.outputFrame.toGlobalPoint(value.position);
    this.entity.rotation = this.outputFrame.toGlobalRotation(value.rotation);
  }
}
