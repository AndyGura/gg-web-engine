import { LevelLoader } from '../base/level-loader';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from './gg-2d-world';
import { Point2 } from '../base';
import { DisplayObject2dOpts } from './factories';
import { Body2DOptions } from './models/body-options';
import { Shape2DDescriptor } from './models/shapes';
import { Entity2d } from './entities/entity-2d';

const defaultBodyOptions: Body2DOptions = {
  dynamic: true,
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
};

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
 * 2D level loader: registers the built-in primitive/trigger entity classes and dispatches
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
    const { position, rotation, material, body } = settings;
    return world.addPrimitiveRigidBody(
      { shape, body: { ...defaultBodyOptions, ...body } },
      position,
      rotation,
      material,
    );
  }

  /**
   * Create a trigger entity
   * @param world - The world instance
   * @param settings - The trigger settings
   * @returns The created trigger
   */
  private createTrigger(
    world: Gg2dWorld<TypeDoc>,
    settings: TriggerSettings,
  ): TypeDoc['pTypeDoc']['trigger'] | undefined {
    const { position, rotation, dimensions } = settings;
    const shape: Shape2DDescriptor = { shape: 'SQUARE', dimensions };
    return world.physicsWorld?.factory.createTrigger(shape, { position, rotation });
  }
}
