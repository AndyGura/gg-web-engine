import { Subject, Subscription } from 'rxjs';
import { GgPositionable2dEntity } from './gg-positionable-2d-entity';
import { ITickListener } from '../../base/entities/interfaces/i-tick-listener';
import { Point3 } from '../../base/models/points';
import { Gg2dBody } from '../interfaces/gg-2d-body';
import { Gg2dObject } from '../interfaces/gg-2d-object';

export class Gg2dEntity extends GgPositionable2dEntity implements ITickListener {

  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  private tickSub: Subscription;

  set position(value: Point3) {
    this.objectBody.position = this.object2D.position = value;
    super.position = value;
  }

  set rotation(value: number) {
    this.objectBody.rotation = this.object2D.rotation = value;
    super.rotation = value;
  }

  set scale(value: Point3) {
    this.objectBody.scale = this.object2D.scale = value;
    super.scale = value;
  }

  constructor(
    public readonly object2D: Gg2dObject,
    public readonly objectBody: Gg2dBody,
  ) {
    super();
    this.tickSub = this.tick$.subscribe(() => {
      // bind physics body transform to object transform
      const pos = this.objectBody.position;
      const rot = this.objectBody.rotation;
      this.object2D.position = pos;
      this.object2D.rotation = rot;
      this._position$.next(pos);
      this._rotation$.next(rot);
    });
  }

  dispose(): void {
    this.tickSub.unsubscribe();
    this.object2D.dispose();
    this.objectBody.dispose();
  }

}
