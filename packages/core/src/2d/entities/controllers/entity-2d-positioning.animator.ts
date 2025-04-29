import { AnimationFunction, AnimationMixer, lerpNumber, Pnt2, Point2 } from '../../../base';
import { takeUntil } from 'rxjs';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from '../../gg-2d-world';
import { Entity2d } from '../entity-2d';

type Positioning2d = {
  position: Point2;
  rotation: number;
};

export class Entity2dPositioningAnimator<T extends Entity2d = Entity2d> extends AnimationMixer<
  Positioning2d,
  Point2,
  number,
  Gg2dWorldTypeDocRepo
> {
  constructor(
    public entity: T,
    protected _animationFunction: AnimationFunction<Positioning2d>,
  ) {
    super(_animationFunction, (a, b, t) => ({
      position: Pnt2.lerp(a.position, b.position, t),
      rotation: lerpNumber(a.rotation, b.rotation, t),
    }));
  }

  onSpawned(world: Gg2dWorld) {
    super.onSpawned(world);
    this.value$.pipe(takeUntil(this._onRemoved$)).subscribe(value => this.applyPositioning(value));
  }

  protected applyPositioning(value: Positioning2d) {
    this.entity.position = value.position;
    this.entity.rotation = value.rotation;
  }
}
