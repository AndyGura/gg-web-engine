import { IPhysicsWorldComponent, Point2 } from '../../../base';
import { IPhysicsBody2dComponentFactory } from '../../factories';

export interface IPhysicsWorld2dComponent extends IPhysicsWorldComponent<Point2, number> {
  readonly factory: IPhysicsBody2dComponentFactory;
}
