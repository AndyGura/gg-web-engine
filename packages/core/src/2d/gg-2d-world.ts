import { BodyType, GgConsoleHost, GgWorld, Pnt2, Point2, RendererOptions } from '../base';
import { Gg2dLoader } from './loader';
import { BodyShape2DDescriptor } from './models/shapes';
import { Entity2d } from './entities/entity-2d';
import { IPhysicsWorld2dComponent } from './components/physics/i-physics-world-2d.component';
import { IVisualScene2dComponent } from './components/rendering/i-visual-scene-2d.component';
import { Renderer2dEntity } from './entities/renderer-2d.entity';
import {
  DisplayObject2dOpts,
  IAudioSource2dComponentFactory,
  IDisplayObject2dComponentFactory,
  IPhysicsBody2dComponentFactory,
} from './factories';
import { IRenderer2dComponent } from './components/rendering/i-renderer-2d.component';
import { IDisplayObject2dComponent } from './components/rendering/i-display-object-2d.component';
import { ICamera2dComponent } from './components/rendering/i-camera-2d.component';
import { IParallaxLayer2dComponent } from './components/rendering/i-parallax-layer-2d.component';
import { ParallaxLayer2dOpts } from './models/environment';
import { IText2dComponent } from './components/rendering/i-text-2d.component';
import { ParallaxLayer2dEntity } from './entities/parallax-layer-2d.entity';
import { ITrigger2dComponent } from './components/physics/i-trigger-2d.component';
import { IRigidBody2dComponent } from './components/physics/i-rigid-body-2d.component';
import { ICharacterController2dComponent } from './components/physics/i-character-controller-2d.component';
import { IAudioScene2dComponent } from './components/audio/i-audio-scene-2d.component';
import { IAudioSource2dComponent } from './components/audio/i-audio-source-2d.component';
import { CharacterController2dEntity } from './entities/character-controller-2d.entity';
import { PlayerCharacterController2d } from './entities/controllers/input/player-character-2d.controller';
import {
  IParticleSystem2dComponent,
  ParticleSystem2dRenderOptions,
} from './components/rendering/i-particle-system-2d.component';
import { ParticleSystem2dEntity, ParticleSystem2dOptions } from './entities/particle-system-2d.entity';

export type VisualTypeDocRepo2D = {
  factory: IDisplayObject2dComponentFactory;
  displayObject: IDisplayObject2dComponent;
  renderer: IRenderer2dComponent;
  rendererExtraOpts: {};
  camera: ICamera2dComponent;
  parallaxLayer: IParallaxLayer2dComponent;
  text: IText2dComponent;
  particleSystem: IParticleSystem2dComponent;
  /** Adapter-specific particle system options, merged into `ParticleSystem2dRenderOptions`. */
  particleSystemExtraOpts: {};
  texture: unknown;
};

export type PhysicsTypeDocRepo2D = {
  factory: IPhysicsBody2dComponentFactory;
  rigidBody: IRigidBody2dComponent;
  trigger: ITrigger2dComponent;
  characterController: ICharacterController2dComponent;
};

export type AudioTypeDocRepo2D = {
  factory: IAudioSource2dComponentFactory;
  source: IAudioSource2dComponent;
  clip: unknown;
};

export type Gg2dWorldTypeDocRepo = {
  vTypeDoc: VisualTypeDocRepo2D;
  pTypeDoc: PhysicsTypeDocRepo2D;
  aTypeDoc: AudioTypeDocRepo2D;
};
// utility types to create world type doc by defining either vTypeDoc, pTypeDoc or aTypeDoc only
export type Gg2dWorldTypeDocVPatch<VTypeDoc extends VisualTypeDocRepo2D> = Omit<Gg2dWorldTypeDocRepo, 'vTypeDoc'> & {
  vTypeDoc: VTypeDoc;
};
export type Gg2dWorldTypeDocPPatch<PTypeDoc extends PhysicsTypeDocRepo2D> = Omit<Gg2dWorldTypeDocRepo, 'pTypeDoc'> & {
  pTypeDoc: PTypeDoc;
};
export type Gg2dWorldTypeDocAPatch<ATypeDoc extends AudioTypeDocRepo2D> = Omit<Gg2dWorldTypeDocRepo, 'aTypeDoc'> & {
  aTypeDoc: ATypeDoc;
};

export type Gg2dWorldSceneTypeRepo<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> = {
  visualScene: IVisualScene2dComponent<TypeDoc['vTypeDoc']> | null;
  physicsWorld: IPhysicsWorld2dComponent<TypeDoc['pTypeDoc']> | null;
  audioScene: IAudioScene2dComponent<TypeDoc['aTypeDoc']> | null;
};
// utility types to create world scene type doc by defining either visualScene, physicsWorld or audioScene only
export type Gg2dWorldSceneTypeDocVPatch<
  VTypeDoc extends VisualTypeDocRepo2D,
  VS extends IVisualScene2dComponent<VTypeDoc> | null,
> = Omit<Gg2dWorldSceneTypeRepo, 'visualScene'> & { visualScene: VS };
export type Gg2dWorldSceneTypeDocPPatch<
  PTypeDoc extends PhysicsTypeDocRepo2D,
  PW extends IPhysicsWorld2dComponent<PTypeDoc> | null,
> = Omit<Gg2dWorldSceneTypeRepo, 'physicsWorld'> & { physicsWorld: PW };
export type Gg2dWorldSceneTypeDocAPatch<
  ATypeDoc extends AudioTypeDocRepo2D,
  AS extends IAudioScene2dComponent<ATypeDoc> | null,
> = Omit<Gg2dWorldSceneTypeRepo, 'audioScene'> & { audioScene: AS };

// A helper type to build a full type for the world according to installed modules
// Each module provides its type, like "PixiGgWorld", "Rapier2dGgWorld" or "WebAudioGgWorld"
// Caller code can define type like this: world: TypedGg2dWorld<ThreeGgWorld, Rapier2dGgWorld, WebAudioGgWorld>
// Important: visual library world comes first, then physics library, then (optionally) audio library.
// See TypedGg3dWorld's own comment for why the audio slot needs one combined
// `AW extends Gg2dWorld<infer ATD, infer ASTD>` check rather than two separate ones.
export type TypedGg2dWorld<
  VW extends Gg2dWorld<any> | null,
  PW extends Gg2dWorld<any> | null,
  AW extends Gg2dWorld<any> | null = null,
> = VW extends Gg2dWorld<infer VTD, infer VSTD> | null
  ? PW extends Gg2dWorld<infer PTD, infer PSTD> | null
    ? AW extends Gg2dWorld<infer ATD, infer ASTD>
      ? Gg2dWorld<
          { vTypeDoc: VTD['vTypeDoc']; pTypeDoc: PTD['pTypeDoc']; aTypeDoc: ATD['aTypeDoc'] },
          { visualScene: VSTD['visualScene']; physicsWorld: PSTD['physicsWorld']; audioScene: ASTD['audioScene'] }
        >
      : Gg2dWorld<
          { vTypeDoc: VTD['vTypeDoc']; pTypeDoc: PTD['pTypeDoc']; aTypeDoc: AudioTypeDocRepo2D },
          {
            visualScene: VSTD['visualScene'];
            physicsWorld: PSTD['physicsWorld'];
            audioScene: IAudioScene2dComponent | null;
          }
        >
    : never
  : never;

/**
 * `W` (a world type such as `PixiGgWorld`) with a physics world of whichever adapter, known to be
 * there: `world.physicsWorld` is a plain `IPhysicsWorld2dComponent`, never `null`. For an app that
 * picks its physics backend at runtime and so can't name an adapter's world type:
 * `const world: Gg2dWorldWithPhysics<PixiGgWorld> = new Gg2dWorld({ visualScene, physicsWorld })`.
 */
export type Gg2dWorldWithPhysics<W extends Gg2dWorld<any, any>> =
  W extends Gg2dWorld<infer TD, infer STD>
    ? Gg2dWorld<TD, Omit<STD, 'physicsWorld'> & { physicsWorld: IPhysicsWorld2dComponent<TD['pTypeDoc']> }>
    : never;

export class Gg2dWorld<
  TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo,
  SceneTypeDoc extends Gg2dWorldSceneTypeRepo<TypeDoc> = Gg2dWorldSceneTypeRepo<TypeDoc>,
> extends GgWorld<Point2, number, TypeDoc, SceneTypeDoc> {
  public readonly loader: Gg2dLoader<TypeDoc>;

  constructor(args: {
    visualScene?: SceneTypeDoc['visualScene'];
    physicsWorld?: SceneTypeDoc['physicsWorld'];
    audioScene?: SceneTypeDoc['audioScene'];
    maxTickDelta?: number;
    pauseWhenHidden?: boolean;
    fixedPhysicsStep?: number;
    maxPhysicsStepsPerTick?: number;
  }) {
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

  /**
   * Creates a parallax layer (see `ParallaxLayer2dOpts`), wraps it in a `ParallaxLayer2dEntity` and
   * adds it to the world.
   */
  addParallaxLayer(
    options: ParallaxLayer2dOpts<TypeDoc['vTypeDoc']['texture']>,
  ): ParallaxLayer2dEntity<TypeDoc['vTypeDoc']> {
    if (!this.visualScene) {
      throw new Error('Cannot add a parallax layer to the world without visual scene');
    }
    const entity = new ParallaxLayer2dEntity<TypeDoc['vTypeDoc']>(
      this.visualScene.factory.createParallaxLayer(options),
    );
    this.addEntity(entity);
    return entity;
  }

  /**
   * Creates a particle system - its visual component from `renderOptions` (plus the adapter's own
   * extra options) and the simulation from `options` - wraps it in a `ParticleSystem2dEntity` and
   * adds it to the world.
   */
  addParticleSystem<T = any>(
    renderOptions: ParticleSystem2dRenderOptions<TypeDoc['vTypeDoc']['texture']> &
      Partial<TypeDoc['vTypeDoc']['particleSystemExtraOpts']>,
    options: ParticleSystem2dOptions<T> = {},
  ): ParticleSystem2dEntity<TypeDoc['vTypeDoc'], T> {
    if (!this.visualScene) {
      throw new Error('Cannot add a particle system to the world without visual scene');
    }
    const entity = new ParticleSystem2dEntity<TypeDoc['vTypeDoc'], T>(
      this.visualScene.factory.createParticleSystem(renderOptions),
      options,
    );
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

  protected registerConsoleCommands(ggstatic: GgConsoleHost) {
    super.registerConsoleCommands(ggstatic);
    ggstatic.registerConsoleCommand(
      this,
      'set_position',
      async (...args: string[]) => {
        const [name, x, y] = args;
        if (!name) {
          throw new Error('usage: set_position NAME X Y');
        }
        const entity = this.getEntityByName(name);
        if (!('position' in entity)) {
          throw new Error(`Entity "${name}" (${entity.constructor.name}) has no position`);
        }
        if ([x, y].some(v => v === undefined || isNaN(+v))) {
          throw new Error('usage: set_position NAME X Y');
        }
        (entity as unknown as Entity2d<TypeDoc>).position = { x: +x, y: +y };
        return JSON.stringify((entity as unknown as Entity2d<TypeDoc>).position);
      },
      'args: [ string, float, float ]; Teleport a named entity to world-space coordinates. Use ' +
        '"entities"/"entity NAME" to find entity names and their current position',
      true,
    );
    ggstatic.registerConsoleCommand(
      this,
      'set_rotation',
      async (...args: string[]) => {
        const [name, angle] = args;
        if (!name) {
          throw new Error('usage: set_rotation NAME ANGLE_RADIANS');
        }
        const entity = this.getEntityByName(name);
        if (!('rotation' in entity)) {
          throw new Error(`Entity "${name}" (${entity.constructor.name}) has no rotation`);
        }
        if (angle === undefined || isNaN(+angle)) {
          throw new Error('usage: set_rotation NAME ANGLE_RADIANS');
        }
        (entity as unknown as Entity2d<TypeDoc>).rotation = +angle;
        return JSON.stringify((entity as unknown as Entity2d<TypeDoc>).rotation);
      },
      'args: [ string, float ]; Rotate a named entity to the given angle, in radians',
      true,
    );
    ggstatic.registerConsoleCommand(
      this,
      'spawn',
      async (...args: string[]) => {
        const [shapeArg, x, y, bodyTypeArg] = args;
        if ([x, y].some(v => v === undefined || isNaN(+v))) {
          throw new Error(
            'usage: spawn BOX|CIRCLE|CAPSULE|CONVEX_HULL|POLYGON X Y ' +
              '[bodyType=0|1|2|3|static|dynamic|kinematic_pos|kinematic_vel]',
          );
        }
        let bodyType: BodyType = 'dynamic';
        if (['dynamic', 'static', 'kinematic_pos', 'kinematic_vel'].includes(bodyTypeArg || '')) {
          bodyType = bodyTypeArg as BodyType;
        } else if (bodyTypeArg === '0') {
          bodyType = 'static';
        } else if (bodyTypeArg === '1') {
          bodyType = 'dynamic';
        } else if (bodyTypeArg === '2') {
          bodyType = 'kinematic_pos';
        } else if (bodyTypeArg === '3') {
          bodyType = 'kinematic_vel';
        }
        // Sized in pixels, matching the scale `examples/2d/primitives`'s shape-spawner uses -
        // 2D worlds have no fixed "1 unit" convention the way 3D's meter-scaled shapes do, so a
        // 3D-style unit-scale default (radius 0.5, dimensions 1x1) would spawn shapes too tiny to
        // see/interact with with a typical pixel-scale camera/renderer setup.
        let shape: BodyShape2DDescriptor['shape'];
        switch ((shapeArg || '').toUpperCase()) {
          case 'BOX':
            shape = { shape: 'BOX', dimensions: { x: 25, y: 25 } };
            break;
          case 'CIRCLE':
            shape = { shape: 'CIRCLE', radius: 13 };
            break;
          case 'CAPSULE':
            shape = { shape: 'CAPSULE', radius: 10, centersDistance: 15 };
            break;
          case 'CONVEX_HULL':
            shape = {
              shape: 'CONVEX_HULL',
              vertices: [
                { x: 0, y: -15 },
                { x: 13, y: 10 },
                { x: 0, y: 0 },
                { x: -13, y: 10 },
                { x: 5, y: -5 },
              ],
            };
            break;
          case 'POLYGON':
            shape = {
              // non-convex L-shape, to demonstrate POLYGON isn't reduced to its convex hull
              shape: 'POLYGON',
              vertices: [
                { x: -15, y: -15 },
                { x: 0, y: -15 },
                { x: 0, y: 0 },
                { x: 15, y: 0 },
                { x: 15, y: 15 },
                { x: -15, y: 15 },
              ],
            };
            break;
          default:
            throw new Error(`Unknown shape "${shapeArg}". Use BOX|CIRCLE|CAPSULE|CONVEX_HULL|POLYGON`);
        }
        const entity = this.addPrimitiveRigidBody({ shape, body: { bodyType } }, { x: +x, y: +y });
        return `spawned "${entity.name}" (${shape.shape}) at ${JSON.stringify(entity.position)}`;
      },
      'args: [ BOX|CIRCLE|CAPSULE|CONVEX_HULL|POLYGON, float, float, ' +
        'bodyType=0|1|2|3|static|dynamic|kinematic_pos|kinematic_vel? ]; Spawn a default-sized ' +
        'primitive rigid body at world-space coordinates, for probing physics. bodyType (last ' +
        'arg) defaults to dynamic (1, falls under gravity); numeric shorthand: 0=static, ' +
        '2=kinematic_pos, 3=kinematic_vel',
      true,
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
        true,
      );
      ggstatic.registerConsoleCommand(
        this,
        'player_spawn',
        async (...args: string[]) => {
          const [x, y] = args;
          if ([x, y].some(v => v === undefined || isNaN(+v))) {
            throw new Error('usage: player_spawn X Y');
          }
          const renderer = this.renderers[0] as Renderer2dEntity<TypeDoc['vTypeDoc']> | undefined;
          if (!renderer) {
            throw new Error('Cannot spawn a player without a renderer - call addRenderer first');
          }
          const characterController = this.physicsWorld!.factory.createCharacterController(
            { radius: 20, centersDistance: 40 },
            { position: { x: +x, y: +y } },
          );
          const character = new CharacterController2dEntity<TypeDoc>(
            { radius: 20, centersDistance: 40 },
            this.visualScene?.factory.createCapsule(20, 40) ?? null,
            characterController,
          );
          this.addEntity(character);
          const controller = new PlayerCharacterController2d<TypeDoc>(this.keyboardInput, character, renderer);
          this.addEntity(controller);
          return `spawned "${character.name}" at ${JSON.stringify(character.position)}, controlled by "${controller.name}"`;
        },
        'usage: player_spawn X Y; Spawn a default player character (capsule body, left/right/' +
          "jump/run keys) at world-space position X Y and control the first renderer's camera " +
          'with it. Sized in pixels, matching the "spawn" command\'s own default-shape scale.',
        true,
      );
    }
  }
}
