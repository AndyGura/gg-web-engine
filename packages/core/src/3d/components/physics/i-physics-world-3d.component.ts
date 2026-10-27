import { IPhysicsWorldComponent, Point3, Point4 } from '../../../base';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';
import { Subject } from 'rxjs';
import { Frame3d } from '../../models/frame-3d';

export interface IPhysicsWorld3dComponent<
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
> extends IPhysicsWorldComponent<Point3, Point4, PTypeDoc> {
  readonly loader: PTypeDoc['loader'];

  /** event emitter, emits newly added physics components */
  readonly added$: Subject<
    PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | PTypeDoc['characterController'] | any
  >;
  /** event emitter, emits just removed physics components */
  readonly removed$: Subject<
    PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | PTypeDoc['characterController'] | any
  >;
  /** list of currently added to world physics components */
  readonly children: (
    PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | PTypeDoc['characterController'] | any
  )[];

  /**
   * Optional. Called once per frame switch (`Gg3dWorld.switchFrame`), after every entity moved its
   * own bodies by `delta` (`IRigidBody3dComponent.onFrameSwitch` and friends): for the world-wide
   * native state no single body owns - contact manifolds holding world-space points and normals,
   * acceleration structures for queries. A body no entity owns is not moved by the world.
   */
  onFrameSwitch?(delta: Frame3d): void;
}
