import { IPhysicsWorldComponent, Point3, Point4 } from '../../../base';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';
import { Subject } from 'rxjs';

export interface IPhysicsWorld3dComponent<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IPhysicsWorldComponent<Point3, Point4, PTypeDoc> {
  readonly loader: PTypeDoc['loader'];

  /** event emitter, emits newly added physics components */
  readonly added$: Subject<PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | any>;
  /** event emitter, emits just removed physics components */
  readonly removed$: Subject<PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | any>;
  /** list of currently added to world physics components */
  readonly children: (PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | any)[];
}
