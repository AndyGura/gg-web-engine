import { IRigidBodyComponent, Point3, Point4 } from '../../../base';
import { IPhysicsWorld3dComponent } from './i-physics-world-3d';

export interface IRigidBody3dComponent<PW extends IPhysicsWorld3dComponent = IPhysicsWorld3dComponent>
  extends IRigidBodyComponent<Point3, Point4, PW> {}
