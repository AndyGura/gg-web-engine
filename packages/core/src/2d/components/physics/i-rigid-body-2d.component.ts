import { IRigidBodyComponent, Point2 } from '../../../base';
import { PhysicsTypeDocRepo2D } from '../../gg-2d-world';
import { DebugBody2DSettings } from '../../models/body-options';

export interface IRigidBody2dComponent<TypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends IRigidBodyComponent<Point2, number, TypeDoc> {
  angularVelocity: number;

  readonly debugBodySettings: DebugBody2DSettings;
}
