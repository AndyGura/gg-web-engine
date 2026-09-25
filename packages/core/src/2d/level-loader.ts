import { EntityJson, LevelLoader } from '../base/level-loader';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from './gg-2d-world';
import { AudioDistanceModel, IEntity, Point2 } from '../base';
import { DisplayObject2dOpts } from './factories';
import { Body2DOptions } from './models/body-options';
import { Shape2DDescriptor } from './models/shapes';
import { Entity2d } from './entities/entity-2d';
import { Trigger2dEntity } from './entities/trigger-2d.entity';
import { AudioSource2dEntity } from './entities/audio-source-2d.entity';

const defaultBodyOptions: Body2DOptions = {
  bodyType: 'dynamic',
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
  ccd: false,
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
    case 'SQUARE':
      return { shape: 'SQUARE', config: { dimensions: shape.dimensions } };
    case 'CIRCLE':
      return { shape: 'CIRCLE', config: { radius: shape.radius } };
    default:
      return undefined;
  }
}

/**
 * Shape names accepted by the built-in `"Primitive"` entity class in a 2D level JSON, via the
 * sibling `shape` field on the entity (e.g. `{ class: "Primitive", shape: "SQUARE" }`) - the same
 * `Shape2DDescriptor['shape']` values used at the engine API level, so no translation is needed
 * between a level JSON and `Gg2dWorld.addPrimitiveRigidBody`.
 */
export type Primitive2DShapeName = Shape2DDescriptor['shape'];

/**
 * Settings shared by every primitive entity (Square, Circle, ...)
 */
export interface PrimitiveSettings {
  /**
   * Which primitive shape to construct
   */
  shape: Primitive2DShapeName;

  /**
   * Position of the primitive
   */
  position?: Point2;

  /**
   * Rotation of the primitive in radians
   */
  rotation?: number;

  /**
   * Dimensions of the primitive (for Square)
   */
  dimensions?: Point2;

  /**
   * Radius of the primitive (for Circle)
   */
  radius?: number;

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
 * 2D level loader: registers the built-in primitive/trigger/sound entity classes and dispatches
 * `LevelJson` entities to them (or to custom classes registered via `registerClass`).
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
   * Register the built-in classes for primitives and triggers
   */
  private registerDefaultClasses(): void {
    this.registerClass('Primitive', (world: Gg2dWorld<TypeDoc>, settings: PrimitiveSettings) =>
      this.createPrimitive(world, this.buildShapeDescriptor(settings), settings),
    );

    this.registerClass('Trigger', this.createTrigger.bind(this));
    this.registerClass('Sound', this.createSound.bind(this));

    this.registerLiveSerializer(this.serializePrimitive.bind(this));
    this.registerLiveSerializer(this.serializeTrigger.bind(this));
  }

  /**
   * Live serializer for the built-in `"Primitive"` class - see the 3D loader's
   * `Gg3dLevelLoader.serializePrimitive` for the general approach and rationale (identical here,
   * just 2D-typed): matches `entity.constructor === Entity2d` exactly, recovers shape/dimensions
   * from `objectBody.debugBodySettings.shape` and `body`/velocity from the live physics body
   * (`objectBody.bodyOptions`/`.linearVelocity`/`.angularVelocity`). Same `material`-can't-be-
   * recovered caveat applies.
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
    return {
      class: 'Primitive',
      shape: shapeConfig.shape,
      name: positionable.name,
      position: positionable.position,
      rotation: positionable.rotation,
      config: {
        ...shapeConfig.config,
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
    if (shape.shape !== 'SQUARE') {
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
   * Turn a `PrimitiveSettings` (`shape` plus shape-specific fields) into the `Shape2DDescriptor`
   * consumed by `Gg2dWorld.addPrimitiveRigidBody`.
   * @param settings - The primitive settings, as parsed from a `"Primitive"` entity's `shape` +
   * `config`
   * @returns The shape descriptor
   */
  private buildShapeDescriptor(settings: PrimitiveSettings): Shape2DDescriptor {
    switch (settings.shape) {
      case 'SQUARE':
        if (!settings.dimensions) {
          throw new Error('Dimensions are required for SQUARE primitive');
        }
        return { shape: 'SQUARE', dimensions: settings.dimensions };
      case 'CIRCLE':
        if (settings.radius === undefined) {
          throw new Error('Radius is required for CIRCLE primitive');
        }
        return { shape: 'CIRCLE', radius: settings.radius };
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
    const shape: Shape2DDescriptor = { shape: 'SQUARE', dimensions };
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
   * Create a `"Sound"` entity - see the 3D loader's `createSound` doc (identical behavior).
   * @param world - The world instance
   * @param settings - The sound settings
   * @returns The created audio source entity
   */
  private async createSound(
    world: Gg2dWorld<TypeDoc>,
    settings: Sound2DSettings,
  ): Promise<AudioSource2dEntity<TypeDoc> | undefined> {
    if (!world.audioScene) {
      return undefined;
    }
    if (!settings.path) {
      throw new Error('"path" is required for Sound class');
    }
    const clip = await world.audioScene.factory.loadClip(settings.path);
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
