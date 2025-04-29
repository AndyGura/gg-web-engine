import { GgWorld, Pnt3, Point3, Point4, Qtrn, RendererOptions } from '../base';
import { Gg3dLoader } from './loader';
import { Entity3d } from './entities/entity-3d';
import { BodyShape3DDescriptor } from './models/shapes';
import { IVisualScene3dComponent } from './components/rendering/i-visual-scene-3d.component';
import { Renderer3dEntity } from './entities/renderer-3d.entity';
import { ICameraComponent } from './components/rendering/i-camera.component';
import { IRenderer3dComponent } from './components/rendering/i-renderer-3d.component';
import { IPhysicsWorld3dComponent } from './components/physics/i-physics-world-3d.component';
import { DisplayObject3dOpts, IDisplayObject3dComponentFactory, IPhysicsBody3dComponentFactory } from './factories';
import { IDisplayObject3dComponent } from './components/rendering/i-display-object-3d.component';
import { IRaycastVehicleComponent } from './components/physics/i-raycast-vehicle.component';
import { IRigidBody3dComponent } from './components/physics/i-rigid-body-3d.component';
import { ITrigger3dComponent } from './components/physics/i-trigger-3d.component';
import { IDisplayObject3dComponentLoader, IPhysicsBody3dComponentLoader } from './loaders';

export type VisualTypeDocRepo3D = {
  factory: IDisplayObject3dComponentFactory;
  loader: IDisplayObject3dComponentLoader;
  displayObject: IDisplayObject3dComponent;
  renderer: IRenderer3dComponent;
  rendererExtraOpts: {};
  camera: ICameraComponent;
  texture: unknown;
};

export type PhysicsTypeDocRepo3D = {
  factory: IPhysicsBody3dComponentFactory;
  loader: IPhysicsBody3dComponentLoader;
  rigidBody: IRigidBody3dComponent;
  trigger: ITrigger3dComponent;
  raycastVehicle: IRaycastVehicleComponent;
};

export type Gg3dWorldTypeDocRepo = {
  vTypeDoc: VisualTypeDocRepo3D;
  pTypeDoc: PhysicsTypeDocRepo3D;
};

export type Gg3dWorldSceneTypeRepo<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  visualScene: IVisualScene3dComponent<TypeDoc['vTypeDoc']> | null;
  physicsWorld: IPhysicsWorld3dComponent<TypeDoc['pTypeDoc']> | null;
};

export class Gg3dWorld<
  TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo,
  SceneTypeDoc extends Gg3dWorldSceneTypeRepo<TypeDoc> = Gg3dWorldSceneTypeRepo<TypeDoc>,
> extends GgWorld<Point3, Point4, TypeDoc, SceneTypeDoc> {
  public readonly loader: Gg3dLoader<TypeDoc>;

  constructor(args: { visualScene?: SceneTypeDoc['visualScene']; physicsWorld?: SceneTypeDoc['physicsWorld'] }) {
    super(args);
    this.loader = new Gg3dLoader(this);
  }

  addPrimitiveRigidBody(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
    material: DisplayObject3dOpts<TypeDoc['vTypeDoc']['texture']> = {},
  ): Entity3d<TypeDoc> {
    const entity = new Entity3d<TypeDoc>({
      object3D: this.visualScene?.factory.createPrimitive(descr.shape, material),
      objectBody: this.physicsWorld?.factory.createRigidBody(descr),
    });
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }

  addRenderer(
    camera: TypeDoc['vTypeDoc']['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & TypeDoc['vTypeDoc']['rendererExtraOpts']>,
  ): Renderer3dEntity<TypeDoc['vTypeDoc']> {
    if (!this.visualScene) {
      throw new Error('Cannot add renderer to the world without visual scene');
    }
    const entity = new Renderer3dEntity(this.visualScene.createRenderer(camera, canvas, rendererOptions));
    this.addEntity(entity);
    return entity;
  }

  protected registerConsoleCommands(ggstatic: {
    registerConsoleCommand: (
      world: GgWorld<any, any> | null,
      command: string,
      handler: (...args: string[]) => Promise<string>,
      doc?: string,
    ) => void;
  }) {
    super.registerConsoleCommands(ggstatic);
    if (this.physicsWorld) {
      ggstatic.registerConsoleCommand(
        this,
        'gravity',
        async (...args: string[]) => {
          if (args.length == 1) {
            args = ['0', '0', '' + -+args[0]]; // mean -Z axis
          }
          if (args.length > 0) {
            if (isNaN(+args[0]) || isNaN(+args[1]) || isNaN(+args[2])) {
              throw new Error('Wrong arguments');
            }
            this.physicsWorld!.gravity = { x: +args[0], y: +args[1], z: +args[2] };
          }
          return JSON.stringify(this.physicsWorld!.gravity);
        },
        'args: [ ?float, ?float, ?float ]; Get or set 3D world gravity vector. 1 argument sets ' +
          'vector {x: 0, y: 0, z: -value}, 3 arguments set the whole vector.' +
          ' Default value is "9.82" or "0 0 -9.82"',
      );
    }
  }
}
