import { Subject } from 'rxjs';
import { GgPositionable3dEntity } from './gg-positionable-3d-entity';
import { ITickListener } from '../../base/entities/interfaces/i-tick-listener';
import { Point3, Point4 } from '../../base/models/points';
import { Gg3dBody } from '../interfaces/gg-3d-body';

export class Gg3dEntity extends GgPositionable3dEntity implements ITickListener {

  public tick$: Subject<number> = new Subject<number>();

  set position(value: Point3) {
    this.objectBody.position = this.object3D.position = value;
    super.position = value;
  }

  set quaternion(value: Point4) {
    this.objectBody.quaternion = this.object3D.quaternion = value;
    super.quaternion = value;
  }

  set scale(value: Point3) {
    this.objectBody.scale = this.object3D.scale = value;
    super.scale = value;
  }

  constructor(
    public readonly object3D: Gg3dEntity,
    public readonly objectBody: Gg3dBody,
  ) {
    super();
    this.tick$.subscribe(() => {
      // bind physics body transform to mesh transform
      const pos = this.objectBody.position;
      const quat = this.objectBody.quaternion;
      this.object3D.position = pos;
      this.object3D.quaternion = quat;
      this._position$.next(pos);
      this._quaternion$.next(quat);
    });
  }

}
