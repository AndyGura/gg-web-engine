import { ITriggerComponent, Point2 } from '../../../base';
import { Observable } from 'rxjs';
import { IPhysicsWorld2dComponent } from './i-physics-world-2d.component';
import { IRigidBody2dComponent } from './i-rigid-body-2d.component';

export interface ITrigger2dComponent<PW extends IPhysicsWorld2dComponent = IPhysicsWorld2dComponent>
  extends ITriggerComponent<Point2, number, PW> {
  get onEntityEntered(): Observable<IRigidBody2dComponent>;

  get onEntityLeft(): Observable<IRigidBody2dComponent | null>;
}
