import { IPhysicsWorldComponent, Point2 } from '../../../base';
import { PhysicsTypeDocRepo2D } from '../../gg-2d-world';

export interface IPhysicsWorld2dComponent<TypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends IPhysicsWorldComponent<Point2, number, TypeDoc> {}
