import { IRigidBodyComponent, Point2 } from '../../../base';
import { IPhysicsWorld2dComponent } from './i-physics-world-2d.component';

export interface IRigidBody2dComponent<PW extends IPhysicsWorld2dComponent = IPhysicsWorld2dComponent>
  extends IRigidBodyComponent<Point2, number, PW> {}
