import { ITriggerComponent, Point2 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo2D } from '../../gg-2d-world';
import { DebugBody2DSettings } from '../../models/body-options';

export interface ITrigger2dComponent<PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends ITriggerComponent<Point2, number, PTypeDoc> {
  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody2DSettings;

  get onEntityEntered(): Observable<PTypeDoc['rigidBody']>;

  get onEntityLeft(): Observable<PTypeDoc['rigidBody'] | null>;
}
