import { Point2 } from '../base';
import { BodyShape2DDescriptor, Shape2DDescriptor } from './models/shapes';
import { IRigidBody2dComponent } from './components/physics/i-rigid-body-2d.component';
import { ITrigger2dComponent } from './components/physics/i-trigger-2d.component';
import { IDisplayObject2dComponent } from './components/rendering/i-display-object-2d.component';

export abstract class IGg2dObjectFactory<T extends IDisplayObject2dComponent = IDisplayObject2dComponent> {
  abstract createPrimitive(descriptor: Shape2DDescriptor): T;

  // shortcuts
  createSquare(dimensions: Point2): T {
    return this.createPrimitive({ shape: 'SQUARE', dimensions });
  }

  createCircle(radius: number): T {
    return this.createPrimitive({ shape: 'CIRCLE', radius });
  }
}

export interface IPhysicsBody2dComponentFactory<
  T extends IRigidBody2dComponent = IRigidBody2dComponent,
  K extends ITrigger2dComponent = ITrigger2dComponent,
> {
  createRigidBody(descriptor: BodyShape2DDescriptor, transform?: { position?: Point2; rotation?: number }): T;

  createTrigger(descriptor: Shape2DDescriptor, transform?: { position?: Point2; rotation?: number }): K;
}
