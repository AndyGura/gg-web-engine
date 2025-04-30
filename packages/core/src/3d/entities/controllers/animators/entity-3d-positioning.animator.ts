import { AnimationFunction, AnimationMixer, Pnt3, Point3, Point4, Qtrn } from '../../../../base';
import { takeUntil } from 'rxjs';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../../../gg-3d-world';
import { IPositionable3d } from '../../../interfaces/i-positionable-3d';

type Positioning3d = {
  position: Point3;
  rotation: Point4;
};

export class Entity3dPositioningAnimator<T extends IPositionable3d = IPositionable3d> extends AnimationMixer<
  Positioning3d,
  Point3,
  Point4,
  Gg3dWorldTypeDocRepo
> {
  constructor(
    public entity: T,
    protected _animationFunction: AnimationFunction<Positioning3d>,
  ) {
    super(_animationFunction, (a, b, t) => ({
      position: Pnt3.lerp(a.position, b.position, t),
      rotation: Qtrn.slerp(a.rotation, b.rotation, t),
    }));
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
    this.value$.pipe(takeUntil(this._onRemoved$)).subscribe(value => this.applyPositioning(value));
  }

  protected applyPositioning(value: Positioning3d) {
    this.entity.position = value.position;
    this.entity.rotation = value.rotation;
  }
}
