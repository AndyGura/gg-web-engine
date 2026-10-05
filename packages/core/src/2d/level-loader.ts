import { EntityJson, LevelLoader } from '../base/level-loader';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from './gg-2d-world';
import {
  AssetRef,
  AudioDistanceModel,
  fetchWithProgress,
  IEntity,
  LoadTaskOptions,
  Point2,
  stableKey,
  TextureOptions,
} from '../base';
import { DisplayObject2dOpts } from './factories';
import { Body2DOptions } from './models/body-options';
import { Shape2DDescriptor } from './models/shapes';
import { Entity2d } from './entities/entity-2d';
import { Trigger2dEntity } from './entities/trigger-2d.entity';
import { AudioSource2dEntity } from './entities/audio-source-2d.entity';
import { ParallaxLayer2dEntity } from './entities/parallax-layer-2d.entity';
import { Environment2dEntity } from './entities/environment-2d.entity';
import { ParallaxLayer2dRepeat } from './models/environment';
import { isMaterialReadable2d } from './components/rendering/i-material-readable-2d.component';
import {
  CharacterController2dEntity,
  CharacterController2dEntityOptions,
  CharacterState2d,
} from './entities/character-controller-2d.entity';

const defaultBodyOptions: Body2DOptions = {
  bodyType: 'dynamic',
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
  ccd: false,
  canSleep: true,
};

/**
 * Inverse of `Gg2dLevelLoader.buildShapeDescriptor`: turns a live `Shape2DDescriptor` (as read off
 * a rigid body's `debugBodySettings.shape`) back into the `shape`/`config` fields a `"Primitive"`
 * `EntityJson` needs - backs `Gg2dLevelLoader.serializePrimitive`.
 */
function primitiveConfigFromShape(
  shape: Shape2DDescriptor,
): { shape: string; config: Record<string, any> } | undefined {
  switch (shape.shape) {
    case 'BOX':
      return { shape: 'BOX', config: { dimensions: shape.dimensions } };
    case 'CIRCLE':
      return { shape: 'CIRCLE', config: { radius: shape.radius } };
    default:
      return undefined;
  }
}

/**
 * Shape names accepted by the built-in `"Primitive"` entity class in a 2D level JSON, via the
 * sibling `shape` field on the entity (e.g. `{ class: "Primitive", shape: "BOX" }`) - the same
 * `Shape2DDescriptor['shape']` values used at the engine API level, so no translation is needed
 * between a level JSON and `Gg2dWorld.addPrimitiveRigidBody`.
 */
export type Primitive2DShapeName = Shape2DDescriptor['shape'];

/**
 * The shape-selecting fields shared by `PrimitiveSettings` and a `COMPOUND` primitive's own
 * `children` entries - `shape` plus every field any shape variant needs (each optional, since
 * which ones are actually required depends on `shape` - see `buildShapeDescriptor`).
 */
export interface Primitive2DShapeSettings {
  /**
   * Which primitive shape to construct
   */
  shape: Primitive2DShapeName;

  /**
   * Dimensions of the primitive (for Box)
   */
  dimensions?: Point2;

  /**
   * Radius of the primitive (for Circle/Capsule)
   */
  radius?: number;

  /**
   * Distance between the two hemisphere centers (for Capsule)
   */
  centersDistance?: number;

  /**
   * Vertices of the primitive (for ConvexHull/Polygon)
   */
  vertices?: Point2[];

  /**
   * Child shapes making up a Compound primitive, each with its own local `position`/`rotation`
   * offset. A child's `shape` may itself be `"COMPOUND"`, nesting arbitrarily deep.
   */
  children?: CompoundChild2DSettings[];
}

/**
 * One child of a `COMPOUND` primitive's `children` - the same shape-selecting fields as
 * `PrimitiveSettings`, plus its own local `position`/`rotation` offset, but no `material`/`body`
 * (a compound's children share one physics body and one display object, set on the parent
 * `"Primitive"` entity only).
 */
export interface CompoundChild2DSettings extends Primitive2DShapeSettings {
  /**
   * Position of the child shape, relative to the compound's own origin
   */
  position?: Point2;

  /**
   * Rotation of the child shape in radians, relative to the compound's own rotation
   */
  rotation?: number;
}

/**
 * Settings shared by every primitive entity (Box, Circle, ...)
 */
export interface PrimitiveSettings extends Primitive2DShapeSettings {
  /**
   * Position of the primitive
   */
  position?: Point2;

  /**
   * Rotation of the primitive in radians
   */
  rotation?: number;

  /**
   * Material options for the primitive
   */
  material?: DisplayObject2dOpts<any>;

  /**
   * Physics body options, merged over sensible defaults
   */
  body?: Partial<Body2DOptions>;

  /**
   * Initial linear velocity, applied once right after the body is created - see the 3D loader's
   * `Primitive3DSettings.linearVelocity` doc, same caveats.
   */
  linearVelocity?: Point2;

  /** Initial angular velocity (radians/s) - see `linearVelocity`'s own doc, same caveats. */
  angularVelocity?: number;
}

/**
 * Settings for a trigger entity
 */
export interface TriggerSettings {
  /**
   * Position of the trigger
   */
  position?: Point2;

  /**
   * Rotation of the trigger in radians
   */
  rotation?: number;

  /**
   * Dimensions of the trigger
   */
  dimensions: Point2;
}

/**
 * Settings for the built-in 2D `"ParallaxLayer"` class - `ParallaxLayer2dOpts`, with the texture
 * given as an image URL. Creates a `ParallaxLayer2dEntity`; a no-op without a visual scene.
 */
export interface ParallaxLayer2DSettings {
  /** URL of the layer's image, loaded with `factory.loadTexture`. */
  texture: string;
  parallax?: Point2 | number;
  zIndex?: number;
  repeat?: ParallaxLayer2dRepeat;
  offset?: Point2;
  scale?: Point2 | number;
}

/**
 * Settings for the built-in 2D `"Environment"` class (see `IVisualScene2dComponent.setEnvironment`):
 * `background` is a `0xRRGGBB` color, `{ "image": "url" }`, or `null`. Applied while the level is
 * loaded and restored when it is unloaded (see `Environment2dEntity`). A no-op without a visual scene.
 */
export interface Environment2DSettings {
  background?: number | { image: string } | null;
}

/**
 * Settings for the built-in `"Sound"` entity class - see the 3D `Sound3DSettings` doc (identical
 * shape, `Point2`/no cone).
 */
export interface Sound2DSettings {
  position?: Point2;
  rotation?: number;
  path: string;
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
  spatial?: boolean;
  bus?: string;
  autoplay?: boolean;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  distanceModel?: AudioDistanceModel;
}

/**
 * Settings for the built-in `"Player"` entity class: a capsule-shaped `CharacterController2dEntity`
 * (see that class's own doc for the gameplay fields below). Only the physics/visual capsule is
 * built here - the input wiring (a `PlayerCharacterController2d`-style driver) needs a live
 * canvas/`KeyboardInput` the app supplies, so it's left to the app's own code, mirroring the 3D
 * `"Player"` class's own division of labor (see `Player3DSettings`).
 *
 * Unlike the 3D `"Player"` class, this has no `display.model` equivalent: an animated character in
 * 2D would need a frame-atlas sprite (`IAnimatedDisplayObject2dComponent`, driven by
 * `CharacterAnimation2dController`) loaded from a path, but `IDisplayObject2dComponentFactory` has
 * no method to load a texture atlas by path at all today (only `createPrimitive`/its box/circle/
 * capsule/convexHull/polygon shortcuts) - there is nothing this class could call to build one, the
 * way the 3D class calls `loadFromGlb`. TODO: once a 2D factory gains an atlas/sprite-sheet loading
 * method, add a `display.model`-equivalent here and wire a `CharacterAnimation2dController` child in
 * automatically, mirroring `Gg3dLevelLoader.createPlayer` exactly. Until then, a level JSON can only
 * produce a plain (optionally solid-color/textured) capsule sprite or a physics-only invisible one -
 * an animated sprite character has to be assembled by app code, the same way an attached/continuous
 * `"Sound"` does.
 */
export type Player2DSettings = Partial<Omit<CharacterController2dEntityOptions, 'radius' | 'centersDistance'>> & {
  /** Spawn position of the character (capsule center). */
  position?: Point2;
  /** Spawn rotation of the character, in radians. */
  rotation?: number;
  /** Capsule radius. Default 0.4. */
  radius?: number;
  /** Standing capsule centersDistance. Default 1.0. */
  centersDistance?: number;
  /** Material options for the auto-generated capsule mesh; omit for a plain default-material capsule. */
  display?: DisplayObject2dOpts<any>;
  /**
   * Runtime movement state applied once right after the character is built (see `CharacterState2d`) - what
   * `serializeSettings` emits, so a character re-created from its own serialization (e.g. on another
   * peer) continues mid-jump/mid-crouch.
   */
  state?: CharacterState2d;
};

/**
 * 2D level loader: registers the built-in primitive/trigger/player/sound entity classes and
 * dispatches `LevelJson` entities to them (or to custom classes registered via `registerClass`).
 * @template TypeDoc - The type document repository
 */
export class Gg2dLevelLoader<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> extends LevelLoader<
  Point2,
  number,
  TypeDoc
> {
  constructor(protected readonly world: Gg2dWorld<TypeDoc>) {
    super(world);
    this.registerDefaultClasses();
  }

  /**
   * Loads an image as a texture, for `DisplayObject2dOpts.texture`, a parallax layer or a
   * background. Cached: the same url with the same options gives the same texture object, freed
   * when the last scope holding it is released (see `LoadTaskOptions.scope`) - don't dispose it
   * yourself.
   * @throws if the world has no visual scene
   */
  public async loadTexture(
    url: string,
    options: TextureOptions & LoadTaskOptions = {},
  ): Promise<TypeDoc['vTypeDoc']['texture']> {
    const factory = this.world.visualScene?.factory;
    if (!factory) {
      throw new Error('Cannot load a texture into a world without a visual scene');
    }
    const { onProgress, signal, scope, ...textureOptions } = options;
    return this.acquireAsset(`texture:${url}:${stableKey(textureOptions)}`, url, options, async item => {
      let texture: TypeDoc['vTypeDoc']['texture'];
      if (factory.textureFromData) {
        const data = await fetchWithProgress(url, item.file(), signal);
        texture = await factory.textureFromData(new Blob([data]), textureOptions);
      } else {
        texture = await factory.loadTexture(url, textureOptions);
      }
      await factory.prepare?.(texture);
      return { value: texture, dispose: () => factory.disposeTexture?.(texture) };
    });
  }

  protected override async preloadAsset(ref: AssetRef, options: LoadTaskOptions): Promise<void> {
    if (ref.kind === 'texture') {
      if (this.world.visualScene) {
        await this.loadTexture(ref.url, { ...ref.options, ...options });
      }
    } else {
      await super.preloadAsset(ref, options);
    }
  }

  /**
   * Register the built-in classes for primitives and triggers
   */
  private registerDefaultClasses(): void {
    this.registerClass('Primitive', (world: Gg2dWorld<TypeDoc>, settings: PrimitiveSettings) =>
      this.createPrimitive(world, this.buildShapeDescriptor(settings), settings),
    );

    this.registerClass('Trigger', this.createTrigger.bind(this));
    this.registerClass('Sound', this.createSound.bind(this), {
      assets: (settings: Sound2DSettings) => (settings.path ? [{ kind: 'clip', url: settings.path }] : []),
    });
    this.registerClass('ParallaxLayer', this.createParallaxLayer.bind(this), {
      assets: (settings: ParallaxLayer2DSettings) =>
        settings.texture ? [{ kind: 'texture', url: settings.texture }] : [],
    });
    this.registerClass('Environment', this.createEnvironment.bind(this), {
      assets: (settings: Environment2DSettings) => {
        const bg = settings.background;
        return bg && typeof bg === 'object' ? [{ kind: 'texture', url: bg.image }] : [];
      },
    });
    this.registerClass('Player', this.createPlayer.bind(this), CharacterController2dEntity);

    this.registerLiveSerializer(this.serializePrimitive.bind(this));
    this.registerLiveSerializer(this.serializeTrigger.bind(this));
  }

  /**
   * Live serializer for the built-in `"Primitive"` class - see the 3D loader's
   * `Gg3dLevelLoader.serializePrimitive` for the general approach and rationale (identical here,
   * just 2D-typed): matches `entity.constructor === Entity2d` exactly, recovers shape/dimensions
   * from `objectBody.debugBodySettings.shape`, `body`/velocity from the live physics body
   * (`objectBody.bodyOptions`/`.linearVelocity`/`.angularVelocity`), and `material` from
   * `object2D` when it implements `IMaterialReadable2dComponent`.
   */
  private serializePrimitive(entity: IEntity<Point2, number, TypeDoc>): EntityJson | undefined {
    if (entity.constructor !== Entity2d || !(entity as Entity2d<TypeDoc>).objectBody) {
      return undefined;
    }
    const positionable = entity as Entity2d<TypeDoc>;
    const body = positionable.objectBody!;
    const shapeConfig = primitiveConfigFromShape(body.debugBodySettings.shape);
    if (!shapeConfig) {
      return undefined;
    }
    const material = isMaterialReadable2d(positionable.object2D) ? positionable.object2D.materialOptions : undefined;
    return {
      class: 'Primitive',
      shape: shapeConfig.shape,
      name: positionable.name,
      position: positionable.position,
      rotation: positionable.rotation,
      config: {
        ...shapeConfig.config,
        ...(material !== undefined ? { material } : {}),
        body: body.bodyOptions,
        linearVelocity: body.linearVelocity,
        angularVelocity: body.angularVelocity,
      },
    };
  }

  /**
   * Live serializer for the built-in `"Trigger"` class - see the 3D loader's own doc for the
   * general approach. Matches `entity.constructor === Trigger2dEntity` exactly.
   */
  private serializeTrigger(entity: IEntity<Point2, number, TypeDoc>): EntityJson | undefined {
    if (entity.constructor !== Trigger2dEntity) {
      return undefined;
    }
    const trigger = entity as Trigger2dEntity<TypeDoc['pTypeDoc']>;
    const shape = trigger.objectBody.debugBodySettings.shape;
    if (shape.shape !== 'BOX') {
      return undefined;
    }
    return {
      class: 'Trigger',
      name: trigger.name,
      position: trigger.position,
      rotation: trigger.rotation,
      config: { dimensions: shape.dimensions },
    };
  }

  /**
   * Turn a `Primitive2DShapeSettings` (`shape` plus shape-specific fields) into the
   * `Shape2DDescriptor` consumed by `Gg2dWorld.addPrimitiveRigidBody`. Used both for a
   * `"Primitive"` entity's own top-level settings and, recursively, for each of a `COMPOUND`
   * primitive's `children` (which may themselves be `COMPOUND`, nesting arbitrarily deep).
   * @param settings - The shape settings, as parsed from a `"Primitive"` entity's `shape` +
   * `config`, or from one entry of a `COMPOUND`'s `children`
   * @returns The shape descriptor
   */
  private buildShapeDescriptor(settings: Primitive2DShapeSettings): Shape2DDescriptor {
    switch (settings.shape) {
      case 'BOX':
        if (!settings.dimensions) {
          throw new Error('Dimensions are required for BOX primitive');
        }
        return { shape: 'BOX', dimensions: settings.dimensions };
      case 'CIRCLE':
        if (settings.radius === undefined) {
          throw new Error('Radius is required for CIRCLE primitive');
        }
        return { shape: 'CIRCLE', radius: settings.radius };
      case 'CAPSULE':
        if (settings.radius === undefined) {
          throw new Error('Radius is required for CAPSULE primitive');
        }
        if (settings.centersDistance === undefined) {
          throw new Error('Centers distance is required for CAPSULE primitive');
        }
        return { shape: 'CAPSULE', radius: settings.radius, centersDistance: settings.centersDistance };
      case 'CONVEX_HULL':
        if (!settings.vertices) {
          throw new Error('Vertices are required for CONVEX_HULL primitive');
        }
        return { shape: 'CONVEX_HULL', vertices: settings.vertices };
      case 'POLYGON':
        if (!settings.vertices) {
          throw new Error('Vertices are required for POLYGON primitive');
        }
        return { shape: 'POLYGON', vertices: settings.vertices };
      case 'COMPOUND':
        if (!settings.children) {
          throw new Error('Children are required for COMPOUND primitive');
        }
        return {
          shape: 'COMPOUND',
          children: settings.children.map(child => ({
            position: child.position,
            rotation: child.rotation,
            shape: this.buildShapeDescriptor(child),
          })),
        };
      default:
        throw new Error(`Unknown primitive shape "${settings.shape}"`);
    }
  }

  /**
   * Create a primitive entity (both display object and physics body) from a shape descriptor
   * @param world - The world instance
   * @param shape - The shape descriptor
   * @param settings - Position/rotation/material/body settings shared by all primitives
   * @returns The created entity
   */
  private createPrimitive(
    world: Gg2dWorld<TypeDoc>,
    shape: Shape2DDescriptor,
    settings: PrimitiveSettings,
  ): Entity2d<TypeDoc> {
    const { position, rotation, material, body, linearVelocity, angularVelocity } = settings;
    const entity = world.addPrimitiveRigidBody(
      { shape, body: { ...defaultBodyOptions, ...body } },
      position,
      rotation,
      material,
    );
    if (entity.objectBody) {
      if (linearVelocity) {
        entity.objectBody.linearVelocity = linearVelocity;
      }
      if (angularVelocity !== undefined) {
        entity.objectBody.angularVelocity = angularVelocity;
      }
    }
    return entity;
  }

  /**
   * Create a trigger entity: a `Trigger2dEntity` wrapping the raw physics trigger component, so
   * the app can subscribe to `onEntityEntered`/`onEntityLeft` without any extra wiring - see the
   * base `LevelLoader` docs for how it's parented for level-lifecycle cleanup.
   * @param world - The world instance
   * @param settings - The trigger settings
   * @returns The created trigger entity
   */
  private createTrigger(
    world: Gg2dWorld<TypeDoc>,
    settings: TriggerSettings,
  ): Trigger2dEntity<TypeDoc['pTypeDoc']> | undefined {
    const { position, rotation, dimensions } = settings;
    const shape: Shape2DDescriptor = { shape: 'BOX', dimensions };
    const trigger = world.physicsWorld?.factory.createTrigger(shape, { position, rotation });
    if (!trigger) {
      return undefined;
    }
    const entity = new Trigger2dEntity<TypeDoc['pTypeDoc']>(trigger);
    if (position !== undefined) {
      entity.position = position;
    }
    if (rotation !== undefined) {
      entity.rotation = rotation;
    }
    return entity;
  }

  /**
   * Create a `"Player"` entity: a capsule-shaped `CharacterController2dEntity`, with a matching
   * auto-generated capsule mesh when there's a visual scene (physics-only/invisible otherwise). See
   * `Player2DSettings`'s doc for why this doesn't also build an animated-sprite equivalent of the 3D
   * class's `display.model`, or a `PlayerCharacterController2d`-style input driver.
   * @param world - The world instance
   * @param settings - The player settings
   * @returns The created character entity
   */
  private createPlayer(
    world: Gg2dWorld<TypeDoc>,
    settings: Player2DSettings,
  ): CharacterController2dEntity<TypeDoc> | undefined {
    const {
      position,
      rotation,
      radius = 0.4,
      centersDistance = 1.0,
      offset,
      maxStepHeight,
      minStepWidth,
      maxSlopeClimbAngleRad,
      snapToGroundDistance,
      pushMass,
      up,
      ownCollisionGroups,
      interactWithCollisionGroups,
      display,
      state,
      ...gameplay
    } = settings;
    if (!world.physicsWorld) {
      return undefined;
    }
    // See the 3D loader's `createPlayer` for the full rationale: every one of these must be left
    // out of the objects below entirely (not passed through as explicit `undefined`) whenever the
    // level JSON didn't set them, so each adapter's/`CharacterController2dEntity`'s own
    // `{...DEFAULT_OPTIONS, ...options}` merge actually falls back to its default instead of a
    // present-but-`undefined` key overwriting it. `up`/`ownCollisionGroups`/
    // `interactWithCollisionGroups` must be included here (not left to fall into `...gameplay`
    // below) so they reach `factory.createCharacterController` and actually configure the physics
    // component, not just the entity's own cosmetic options object.
    const tunableOptions = {
      ...(offset !== undefined && { offset }),
      ...(maxStepHeight !== undefined && { maxStepHeight }),
      ...(minStepWidth !== undefined && { minStepWidth }),
      ...(maxSlopeClimbAngleRad !== undefined && { maxSlopeClimbAngleRad }),
      ...(snapToGroundDistance !== undefined && { snapToGroundDistance }),
      ...(pushMass !== undefined && { pushMass }),
      ...(up !== undefined && { up }),
      ...(ownCollisionGroups !== undefined && { ownCollisionGroups }),
      ...(interactWithCollisionGroups !== undefined && { interactWithCollisionGroups }),
    };
    const characterController = world.physicsWorld.factory.createCharacterController(
      { radius, centersDistance, ...tunableOptions },
      { position, rotation },
    );
    let object2D: TypeDoc['vTypeDoc']['displayObject'] | null = null;
    if (world.visualScene) {
      object2D = world.visualScene.factory.createCapsule(radius, centersDistance, display);
    }
    const entity = new CharacterController2dEntity<TypeDoc>(
      {
        radius,
        centersDistance,
        ...tunableOptions,
        ...gameplay,
      },
      object2D,
      characterController,
    );
    if (position) {
      entity.position = position;
    }
    if (rotation !== undefined) {
      entity.rotation = rotation;
    }
    if (display) {
      entity.displaySettings = display;
    }
    if (state) {
      entity.applyState(state);
    }
    return entity;
  }

  /**
   * Create a `"ParallaxLayer"` entity: loads the texture, then wraps a parallax layer built from the
   * settings in a `ParallaxLayer2dEntity`. Returns `undefined` without a visual scene.
   */
  private async createParallaxLayer(
    world: Gg2dWorld<TypeDoc>,
    settings: ParallaxLayer2DSettings,
    load: LoadTaskOptions = {},
  ): Promise<ParallaxLayer2dEntity<TypeDoc['vTypeDoc']> | undefined> {
    const scene = world.visualScene;
    if (!scene) {
      return undefined;
    }
    if (!settings.texture) {
      throw new Error('"texture" is required for ParallaxLayer class');
    }
    const { texture, parallax, zIndex, repeat, offset, scale } = settings;
    return new ParallaxLayer2dEntity<TypeDoc['vTypeDoc']>(
      scene.factory.createParallaxLayer({
        texture: await this.loadTexture(texture, load),
        parallax,
        zIndex,
        repeat,
        offset,
        scale,
      }),
    );
  }

  /**
   * Create an `"Environment"` entity: loads a background image if one is given, then returns an
   * `Environment2dEntity` that applies the settings while it is in the world. Returns `undefined`
   * without a visual scene.
   */
  private async createEnvironment(
    world: Gg2dWorld<TypeDoc>,
    settings: Environment2DSettings,
    load: LoadTaskOptions = {},
  ): Promise<Environment2dEntity<TypeDoc['vTypeDoc']> | undefined> {
    const scene = world.visualScene;
    if (!scene) {
      return undefined;
    }
    const environment: { background?: number | TypeDoc['vTypeDoc']['texture'] | null } = {};
    if (settings.background !== undefined) {
      const bg = settings.background;
      environment.background = bg === null || typeof bg === 'number' ? bg : await this.loadTexture(bg.image, load);
    }
    return new Environment2dEntity<TypeDoc['vTypeDoc']>(environment);
  }

  /**
   * Create a `"Sound"` entity - see the 3D loader's `createSound` doc (identical behavior).
   * @param world - The world instance
   * @param settings - The sound settings
   * @returns The created audio source entity
   */
  private async createSound(
    world: Gg2dWorld<TypeDoc>,
    settings: Sound2DSettings,
    load: LoadTaskOptions = {},
  ): Promise<AudioSource2dEntity<TypeDoc> | undefined> {
    if (!world.audioScene) {
      return undefined;
    }
    if (!settings.path) {
      throw new Error('"path" is required for Sound class');
    }
    const clip = await this.loadClip(settings.path, load);
    const source = world.audioScene.factory.createSource({
      clip,
      loop: settings.loop ?? true,
      volume: settings.volume,
      playbackRate: settings.playbackRate,
      spatial: settings.spatial,
      bus: settings.bus,
      autoplay: settings.autoplay,
    });
    if (settings.refDistance !== undefined) {
      source.refDistance = settings.refDistance;
    }
    if (settings.maxDistance !== undefined) {
      source.maxDistance = settings.maxDistance;
    }
    if (settings.rolloffFactor !== undefined) {
      source.rolloffFactor = settings.rolloffFactor;
    }
    if (settings.distanceModel !== undefined) {
      source.distanceModel = settings.distanceModel;
    }
    const entity = new AudioSource2dEntity<TypeDoc>(source);
    if (settings.position !== undefined) {
      entity.position = settings.position;
    }
    if (settings.rotation !== undefined) {
      entity.rotation = settings.rotation;
    }
    return entity;
  }
}
