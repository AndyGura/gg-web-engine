import {Body2DOptions, BodyShape2DDescriptor, IGg2dBodyFactory, Point2, Shape2DDescriptor} from '@gg-web-engine/core';
import { Gg2dBody } from './gg-2d-body';
import { Bodies, IBodyDefinition, Vector, Body } from 'matter-js';

export class Gg2dBodyFactory implements IGg2dBodyFactory<Gg2dBody, any> {

  createRigidBody(descriptor: BodyShape2DDescriptor, transform?: {
    position?: Point2;
    rotation?: number;
  }): Gg2dBody {
    let nativeBody: Body | null = null;
    switch (descriptor.shape.shape) {
      case 'SQUARE':
        nativeBody = Bodies.rectangle(0, 0, descriptor.shape.dimensions.x, descriptor.shape.dimensions.y, this.transformOptions(descriptor.body));
        break;
      case 'CIRCLE':
        nativeBody = Bodies.circle(0, 0, descriptor.shape.radius, this.transformOptions(descriptor.body));
        break;
    }
    if (!nativeBody) {
      throw new Error(`Shape "${descriptor.shape}" not implemented for Matter.js`);
    }
    nativeBody.position = Vector.create(transform?.position?.x || 0, transform?.position?.y || 0);
    nativeBody.angle = transform?.rotation || 0;
    return new Gg2dBody(nativeBody);
  }

  createTrigger(descriptor: Shape2DDescriptor, transform?: {
    position?: Point2;
    rotation?: number;
  }): any {
    throw new Error('Triggers not implemented for Matter.js');
  }

  private transformOptions(options: Partial<Body2DOptions>): IBodyDefinition {
    const res: IBodyDefinition = {
      isStatic: options.dynamic !== undefined ? !options.dynamic : !options.mass,
      mass: options.mass,
      restitution: options.restitution,
      friction: options.friction,
    };
    for (const key in res) {
      if ((res as any)[key] === undefined) {
        delete (res as any)[key];
      }
    }
    return res;
  }

}
