import { GgWorld, Pnt3, Point3, Point4, Qtrn, RendererOptions } from '../base';
import { Gg3dLoader } from './loader';
import { Entity3d } from './entities/entity-3d';
import { BodyShape3DDescriptor } from './models/shapes';
import { IVisualScene3dComponent } from './components/rendering/i-visual-scene-3d.component';
import { Renderer3dEntity } from './entities/renderer-3d.entity';
import { ICamera3dComponent } from './components/rendering/i-camera-3d.component';
import { IRenderer3dComponent } from './components/rendering/i-renderer-3d.component';
import { IPhysicsWorld3dComponent } from './components/physics/i-physics-world-3d.component';
import { DisplayObject3dOpts, IDisplayObject3dComponentFactory, IPhysicsBody3dComponentFactory } from './factories';
import { IDisplayObject3dComponent } from './components/rendering/i-display-object-3d.component';
import { IRaycastVehicleComponent } from './components/physics/i-raycast-vehicle.component';
import { IRigidBody3dComponent } from './components/physics/i-rigid-body-3d.component';
import { ITrigger3dComponent } from './components/physics/i-trigger-3d.component';
import { ICharacterController3dComponent } from './components/physics/i-character-controller-3d.component';
import { IDisplayObject3dComponentLoader, IPhysicsBody3dComponentLoader } from './loaders';
import { CharacterController3dEntity } from './entities/character-controller-3d.entity';
import { PlayerCharacterController } from './entities/controllers/input/player-character.controller';
import { Grabbable3dEntity, Grabbable3dEntityOptions } from './entities/grabbable-3d.entity';

export type VisualTypeDocRepo3D = {
  factory: IDisplayObject3dComponentFactory;
  loader: IDisplayObject3dComponentLoader;
  displayObject: IDisplayObject3dComponent;
  renderer: IRenderer3dComponent;
  rendererExtraOpts: {};
  camera: ICamera3dComponent;
  texture: unknown;
};

export type PhysicsTypeDocRepo3D = {
  factory: IPhysicsBody3dComponentFactory;
  loader: IPhysicsBody3dComponentLoader;
  rigidBody: IRigidBody3dComponent;
  trigger: ITrigger3dComponent;
  raycastVehicle: IRaycastVehicleComponent;
  characterController: ICharacterController3dComponent;
};

export type Gg3dWorldTypeDocRepo = {
  vTypeDoc: VisualTypeDocRepo3D;
  pTypeDoc: PhysicsTypeDocRepo3D;
};
// utility types to create world type doc by defining either vTypeDoc or pTypeDoc only
export type Gg3dWorldTypeDocVPatch<VTypeDoc extends VisualTypeDocRepo3D> = Omit<Gg3dWorldTypeDocRepo, 'vTypeDoc'> & {
  vTypeDoc: VTypeDoc;
};
export type Gg3dWorldTypeDocPPatch<PTypeDoc extends PhysicsTypeDocRepo3D> = Omit<Gg3dWorldTypeDocRepo, 'pTypeDoc'> & {
  pTypeDoc: PTypeDoc;
};

export type Gg3dWorldSceneTypeRepo<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  visualScene: IVisualScene3dComponent<TypeDoc['vTypeDoc']> | null;
  physicsWorld: IPhysicsWorld3dComponent<TypeDoc['pTypeDoc']> | null;
};
// utility types to create world scene type doc by defining either visualScene or physicsWorld type only
export type Gg3dWorldSceneTypeDocVPatch<
  VTypeDoc extends VisualTypeDocRepo3D,
  VS extends IVisualScene3dComponent<VTypeDoc> | null,
> = Omit<Gg3dWorldSceneTypeRepo, 'visualScene'> & { visualScene: VS };
export type Gg3dWorldSceneTypeDocPPatch<
  PTypeDoc extends PhysicsTypeDocRepo3D,
  PW extends IPhysicsWorld3dComponent<PTypeDoc> | null,
> = Omit<Gg3dWorldSceneTypeRepo, 'physicsWorld'> & { physicsWorld: PW };

// A helper type to build a full type for the world according to installed modules
// Each module provides its type, like "ThreeGgWorld" or "Rapier3dGgWorld"
// Caller code can define type like this: world: TypedGg3dWorld<ThreeGgWorld, AmmoGgWorld>
// Important: visual library world comes first, then physics library
export type TypedGg3dWorld<VW extends Gg3dWorld<any> | null, PW extends Gg3dWorld<any> | null> = VW extends Gg3dWorld<
  infer VTD,
  infer VSTD
> | null
  ? PW extends Gg3dWorld<infer PTD, infer PSTD> | null
    ? Gg3dWorld<
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

  /**
   * Same as `addPrimitiveRigidBody`, but the returned entity is a `Grabbable3dEntity` - a prop
   * that can be picked up/carried/thrown (see that class and `ObjectGrabController`). `descr.body`
   * must describe a dynamic body (`dynamic: true`) - a static/kinematic prop can't be carried.
   */
  addGrabbablePrimitive(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
    material: DisplayObject3dOpts<TypeDoc['vTypeDoc']['texture']> = {},
    grabOptions: Partial<Grabbable3dEntityOptions> = {},
  ): Grabbable3dEntity<TypeDoc> {
    const entity = new Grabbable3dEntity<TypeDoc>(
      {
        object3D: this.visualScene?.factory.createPrimitive(descr.shape, material),
        objectBody: this.physicsWorld?.factory.createRigidBody(descr),
      },
      grabOptions,
    );
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
    ggstatic.registerConsoleCommand(
      this,
      'set_position',
      async (...args: string[]) => {
        const [name, x, y, z] = args;
        if (!name) {
          throw new Error('usage: set_position NAME X Y Z');
        }
        const entity = this.getEntityByName(name);
        if (!('position' in entity)) {
          throw new Error(`Entity "${name}" (${entity.constructor.name}) has no position`);
        }
        if ([x, y, z].some(v => v === undefined || isNaN(+v))) {
          throw new Error('usage: set_position NAME X Y Z');
        }
        (entity as unknown as Entity3d<TypeDoc>).position = { x: +x, y: +y, z: +z };
        return JSON.stringify((entity as unknown as Entity3d<TypeDoc>).position);
      },
      'args: [ string, float, float, float ]; Teleport a named entity to world-space coordinates. ' +
        'Use "entities"/"entity NAME" to find entity names and their current position',
    );
    ggstatic.registerConsoleCommand(
      this,
      'set_rotation',
      async (...args: string[]) => {
        const [name, ...rest] = args;
        if (!name) {
          throw new Error('usage: set_rotation NAME X Y Z [W]');
        }
        const entity = this.getEntityByName(name);
        if (!('rotation' in entity)) {
          throw new Error(`Entity "${name}" (${entity.constructor.name}) has no rotation`);
        }
        const nums = rest.map(Number);
        if (nums.length !== 3 && nums.length !== 4) {
          throw new Error('usage: set_rotation NAME X Y Z (euler, radians) OR set_rotation NAME X Y Z W (quaternion)');
        }
        if (nums.some(Number.isNaN)) {
          throw new Error('Wrong arguments');
        }
        const rotation: Point4 =
          nums.length === 4
            ? { x: nums[0], y: nums[1], z: nums[2], w: nums[3] }
            : Qtrn.fromEuler({ x: nums[0], y: nums[1], z: nums[2] });
        (entity as unknown as Entity3d<TypeDoc>).rotation = rotation;
        return JSON.stringify((entity as unknown as Entity3d<TypeDoc>).rotation);
      },
      'args: [ string, float, float, float, float? ]; Rotate a named entity. 3 numbers are euler ' +
        'angles in radians, 4 numbers are a raw quaternion (x y z w)',
    );
    ggstatic.registerConsoleCommand(
      this,
      'spawn',
      async (...args: string[]) => {
        const [shapeArg, x, y, z, dynamicArg] = args;
        if ([x, y, z].some(v => v === undefined || isNaN(+v))) {
          throw new Error('usage: spawn BOX|SPHERE|CYLINDER|CONE|CAPSULE|PLANE X Y Z [dynamic=0|1]');
        }
        const dynamic = dynamicArg === undefined ? true : dynamicArg === '1';
        let shape: BodyShape3DDescriptor['shape'];
        switch ((shapeArg || '').toUpperCase()) {
          case 'BOX':
            shape = { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } };
            break;
          case 'SPHERE':
            shape = { shape: 'SPHERE', radius: 0.5 };
            break;
          case 'CYLINDER':
            shape = { shape: 'CYLINDER', radius: 0.5, height: 1 };
            break;
          case 'CONE':
            shape = { shape: 'CONE', radius: 0.5, height: 1 };
            break;
          case 'CAPSULE':
            shape = { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 };
            break;
          case 'PLANE':
            shape = { shape: 'PLANE' };
            break;
          default:
            throw new Error(`Unknown shape "${shapeArg}". Use BOX|SPHERE|CYLINDER|CONE|CAPSULE|PLANE`);
        }
        const entity = this.addPrimitiveRigidBody({ shape, body: { dynamic } }, { x: +x, y: +y, z: +z });
        return `spawned "${entity.name}" (${shape.shape}) at ${JSON.stringify(entity.position)}`;
      },
      'args: [ BOX|SPHERE|CYLINDER|CONE|CAPSULE|PLANE, float, float, float, 0|1? ]; Spawn a ' +
        'default-sized primitive rigid body at world-space coordinates, for probing physics. ' +
        'dynamic (last arg) defaults to 1 (falls under gravity); pass 0 for a static prop',
    );
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
      ggstatic.registerConsoleCommand(
        this,
        'player_spawn',
        async (...args: string[]) => {
          const [x, y, z] = args;
          if ([x, y, z].some(v => v === undefined || isNaN(+v))) {
            throw new Error('usage: player_spawn X Y Z');
          }
          const renderer = this.renderers[0] as Renderer3dEntity<TypeDoc['vTypeDoc']> | undefined;
          if (!renderer) {
            throw new Error('Cannot spawn a player without a renderer - call addRenderer first');
          }
          const characterController = this.physicsWorld!.factory.createCharacterController(
            { radius: 0.4, centersDistance: 1.0 },
            { position: { x: +x, y: +y, z: +z } },
          );
          const character = new CharacterController3dEntity<TypeDoc>(
            { radius: 0.4, centersDistance: 1.0 },
            this.visualScene?.factory.createCapsule(0.4, 1.0) ?? null,
            characterController,
          );
          this.addEntity(character);
          const controller = new PlayerCharacterController<TypeDoc>(this.keyboardInput, character, renderer);
          this.addEntity(controller);
          return `spawned "${character.name}" at ${JSON.stringify(character.position)}, controlled by "${controller.name}"`;
        },
        'usage: player_spawn X Y Z; Spawn a default player character (capsule body, WASD/' +
          'arrows movement, mouse-look) at world-space position X Y Z (Z-up, so Z is height off ' +
          "the ground) and control the first renderer's camera with it. Prints the spawned " +
          'controller entity\'s name (the "controlled by" part of the output) - pass that name to ' +
          '"player_mode" to switch it between first/third person',
      );
      ggstatic.registerConsoleCommand(
        this,
        'player_mode',
        async (...args: string[]) => {
          const [name, mode] = args;
          if (!name || (mode !== 'first-person' && mode !== 'third-person')) {
            throw new Error('usage: player_mode NAME first-person|third-person');
          }
          const controller = this.getEntityByName<PlayerCharacterController<TypeDoc>>(name);
          controller.viewMode = mode;
          return controller.viewMode;
        },
        'usage: player_mode NAME first-person|third-person; Switch the PlayerCharacterController ' +
          'entity named NAME - the controller name printed by "player_spawn" (the "controlled ' +
          'by" part of its output) - between first- and third-person view',
      );
    }
  }
}
