import { IGg2dBodyFactory } from '@gg-web-engine/core';
import { Gg2dBody } from './gg-2d-body';
import { Bodies } from 'matter-js';

export class Gg2dBodyFactory implements IGg2dBodyFactory {

  public createSquare(width: number, height: number, mass: number): Gg2dBody {
    const body = Bodies.rectangle(0, 0, width, height, { mass, isStatic: mass == 0 });
    return new Gg2dBody(body);
  }

  public createCircle(radius: number, mass: number): Gg2dBody {
    return new Gg2dBody(Bodies.circle(0, 0, radius, { mass, isStatic: mass == 0 }));
  }

}
