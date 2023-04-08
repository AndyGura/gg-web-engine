import { AnimationFunction, AnimationMixer } from '../../../base/entities/controllers/animation-mixer';
import { Point2 } from '../../../base/models/points';
import { takeUntil } from 'rxjs';
import { Gg2dEntity } from '../gg-2d-entity';
import { Pnt2 } from '../../../base/math/point2';
import { lerpNumber } from '../../../base/math/numbers';
import { Gg2dWorld } from '../../gg-2d-world';

type Positioning2d = {
  position: Point2;
  rotation: number;
};

export class Entity2dPositioningAnimator<T extends Gg2dEntity = Gg2dEntity> extends AnimationMixer<Positioning2d> {
  constructor(public entity: T, protected _animationFunction: AnimationFunction<Positioning2d>) {
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
