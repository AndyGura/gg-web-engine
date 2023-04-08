import { Gg3dEntity } from '../../gg-3d-entity';
import { AnimationFunction, AnimationMixer } from '../../../../base/entities/controllers/animation-mixer';
import { Point3, Point4 } from '../../../../base/models/points';
import { Pnt3 } from '../../../../base/math/point3';
import { Qtrn } from '../../../../base/math/quaternion';
import { takeUntil } from 'rxjs';
import { Gg3dWorld } from '../../../gg-3d-world';

type Positioning3d = {
  position: Point3;
  rotation: Point4;
};

export class Entity3dPositioningAnimator<T extends Gg3dEntity = Gg3dEntity> extends AnimationMixer<Positioning3d> {
  constructor(public entity: T, protected _animationFunction: AnimationFunction<Positioning3d>) {
    super(_animationFunction, (a, b, t) => ({
      position: Pnt3.lerp(a.position, b.position, t),
      rotation: Qtrn.slerp(a.rotation, b.rotation, t),
    }));
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
    this.value$.pipe(takeUntil(this.removed$)).subscribe(value => this.applyPositioning(value));
  }

  protected applyPositioning(value: Positioning3d) {
    this.entity.position = value.position;
    this.entity.rotation = value.rotation;
  }
}
