import { IPhysicsWorldComponent, Point3, Point4 } from '../../../base';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';

export interface IPhysicsWorld3dComponent<TypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IPhysicsWorldComponent<Point3, Point4, TypeDoc> {
  readonly loader: TypeDoc['loader'];
}
