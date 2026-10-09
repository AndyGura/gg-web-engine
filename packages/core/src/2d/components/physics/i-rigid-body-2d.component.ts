import { CollisionEvent, IRigidBodyComponent, Point2 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo2D } from '../../gg-2d-world';
import { DebugBody2DSettings } from '../../models/body-options';

export interface IRigidBody2dComponent<
  PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D,
> extends IRigidBodyComponent<Point2, number, PTypeDoc> {
  angularVelocity: number;

  /** See `IRigidBodyComponent.applyTorque`: a signed scalar, in N·m, positive counter-clockwise like `rotation`. */
  applyTorque(torque: number): void;

  /** See `IRigidBodyComponent.applyTorqueImpulse`: a signed scalar, in N·m·s. */
  applyTorqueImpulse(torqueImpulse: number): void;

  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody2DSettings;

  get onCollisionStart(): Observable<CollisionEvent<Point2, PTypeDoc['rigidBody']>>;

  get onCollisionEnd(): Observable<PTypeDoc['rigidBody'] | null>;
}
