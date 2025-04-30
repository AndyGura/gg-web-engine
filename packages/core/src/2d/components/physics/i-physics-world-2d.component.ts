import { IPhysicsWorldComponent, Point2 } from '../../../base';
import { PhysicsTypeDocRepo2D } from '../../gg-2d-world';

export interface IPhysicsWorld2dComponent<PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends IPhysicsWorldComponent<Point2, number, PTypeDoc> {}
