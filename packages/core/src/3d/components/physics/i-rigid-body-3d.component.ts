import { CollisionEvent, IRigidBodyComponent, Point3, Point4 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';
import { DebugBody3DSettings } from '../../models/body-options';
import { Frame3d } from '../../models/frame-3d';

export interface IRigidBody3dComponent<
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
> extends IRigidBodyComponent<Point3, Point4, PTypeDoc> {
  angularVelocity: Point3;

  /** See `IRigidBodyComponent.applyTorque`: a world-space axis-scaled vector, in N·m. */
  applyTorque(torque: Point3): void;

  /** See `IRigidBodyComponent.applyTorqueImpulse`: a world-space axis-scaled vector, in N·m·s. */
  applyTorqueImpulse(torqueImpulse: Point3): void;

  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody3DSettings;

  get onCollisionStart(): Observable<CollisionEvent<Point3, PTypeDoc['rigidBody']>>;

  get onCollisionEnd(): Observable<PTypeDoc['rigidBody'] | null>;

  /**
   * Optional. Moves the body by `delta` for a frame switch (`Gg3dWorld.switchFrame`, see
   * `IFrameSwitchable`): pose (`delta.toGlobalPoint`/`toGlobalRotation`), linear and angular
   * velocity (`delta.toGlobalDirection`), and every native copy of them the engine keeps, so the
   * next step continues exactly where the old pose left off. Unlike the `position`/`rotation`
   * setters (a teleport), it keeps the activation state - a sleeping body stays asleep - and the
   * contacts. A raycast vehicle also moves its wheels: transforms and the last step's contacts.
   * Called by `Entity3d.onFrameSwitch`; without it, core falls back to the setters.
   */
  onFrameSwitch?(delta: Frame3d): void;
}
