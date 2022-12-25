import { GgWorld } from '../base/gg-world';
import { Point3, Point4 } from '../base/models/points';
import { IGg3dPhysicsWorld, IGg3dVisualScene } from './interfaces';
import { Gg3dLoader } from './loader';

export class Gg3dWorld extends GgWorld<Point3, Point4> {

  public readonly loader: Gg3dLoader;

  constructor(
    public readonly visualScene: IGg3dVisualScene,
    public readonly physicsWorld: IGg3dPhysicsWorld,
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
      this.registerConsoleCommand('ph_timescale', async (...args: string[]) => {
        this.physicsWorld.timeScale = +args[0];
        return JSON.stringify(this.physicsWorld.timeScale);
      });
    }
  }

}
