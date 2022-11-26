import { GgWorld } from '../base/gg-world';
import { Point3, Point4 } from '../base/models/points';
import { IGg3dPhysicsWorld, IGg3dVisualScene } from './interfaces';
import { Gg3dLoader } from './loader';

export class Gg3dWorld extends GgWorld<Point3, Point4> {

  public readonly loader: Gg3dLoader;

  constructor(
    public readonly visualScene: IGg3dVisualScene,
    public readonly physicsWorld: IGg3dPhysicsWorld,
  ) {
    super(visualScene, physicsWorld);
    this.loader = new Gg3dLoader(this);
  }

}
