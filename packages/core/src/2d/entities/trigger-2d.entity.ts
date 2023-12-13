import { Observable } from 'rxjs';
import { ITrigger2dComponent } from '../components/physics/i-trigger-2d.component';
import { IEntity, Pnt2, Point2, TickOrder } from '../../base';
import { IPositionable2d } from '../interfaces/i-positionable-2d';
import { map } from 'rxjs/operators';
import { PhysicsTypeDocRepo2D, VisualTypeDocRepo2D } from '../gg-2d-world';

export class Trigger2dEntity<TypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends IEntity<Point2, number, VisualTypeDocRepo2D, TypeDoc>
  implements IPositionable2d
{
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  get onEntityEntered(): Observable<IEntity<Point2, number, VisualTypeDocRepo2D, TypeDoc> & IPositionable2d> {
    return this.objectBody.onEntityEntered.pipe(
      map(c => c.entity as IEntity<Point2, number, VisualTypeDocRepo2D, TypeDoc> & IPositionable2d),
    );
  }

  get onEntityLeft(): Observable<(IEntity<Point2, number, VisualTypeDocRepo2D, TypeDoc> & IPositionable2d) | null> {
    return this.objectBody.onEntityLeft.pipe(
      map(c => c?.entity as IEntity<Point2, number, VisualTypeDocRepo2D, TypeDoc> & IPositionable2d),
    );
  }

  private _position = Pnt2.O;
  public get position(): Point2 {
    return this._position;
  }

  set position(value: Point2) {
    this.objectBody.position = value;
    this._position = value;
  }

  private _rotation = 0;
  public get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    this.objectBody.rotation = value;
    this._rotation = value;
  }

  constructor(public readonly objectBody: ITrigger2dComponent) {
    super();
    this.tick$.subscribe(() => {
      this.objectBody.checkOverlaps();
    });
    this.addComponents(this.objectBody);
  }
}
