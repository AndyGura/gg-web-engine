import { GgWorld } from '../base/gg-world';
import { Point2 } from '../base/models/points';
import { IGg2dPhysicsWorld, IGg2dVisualScene } from './interfaces';
import { BodyShape2DDescriptor } from './models/shapes';
import { Gg2dEntity } from './entities/gg-2d-entity';
import { Pnt2 } from '../base/math/point2';

export class Gg2dWorld<
  V extends IGg2dVisualScene = IGg2dVisualScene,
  P extends IGg2dPhysicsWorld = IGg2dPhysicsWorld,
> extends GgWorld<Point2, number, V, P> {
  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false,
  ) {
    super(visualScene, physicsWorld, consoleEnabled);
    if (consoleEnabled) {
      this.registerConsoleCommand(
        'ph_gravity',
        async (...args: string[]) => {
          if (args.length == 1) {
            args = ['0', args[0]]; // mean Y axis
          }
          if (args.length > 0) {
            this.physicsWorld.gravity = { x: +args[0], y: +args[1] };
          }
          return JSON.stringify(this.physicsWorld.gravity);
        },
        'args: [float] or [float float]; change 2D world gravity vector. 1 argument means ' +
          '{x: 0, y: value}, 2 arguments set the whole vector. Default value is "9.82" or "0 9.82"',
      );
    }
  }

  addPrimitiveRigidBody(descr: BodyShape2DDescriptor, position: Point2 = Pnt2.O, rotation: number = 0): Gg2dEntity {
    const entity = new Gg2dEntity(
      this.visualScene.factory.createPrimitive(descr.shape),
      this.physicsWorld.factory.createRigidBody(descr),
    );
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }
}
