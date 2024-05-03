import { IPhysicsWorldComponent, Point3, Point4 } from '../../../base';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';
import { Subject } from 'rxjs';

export interface IPhysicsWorld3dComponent<TypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IPhysicsWorldComponent<Point3, Point4, TypeDoc> {
  readonly loader: TypeDoc['loader'];

  readonly added$: Subject<TypeDoc['trigger'] | TypeDoc['rigidBody'] | TypeDoc['raycastVehicle'] | any>;
  readonly removed$: Subject<TypeDoc['trigger'] | TypeDoc['rigidBody'] | TypeDoc['raycastVehicle'] | any>;
  readonly children: (TypeDoc['trigger'] | TypeDoc['rigidBody'] | TypeDoc['raycastVehicle'] | any)[];
}
