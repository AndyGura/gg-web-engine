import { GgWorld } from '../base/gg-world';
import { Point2 } from '../base/models/points';
import { IGg2dPhysicsWorld, IGg2dVisualScene } from './interfaces';

export class Gg2dWorld extends GgWorld<Point2, number> {

  constructor(
    public readonly visualScene: IGg2dVisualScene,
    public readonly physicsWorld: IGg2dPhysicsWorld,
    protected readonly consoleEnabled: boolean = false,
  ) {
    super(visualScene, physicsWorld, consoleEnabled);
    if (consoleEnabled) {
      this.registerConsoleCommand('ph_gravity', async (...args: string[]) => {
        if (args.length == 1) {
          args = ['0', args[0]]; // mean Y axis
        }
        if (args.length > 0) {
          this.physicsWorld.gravity = { x: +args[0], y: +args[1] };
        }
        return JSON.stringify(this.physicsWorld.gravity);
      });
    }
  }

}
