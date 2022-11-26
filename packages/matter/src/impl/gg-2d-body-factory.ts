import { Body2DOptions, IGg2dBodyFactory, Point2 } from '@gg-web-engine/core';
import { Gg2dBody } from './gg-2d-body';
import { Bodies, IBodyDefinition, Vector } from 'matter-js';

export class Gg2dBodyFactory implements IGg2dBodyFactory {

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

  public createSquare(dimensions: Point2, options: Partial<Body2DOptions>): Gg2dBody {
    return new Gg2dBody(Bodies.rectangle(0, 0, dimensions.x, dimensions.y, this.transformOptions(options)));
  }

  public createCircle(radius: number, options: Partial<Body2DOptions>): Gg2dBody {
    return new Gg2dBody(Bodies.circle(0, 0, radius, this.transformOptions(options)));
  }

}
