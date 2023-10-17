import { IPhysicsWorldComponent, Point3, Point4 } from '../../../base';
import { IPhysicsBody3dComponentFactory } from '../../factories';
import { IPhysicsBody3dComponentLoader } from '../../loaders';

export interface IPhysicsWorld3dComponent extends IPhysicsWorldComponent<Point3, Point4> {
  readonly factory: IPhysicsBody3dComponentFactory;
  readonly loader: IPhysicsBody3dComponentLoader;
}
