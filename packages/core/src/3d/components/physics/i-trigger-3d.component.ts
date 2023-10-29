import { ITriggerComponent, Point3, Point4 } from '../../../base';
import { Observable } from 'rxjs';
import { IPhysicsWorld3dComponent } from './i-physics-world-3d.component';
import { IRigidBody3dComponent } from './i-rigid-body-3d.component';

export interface ITrigger3dComponent<PW extends IPhysicsWorld3dComponent = IPhysicsWorld3dComponent>
  extends ITriggerComponent<Point3, Point4, PW> {
  get onEntityEntered(): Observable<IRigidBody3dComponent>;

  get onEntityLeft(): Observable<IRigidBody3dComponent | null>;
}
