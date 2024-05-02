import { ITriggerComponent, Point3, Point4 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';
import { DebugBody3DSettings } from '../../models/body-options';

export interface ITrigger3dComponent<TypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends ITriggerComponent<Point3, Point4, TypeDoc> {
  readonly debugBodySettings: DebugBody3DSettings;

  get onEntityEntered(): Observable<TypeDoc['rigidBody']>;

  get onEntityLeft(): Observable<TypeDoc['rigidBody'] | null>;
}
