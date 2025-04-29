import { IRigidBodyComponent, Point2 } from '../../../base';
import { PhysicsTypeDocRepo2D } from '../../gg-2d-world';
import { DebugBody2DSettings } from '../../models/body-options';

export interface IRigidBody2dComponent<PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends IRigidBodyComponent<Point2, number, PTypeDoc> {
  angularVelocity: number;

  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody2DSettings;
}
