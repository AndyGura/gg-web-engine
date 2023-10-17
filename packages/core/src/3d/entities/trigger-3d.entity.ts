import { Observable } from 'rxjs';
import { ITrigger3dComponent } from '../components/physics/i-trigger-3d.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { IEntity, Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { map } from 'rxjs/operators';

export class Trigger3dEntity extends IEntity<Point3, Point4> implements IPositionable3d {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  get onEntityEntered(): Observable<IEntity & IPositionable3d> {
    return this.objectBody.onEntityEntered.pipe(map(c => c.entity as IEntity & IPositionable3d));
  }

  get onEntityLeft(): Observable<(IEntity & IPositionable3d) | null> {
    return this.objectBody.onEntityLeft.pipe(map(c => c?.entity as IEntity & IPositionable3d));
  }

  private _position = Pnt3.O;
  public get position(): Point3 {
    return this._position;
  }

  set position(value: Point3) {
    this.objectBody.position = value;
    this._position = value;
  }

  private _rotation = Qtrn.O;
  public get rotation(): Point4 {
    return this._rotation;
  }

  set rotation(value: Point4) {
    this.objectBody.rotation = value;
    this._rotation = value;
  }

  constructor(public readonly objectBody: ITrigger3dComponent) {
    super();
    this.tick$.subscribe(() => {
      this.objectBody.checkOverlaps();
    });
    this.addComponents(this.objectBody);
  }
}
