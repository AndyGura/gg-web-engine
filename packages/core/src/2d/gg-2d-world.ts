import { GgWorld } from '../base/gg-world';
import { Point2 } from '../base/models/points';
import { IGg2dPhysicsWorld, IGg2dVisualScene } from './interfaces';

export class Gg2dWorld extends GgWorld<Point2, number> {

  constructor(
    public readonly visualScene: IGg2dVisualScene,
    public readonly physicsWorld: IGg2dPhysicsWorld,
  ) {
    super(visualScene, physicsWorld)
  }

}
