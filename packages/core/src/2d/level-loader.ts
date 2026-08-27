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
 * Settings shared by every primitive entity (Square, Circle, ...)
 */
export interface PrimitiveSettings {
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
 * 2D level loader: registers generators for the built-in primitive/trigger entity classes and
 * dispatches `LevelJson` entities to them (or to custom generators registered via `registerGenerator`).
 * @template TypeDoc - The type document repository
 */
export class Gg2dLevelLoader<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> extends LevelLoader<
  Point2,
  number,
  TypeDoc
> {
  constructor(protected readonly world: Gg2dWorld<TypeDoc>) {
    super(world);
    this.registerDefaultGenerators();
  }

  /**
   * Register default generators for primitives and triggers
   */
  private registerDefaultGenerators(): void {
    this.registerGenerator('Square', (world: Gg2dWorld<TypeDoc>, settings: PrimitiveSettings) => {
      if (!settings.dimensions) {
        throw new Error('Dimensions are required for Square primitive');
      }
      return this.createPrimitive(world, { shape: 'SQUARE', dimensions: settings.dimensions }, settings);
    });

    this.registerGenerator('Circle', (world: Gg2dWorld<TypeDoc>, settings: PrimitiveSettings) => {
      if (settings.radius === undefined) {
        throw new Error('Radius is required for Circle primitive');
      }
      return this.createPrimitive(world, { shape: 'CIRCLE', radius: settings.radius }, settings);
    });

    this.registerGenerator('Trigger', this.createTrigger.bind(this));
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
