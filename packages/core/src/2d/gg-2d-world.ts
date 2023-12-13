import { GgWorld, Pnt2, Point2, RendererOptions } from '../base';
import { BodyShape2DDescriptor } from './models/shapes';
import { Entity2d } from './entities/entity-2d';
import { IPhysicsWorld2dComponent } from './components/physics/i-physics-world-2d.component';
import { IVisualScene2dComponent } from './components/rendering/i-visual-scene-2d.component';
import { Renderer2dEntity } from './entities/renderer-2d.entity';
import { DisplayObject2dOpts, IDisplayObject2dComponentFactory, IPhysicsBody2dComponentFactory } from './factories';
import { IRenderer2dComponent } from './components/rendering/i-renderer-2d.component';
import { IDisplayObject2dComponent } from './components/rendering/i-display-object-2d.component';
import { ITrigger2dComponent } from './components/physics/i-trigger-2d.component';
import { IRigidBody2dComponent } from './components/physics/i-rigid-body-2d.component';

export type VisualTypeDocRepo2D = {
  factory: IDisplayObject2dComponentFactory;
  displayObject: IDisplayObject2dComponent;
  renderer: IRenderer2dComponent;
  texture: unknown;
};

export type PhysicsTypeDocRepo2D = {
  factory: IPhysicsBody2dComponentFactory;
  rigidBody: IRigidBody2dComponent;
  trigger: ITrigger2dComponent;
};

export class Gg2dWorld<
  VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
  PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D,
  VS extends IVisualScene2dComponent<VTypeDoc> = IVisualScene2dComponent<VTypeDoc>,
  PW extends IPhysicsWorld2dComponent<PTypeDoc> = IPhysicsWorld2dComponent<PTypeDoc>,
> extends GgWorld<Point2, number, VTypeDoc, PTypeDoc, VS, PW> {
  constructor(public readonly visualScene: VS, public readonly physicsWorld: PW) {
    super(visualScene, physicsWorld);
    if ((window as any).ggstatic) {
      (window as any).ggstatic.registerConsoleCommand(
        this,
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

  addPrimitiveRigidBody(
    descr: BodyShape2DDescriptor,
    position: Point2 = Pnt2.O,
    rotation: number = 0,
    material: DisplayObject2dOpts<VTypeDoc['texture']> = {},
  ): Entity2d<VTypeDoc, PTypeDoc> {
    const entity = new Entity2d<VTypeDoc, PTypeDoc>(
      this.visualScene.factory.createPrimitive(descr.shape, material),
      this.physicsWorld.factory.createRigidBody(descr),
    );
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }

  addRenderer(canvas?: HTMLCanvasElement, rendererOptions?: Partial<RendererOptions>): Renderer2dEntity<VTypeDoc> {
    const entity = new Renderer2dEntity(this.visualScene.createRenderer(canvas, rendererOptions));
    this.addEntity(entity);
    return entity;
  }
}
