import { IRigidBodyComponent, Point3, Point4 } from '../../../base';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';

export interface IRigidBody3dComponent<TypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IRigidBodyComponent<Point3, Point4, TypeDoc> {
  angularVelocity: Point3;
}
