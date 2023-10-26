import { GgWorld, Pnt3, Point3, Point4, Qtrn, RendererOptions } from '../base';
import { Gg3dLoader } from './loader';
import { Entity3d } from './entities/entity-3d';
import { BodyShape3DDescriptor } from './models/shapes';
import { IVisualScene3dComponent } from './components/rendering/i-visual-scene-3d.component';
import { IPhysicsWorld3dComponent } from './components/physics/i-physics-world-3d';
import { Renderer3dEntity } from './entities/renderer-3d.entity';
import { ICameraComponent } from './components/rendering/i-camera.component';
import { IRenderer3dComponent } from './components/rendering/i-renderer-3d.component';

export class Gg3dWorld<
  V extends IVisualScene3dComponent = IVisualScene3dComponent,
  P extends IPhysicsWorld3dComponent = IPhysicsWorld3dComponent,
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
  ): Entity3d<V, P> {
    const entity = new Entity3d<V, P>(
      this.visualScene.factory.createPrimitive(descr.shape),
      this.physicsWorld.factory.createRigidBody(descr),
    );
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }

  addRenderer<
    CC extends ICameraComponent<V> = ICameraComponent<V>,
    RC extends IRenderer3dComponent<V, CC> = IRenderer3dComponent<V, CC>,
  >(camera: CC, canvas?: HTMLCanvasElement, rendererOptions?: Partial<RendererOptions>): Renderer3dEntity<V, CC, RC> {
    const entity = new Renderer3dEntity<V, CC, RC>(
      this.visualScene.createRenderer(camera, canvas, rendererOptions) as RC,
    );
    this.addEntity(entity);
    return entity;
  }
}
