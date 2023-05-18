import { GgWorld } from '../base/gg-world';
import { Point3, Point4 } from '../base/models/points';
import { IGg3dPhysicsWorld, IGg3dVisualScene } from './interfaces';
import { Gg3dLoader } from './loader';
import { Gg3dEntity } from './entities/gg-3d-entity';
import { BodyShape3DDescriptor } from './models/shapes';
import { Qtrn } from '../base/math/quaternion';
import { Pnt3 } from '../base/math/point3';

export class Gg3dWorld<
  V extends IGg3dVisualScene = IGg3dVisualScene,
  P extends IGg3dPhysicsWorld = IGg3dPhysicsWorld,
> extends GgWorld<Point3, Point4, V, P> {
  public readonly loader: Gg3dLoader;

  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false,
  ) {
    super(visualScene, physicsWorld, consoleEnabled);
    this.loader = new Gg3dLoader(this);
    if (consoleEnabled) {
      this.registerConsoleCommand(
        'ph_gravity',
        async (...args: string[]) => {
          if (args.length == 1) {
            args = ['0', '0', '' + -+args[0]]; // mean -Z axis
          }
          if (args.length > 0) {
            this.physicsWorld.gravity = { x: +args[0], y: +args[1], z: +args[2] };
          }
          return JSON.stringify(this.physicsWorld.gravity);
        },
        'args: [float] or [float float float]; change 3D world gravity vector. 1 argument means ' +
          '{x: 0, y: 0, z: -value}, 3 arguments set the whole vector. Default value is "9.82" or "0 0 -9.82"',
      );
    }
  }

  addPrimitiveRigidBody(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
  ): Gg3dEntity {
    const entity = new Gg3dEntity(
      this.visualScene.factory.createPrimitive(descr.shape),
      this.physicsWorld.factory.createRigidBody(descr),
    );
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }
}
