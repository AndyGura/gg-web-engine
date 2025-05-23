import { AnimationFunction, AnimationMixer, lerpNumber, Pnt3, Point3, Point4, Qtrn } from '../../../../base';
import { takeUntil } from 'rxjs';
import { Gg3dWorld, Gg3dWorldTypeDocVPatch, VisualTypeDocRepo3D } from '../../../gg-3d-world';
import { Renderer3dEntity } from '../../renderer-3d.entity';

export type Camera3dAnimationArgs = {
  position: Point3;
  target: Point3;
  up?: Point3;
  fov?: number;
};

const defaultUp = Pnt3.Z;
const defaultFov = 65;

export class Camera3dAnimator<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> extends AnimationMixer<
  Camera3dAnimationArgs,
  Point3,
  Point4,
  Gg3dWorldTypeDocVPatch<VTypeDoc>
> {
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

  onSpawned(world: Gg3dWorld<Gg3dWorldTypeDocVPatch<VTypeDoc>>) {
    super.onSpawned(world);
    this.value$.pipe(takeUntil(this._onRemoved$)).subscribe(value => this.applyPositioning(value));
  }

  protected applyPositioning(value: Camera3dAnimationArgs) {
    this.entity.position = value.position;
    this.entity.rotation = Qtrn.lookAt(value.position, value.target, value.up || defaultUp);
    this.entity.camera.fov = value.fov || defaultFov;
  }
}
