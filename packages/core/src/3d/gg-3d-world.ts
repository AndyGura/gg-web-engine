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

export class Gg3dWorld<
  VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
  VS extends IVisualScene3dComponent<VTypeDoc> = IVisualScene3dComponent<VTypeDoc>,
  PW extends IPhysicsWorld3dComponent<PTypeDoc> = IPhysicsWorld3dComponent<PTypeDoc>,
> extends GgWorld<Point3, Point4, VTypeDoc, PTypeDoc, VS, PW> {
  public readonly loader: Gg3dLoader<VTypeDoc, PTypeDoc>;

  constructor(public readonly visualScene: VS, public readonly physicsWorld: PW) {
    super(visualScene, physicsWorld);
    this.loader = new Gg3dLoader(this);
    if ((window as any).ggstatic) {
      (window as any).ggstatic.registerConsoleCommand(
        this,
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
    material: DisplayObject3dOpts<VTypeDoc['texture']> = {},
  ): Entity3d<VTypeDoc, PTypeDoc> {
    const entity = new Entity3d<VTypeDoc, PTypeDoc>(
      this.visualScene.factory.createPrimitive(descr.shape, material),
      this.physicsWorld.factory.createRigidBody(descr),
    );
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }

  addRenderer(
    camera: VTypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions>,
  ): Renderer3dEntity<VTypeDoc> {
    const entity = new Renderer3dEntity(this.visualScene.createRenderer(camera, canvas, rendererOptions));
    this.addEntity(entity);
    return entity;
  }
}
