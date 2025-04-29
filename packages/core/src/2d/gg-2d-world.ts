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
  rendererExtraOpts: {};
  texture: unknown;
};

export type PhysicsTypeDocRepo2D = {
  factory: IPhysicsBody2dComponentFactory;
  rigidBody: IRigidBody2dComponent;
  trigger: ITrigger2dComponent;
};

export type Gg2dWorldTypeDocRepo = {
  vTypeDoc: VisualTypeDocRepo2D;
  pTypeDoc: PhysicsTypeDocRepo2D;
};

export type Gg2dWorldSceneTypeRepo<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> = {
  visualScene: IVisualScene2dComponent<TypeDoc['vTypeDoc']>;
  physicsWorld: IPhysicsWorld2dComponent<TypeDoc['pTypeDoc']>;
};

export class Gg2dWorld<
  TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo,
  SceneTypeDoc extends Gg2dWorldSceneTypeRepo<TypeDoc> = Gg2dWorldSceneTypeRepo<TypeDoc>,
> extends GgWorld<Point2, number, TypeDoc, SceneTypeDoc> {
  constructor(
    public readonly visualScene: SceneTypeDoc['visualScene'],
    public readonly physicsWorld: SceneTypeDoc['physicsWorld'],
  ) {
    super(visualScene, physicsWorld);
  }

  addPrimitiveRigidBody(
    descr: BodyShape2DDescriptor,
    position: Point2 = Pnt2.O,
    rotation: number = 0,
    material: DisplayObject2dOpts<TypeDoc['vTypeDoc']['texture']> = {},
  ): Entity2d<TypeDoc> {
    const entity = new Entity2d<TypeDoc>({
      object2D: this.visualScene.factory.createPrimitive(descr.shape, material),
      objectBody: this.physicsWorld.factory.createRigidBody(descr),
    });
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }

  addRenderer(
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & TypeDoc['vTypeDoc']['rendererExtraOpts']>,
  ): Renderer2dEntity<TypeDoc['vTypeDoc']> {
    const entity = new Renderer2dEntity(this.visualScene.createRenderer(canvas, rendererOptions));
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
    ggstatic.registerConsoleCommand(
      this,
      'gravity',
      async (...args: string[]) => {
        if (args.length == 1) {
          args = ['0', args[0]]; // mean Y axis
        }
        if (args.length > 0) {
          if (isNaN(+args[0]) || isNaN(+args[1])) {
            throw new Error('Wrong arguments');
          }
          this.physicsWorld.gravity = { x: +args[0], y: +args[1] };
        }
        return JSON.stringify(this.physicsWorld.gravity);
      },
      'args: [ ?float, ?float ]; Get or set 2D world gravity vector. 1 argument sets' +
        ' vector {x: 0, y: value}, 2 arguments sets the whole vector.' +
        ' Default value is "9.82" or "0 9.82"',
    );
  }
}
