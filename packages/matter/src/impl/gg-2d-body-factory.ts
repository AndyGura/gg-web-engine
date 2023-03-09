import { Body2DOptions, BodyShape2DDescriptor, IGg2dBodyFactory, Shape2DDescriptor } from '@gg-web-engine/core';
import { Gg2dBody } from './gg-2d-body';
import { Bodies, IBodyDefinition, Vector } from 'matter-js';

export class Gg2dBodyFactory implements IGg2dBodyFactory<Gg2dBody, any> {

  createPrimitiveBody(descriptor: BodyShape2DDescriptor): Gg2dBody {
    switch (descriptor.shape) {
      case 'SQUARE':
        return new Gg2dBody(Bodies.rectangle(0, 0, descriptor.dimensions.x, descriptor.dimensions.y, this.transformOptions(descriptor)));
      case 'CIRCLE':
        return new Gg2dBody(Bodies.circle(0, 0, descriptor.radius, this.transformOptions(descriptor)));
    }
  }

  createTrigger(descriptor: Shape2DDescriptor): any {
    throw new Error('Triggers not implemented for Matter.js');
  }

  private transformOptions(options: Partial<Body2DOptions>): IBodyDefinition {
    const res: IBodyDefinition = {
      isStatic: options.dynamic !== undefined ? !options.dynamic : !options.mass,
      mass: options.mass,
      restitution: options.restitution,
      friction: options.friction,
      position: Vector.create(options.position?.x || 0, options.position?.y || 0),
      angle: options.rotation,
    };
    for (const key in res) {
      if ((res as any)[key] === undefined) {
        delete (res as any)[key];
      }
    }
    return res;
  }

}
