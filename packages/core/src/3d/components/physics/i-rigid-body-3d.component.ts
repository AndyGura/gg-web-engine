import { CollisionEvent, IRigidBodyComponent, Point3, Point4 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';
import { DebugBody3DSettings } from '../../models/body-options';

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
}
