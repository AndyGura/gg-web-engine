import { Point2 } from '../base';
import { BodyShape2DDescriptor, Shape2DDescriptor } from './models/shapes';
import { PhysicsTypeDocRepo2D, VisualTypeDocRepo2D } from './gg-2d-world';

export type DisplayObject2dOpts<Tex> = {
  color?: number;
  texture?: Tex;
};

export abstract class IDisplayObject2dComponentFactory<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D> {
  abstract createPrimitive(
    descriptor: Shape2DDescriptor,
    material?: DisplayObject2dOpts<VTypeDoc['texture']>,
  ): VTypeDoc['displayObject'];

  randomColor(): number {
    return (
      (Math.floor(Math.random() * 256) << 16) | (Math.floor(Math.random() * 256) << 8) | Math.floor(Math.random() * 256)
    );
  }

  // shortcuts
  createSquare(dimensions: Point2, material: DisplayObject2dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'SQUARE', dimensions }, material);
  }

  createCircle(radius: number, material: DisplayObject2dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CIRCLE', radius }, material);
  }
}

export interface IPhysicsBody2dComponentFactory<PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D> {
  createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): PTypeDoc['rigidBody'];

  createTrigger(
    descriptor: Shape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): PTypeDoc['trigger'];
}
