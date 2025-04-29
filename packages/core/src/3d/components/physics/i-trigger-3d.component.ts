import { ITriggerComponent, Point3, Point4 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';
import { DebugBody3DSettings } from '../../models/body-options';

export interface ITrigger3dComponent<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends ITriggerComponent<Point3, Point4, PTypeDoc> {
  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody3DSettings;

  get onEntityEntered(): Observable<PTypeDoc['rigidBody']>;

  get onEntityLeft(): Observable<PTypeDoc['rigidBody'] | null>;
}
