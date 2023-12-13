import { ITriggerComponent, Point2 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo2D } from '../../gg-2d-world';

export interface ITrigger2dComponent<TypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends ITriggerComponent<Point2, number, TypeDoc> {
  get onEntityEntered(): Observable<TypeDoc['rigidBody']>;

  get onEntityLeft(): Observable<TypeDoc['rigidBody'] | null>;
}
