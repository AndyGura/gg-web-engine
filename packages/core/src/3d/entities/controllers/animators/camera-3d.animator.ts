import { AnimationFunction, AnimationMixer } from '../../../../base/entities/controllers/animation-mixer';
import { Point3 } from '../../../../base/models/points';
import { Pnt3 } from '../../../../base/math/point3';
import { Qtrn } from '../../../../base/math/quaternion';
import { takeUntil } from 'rxjs';
import { Gg3dWorld } from '../../../gg-3d-world';
import { lerpNumber } from '../../../../base/math/numbers';
import { Gg3dCameraEntity } from '../../gg-3d-camera.entity';

export type Camera3dAnimationArgs = {
  position: Point3;
  target: Point3;
  up?: Point3;
  fov?: number;
};

const defaultUp = { x: 0, y: 0, z: 1 };
const defaultFov = 65;

export class Camera3dAnimator extends AnimationMixer<Camera3dAnimationArgs> {
  constructor(public entity: Gg3dCameraEntity, protected _animationFunction: AnimationFunction<Camera3dAnimationArgs>) {
    super(_animationFunction, (a, b, t) => ({
      position: Pnt3.lerp(a.position, b.position, t),
      target: Pnt3.lerp(a.target, b.target, t),
      up: Pnt3.lerp(a.up || defaultUp, b.up || defaultUp, t),
      fov: lerpNumber(a.fov || defaultFov, b.fov || defaultFov, t),
    }));
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
    this.value$.pipe(takeUntil(this._onRemoved$)).subscribe(value => this.applyPositioning(value));
  }

  protected applyPositioning(value: Camera3dAnimationArgs) {
    this.entity.position = value.position;
    this.entity.rotation = Qtrn.lookAt(value.position, value.target, value.up || defaultUp);
    this.entity.fov = value.fov || defaultFov;
  }
}
