import { ITriggerComponent, Point2 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo2D } from '../../gg-2d-world';
import { DebugBody2DSettings } from '../../models/body-options';

export interface ITrigger2dComponent<TypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends ITriggerComponent<Point2, number, TypeDoc> {
  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody2DSettings;

  get onEntityEntered(): Observable<TypeDoc['rigidBody']>;

  get onEntityLeft(): Observable<TypeDoc['rigidBody'] | null>;
}
