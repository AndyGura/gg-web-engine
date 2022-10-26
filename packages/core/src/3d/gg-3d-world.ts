import { GgWorld } from '../base/gg-world';
import { Point3, Point4 } from '../base/models/points';
import { IGg3dPhysicsWorld, IGg3dVisualScene } from './interfaces';

export class Gg3dWorld extends GgWorld<Point3, Point4> {

  constructor(
    public readonly visualScene: IGg3dVisualScene,
    public readonly physicsWorld: IGg3dPhysicsWorld,
  ) {
    super(visualScene, physicsWorld)
  }

}
