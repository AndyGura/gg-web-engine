import { GgWorld, Pnt2, Point2, RendererOptions } from '../base';
import { Gg2dLoader } from './loader';
import { BodyShape2DDescriptor } from './models/shapes';
import { Entity2d } from './entities/entity-2d';
import { IPhysicsWorld2dComponent } from './components/physics/i-physics-world-2d.component';
import { IVisualScene2dComponent } from './components/rendering/i-visual-scene-2d.component';
import { Renderer2dEntity } from './entities/renderer-2d.entity';
import { DisplayObject2dOpts, IDisplayObject2dComponentFactory, IPhysicsBody2dComponentFactory } from './factories';
import { IRenderer2dComponent } from './components/rendering/i-renderer-2d.component';
import { IDisplayObject2dComponent } from './components/rendering/i-display-object-2d.component';
import { ICamera2dComponent } from './components/rendering/i-camera-2d.component';
import { ITrigger2dComponent } from './components/physics/i-trigger-2d.component';
import { IRigidBody2dComponent } from './components/physics/i-rigid-body-2d.component';

export type VisualTypeDocRepo2D = {
  factory: IDisplayObject2dComponentFactory;
  displayObject: IDisplayObject2dComponent;
  renderer: IRenderer2dComponent;
  rendererExtraOpts: {};
  camera: ICamera2dComponent;
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
// utility types to create world type doc by defining either vTypeDoc or pTypeDoc only
export type Gg2dWorldTypeDocVPatch<VTypeDoc extends VisualTypeDocRepo2D> = Omit<Gg2dWorldTypeDocRepo, 'vTypeDoc'> & {
  vTypeDoc: VTypeDoc;
};
export type Gg2dWorldTypeDocPPatch<PTypeDoc extends PhysicsTypeDocRepo2D> = Omit<Gg2dWorldTypeDocRepo, 'pTypeDoc'> & {
  pTypeDoc: PTypeDoc;
};

export type Gg2dWorldSceneTypeRepo<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> = {
  visualScene: IVisualScene2dComponent<TypeDoc['vTypeDoc']> | null;
  physicsWorld: IPhysicsWorld2dComponent<TypeDoc['pTypeDoc']> | null;
};
// utility types to create world scene type doc by defining either visualScene or physicsWorld type only
export type Gg2dWorldSceneTypeDocVPatch<
  VTypeDoc extends VisualTypeDocRepo2D,
  VS extends IVisualScene2dComponent<VTypeDoc> | null,
> = Omit<Gg2dWorldSceneTypeRepo, 'visualScene'> & { visualScene: VS };
export type Gg2dWorldSceneTypeDocPPatch<
  PTypeDoc extends PhysicsTypeDocRepo2D,
  PW extends IPhysicsWorld2dComponent<PTypeDoc> | null,
> = Omit<Gg2dWorldSceneTypeRepo, 'physicsWorld'> & { physicsWorld: PW };

// A helper type to build a full type for the world according to installed modules
// Each module provides its type, like "PixiGgWorld" or "Rapier2dGgWorld"
// Caller code can define type like this: world: TypedGg2dWorld<ThreeGgWorld, Rapier2dGgWorld>
// Important: visual library world comes first, then physics library
export type TypedGg2dWorld<VW extends Gg2dWorld<any> | null, PW extends Gg2dWorld<any> | null> = VW extends Gg2dWorld<
  infer VTD,
  infer VSTD
> | null
  ? PW extends Gg2dWorld<infer PTD, infer PSTD> | null
    ? Gg2dWorld<
        {
          vTypeDoc: VTD['vTypeDoc'];
          pTypeDoc: PTD['pTypeDoc'];
        },
        {
          visualScene: VSTD['visualScene'];
          physicsWorld: PSTD['physicsWorld'];
        }
      >
    : never
  : never;

export class Gg2dWorld<
  TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo,
  SceneTypeDoc extends Gg2dWorldSceneTypeRepo<TypeDoc> = Gg2dWorldSceneTypeRepo<TypeDoc>,
> extends GgWorld<Point2, number, TypeDoc, SceneTypeDoc> {
  public readonly loader: Gg2dLoader<TypeDoc>;

  constructor(args: { visualScene?: SceneTypeDoc['visualScene']; physicsWorld?: SceneTypeDoc['physicsWorld'] }) {
    super(args);
    this.loader = new Gg2dLoader(this);
  }

  addPrimitiveRigidBody(
    descr: BodyShape2DDescriptor,
    position: Point2 = Pnt2.O,
    rotation: number = 0,
    material: DisplayObject2dOpts<TypeDoc['vTypeDoc']['texture']> = {},
  ): Entity2d<TypeDoc> {
    const entity = new Entity2d<TypeDoc>({
      object2D: this.visualScene?.factory.createPrimitive(descr.shape, material),
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
  ): Renderer2dEntity<TypeDoc['vTypeDoc']> {
    if (!this.visualScene) {
      throw new Error('Cannot add renderer to the world without visual scene');
    }
    const entity = new Renderer2dEntity(this.visualScene.createRenderer(camera, canvas, rendererOptions));
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
      'set_position',
      async (...args: string[]) => {
        const [name, x, y] = args;
        if (!name) {
          throw new Error('usage: set_position <name> <x> <y>');
        }
        const entity = this.getEntityByName(name);
        if (!('position' in entity)) {
          throw new Error(`Entity "${name}" (${entity.constructor.name}) has no position`);
        }
        if ([x, y].some(v => v === undefined || isNaN(+v))) {
          throw new Error('usage: set_position <name> <x> <y>');
        }
        (entity as unknown as Entity2d<TypeDoc>).position = { x: +x, y: +y };
        return JSON.stringify((entity as unknown as Entity2d<TypeDoc>).position);
      },
      'args: [ string, float, float ]; Teleport a named entity to world-space coordinates. Use ' +
        '"entities"/"entity <name>" to find entity names and their current position',
    );
    ggstatic.registerConsoleCommand(
      this,
      'set_rotation',
      async (...args: string[]) => {
        const [name, angle] = args;
        if (!name) {
          throw new Error('usage: set_rotation <name> <angleRadians>');
        }
        const entity = this.getEntityByName(name);
        if (!('rotation' in entity)) {
          throw new Error(`Entity "${name}" (${entity.constructor.name}) has no rotation`);
        }
        if (angle === undefined || isNaN(+angle)) {
          throw new Error('usage: set_rotation <name> <angleRadians>');
        }
        (entity as unknown as Entity2d<TypeDoc>).rotation = +angle;
        return JSON.stringify((entity as unknown as Entity2d<TypeDoc>).rotation);
      },
      'args: [ string, float ]; Rotate a named entity to the given angle, in radians',
    );
    ggstatic.registerConsoleCommand(
      this,
      'spawn',
      async (...args: string[]) => {
        const [shapeArg, x, y, dynamicArg] = args;
        if ([x, y].some(v => v === undefined || isNaN(+v))) {
          throw new Error('usage: spawn <SQUARE|CIRCLE> <x> <y> [dynamic=0|1]');
        }
        const dynamic = dynamicArg === undefined ? true : dynamicArg === '1';
        let shape: BodyShape2DDescriptor['shape'];
        switch ((shapeArg || '').toUpperCase()) {
          case 'SQUARE':
            shape = { shape: 'SQUARE', dimensions: { x: 1, y: 1 } };
            break;
          case 'CIRCLE':
            shape = { shape: 'CIRCLE', radius: 0.5 };
            break;
          default:
            throw new Error(`Unknown shape "${shapeArg}". Use SQUARE|CIRCLE`);
        }
        const entity = this.addPrimitiveRigidBody({ shape, body: { dynamic } }, { x: +x, y: +y });
        return `spawned "${entity.name}" (${shape.shape}) at ${JSON.stringify(entity.position)}`;
      },
      'args: [ SQUARE|CIRCLE, float, float, 0|1? ]; Spawn a default-sized primitive rigid body at ' +
        'world-space coordinates, for probing physics. dynamic (last arg) defaults to 1 (falls ' +
        'under gravity); pass 0 for a static prop',
    );
    if (this.physicsWorld) {
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
            this.physicsWorld!.gravity = { x: +args[0], y: +args[1] };
          }
          return JSON.stringify(this.physicsWorld!.gravity);
        },
        'args: [ ?float, ?float ]; Get or set 2D world gravity vector. 1 argument sets' +
          ' vector {x: 0, y: value}, 2 arguments sets the whole vector.' +
          ' Default value is "9.82" or "0 9.82"',
      );
    }
  }
}
