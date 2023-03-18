import { GgWorld } from '../base/gg-world';
import { Point3, Point4 } from '../base/models/points';
import { IGg3dPhysicsWorld, IGg3dVisualScene } from './interfaces';
import { Gg3dLoader } from './loader';

export class Gg3dWorld<V extends IGg3dVisualScene = IGg3dVisualScene, P extends IGg3dPhysicsWorld = IGg3dPhysicsWorld> extends GgWorld<Point3, Point4, V, P> {

  public readonly loader: Gg3dLoader;

  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false,
  ) {
    super(visualScene, physicsWorld, consoleEnabled);
    this.loader = new Gg3dLoader(this);
    if (consoleEnabled) {
      this.registerConsoleCommand('ph_gravity', async (...args: string[]) => {
        if (args.length == 1) {
          args = ['0', '0', '' + -+args[0]]; // mean -Z axis
        }
        if (args.length > 0) {
          this.physicsWorld.gravity = { x: +args[0], y: +args[1], z: +args[2] };
        }
        return JSON.stringify(this.physicsWorld.gravity);
      });
    }
  }

}
