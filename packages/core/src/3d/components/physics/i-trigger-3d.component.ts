import { ITriggerComponent, Point3, Point4 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';

export interface ITrigger3dComponent<TypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends ITriggerComponent<Point3, Point4, TypeDoc> {
  get onEntityEntered(): Observable<TypeDoc['rigidBody']>;

  get onEntityLeft(): Observable<TypeDoc['rigidBody'] | null>;
}
