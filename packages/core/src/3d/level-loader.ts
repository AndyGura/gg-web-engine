import { LevelLoader } from '../base/level-loader';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from './gg-3d-world';
import { Point3, Point4 } from '../base';
import { DisplayObject3dOpts } from './factories';
import { Body3DOptions } from './models/body-options';
import { Shape3DDescriptor } from './models/shapes';
import { Entity3d } from './entities/entity-3d';

const defaultBodyOptions: Body3DOptions = {
  dynamic: true,
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
};

/**
 * Shape names accepted by the built-in `"Primitive"` entity class in a 3D level JSON, via the
 * sibling `shape` field on the entity (e.g. `{ class: "Primitive", shape: "BOX" }`) - the same
 * `Shape3DDescriptor['shape']` values used at the engine API level, so no translation is needed
 * between a level JSON and `Gg3dWorld.addPrimitiveRigidBody`.
 */
export type Primitive3DShapeName = Shape3DDescriptor['shape'];

/**
 * Settings shared by every primitive entity (Box, Sphere, Plane, Capsule, Cylinder, Cone)
 */
export interface Primitive3DSettings {
  /**
   * Which primitive shape to construct
   */
  shape: Primitive3DShapeName;

  /**
   * Position of the primitive
   */
  position?: Point3;

  /**
   * Rotation of the primitive
   */
  rotation?: Point4;

  /**
   * Dimensions of the primitive (for Box)
   */
  dimensions?: Point3;

  /**
   * Radius of the primitive (for Sphere, Capsule, Cylinder, Cone)
   */
  radius?: number;

  /**
   * Height of the primitive (for Cylinder, Cone)
   */
  height?: number;

  /**
   * Centers distance of the primitive (for Capsule)
   */
  centersDistance?: number;

  /**
   * Material options for the primitive
   */
  material?: DisplayObject3dOpts<any>;

  /**
   * Physics body options, merged over sensible defaults
   */
  body?: Partial<Body3DOptions>;
}

/**
 * Settings for a trigger entity
 */
export interface Trigger3DSettings {
  /**
   * Position of the trigger
   */
  position?: Point3;

  /**
   * Rotation of the trigger
   */
  rotation?: Point4;

  /**
   * Dimensions of the trigger
   */
  dimensions: Point3;
}

/**
 * Settings for a camera entity
 */
export interface Camera3DSettings {
  /**
   * Position of the camera
   */
  position?: Point3;

  /**
   * Rotation of the camera
   */
  rotation?: Point4;

  /**
   * Field of view in degrees
   */
  fov?: number;

  /**
   * Aspect ratio (width / height)
   */
  aspectRatio?: number;

  /**
   * Near and far frustum planes
   */
  frustrum?: { near: number; far: number };
}

/**
 * 3D level loader: registers the built-in primitive/trigger/camera entity classes and dispatches
 * `LevelJson` entities to them (or to custom classes registered via `registerClass`).
 * @template TypeDoc - The type document repository
 */
export class Gg3dLevelLoader<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> extends LevelLoader<
  Point3,
  Point4,
  TypeDoc
> {
  constructor(protected readonly world: Gg3dWorld<TypeDoc>) {
    super(world);
    this.registerDefaultClasses();
  }

  /**
   * Register the built-in classes for primitives, triggers, and cameras
   */
  private registerDefaultClasses(): void {
    this.registerClass('Primitive', (world: Gg3dWorld<TypeDoc>, settings: Primitive3DSettings) =>
      this.createPrimitive(world, this.buildShapeDescriptor(settings), settings),
    );

    this.registerClass('Trigger', this.createTrigger.bind(this));
    this.registerClass('Camera', this.createCamera.bind(this));
  }

  /**
   * Turn a `Primitive3DSettings` (`shape` plus shape-specific fields) into the `Shape3DDescriptor`
   * consumed by `Gg3dWorld.addPrimitiveRigidBody`.
   * @param settings - The primitive settings, as parsed from a `"Primitive"` entity's `shape` +
   * `config`
   * @returns The shape descriptor
   */
  private buildShapeDescriptor(settings: Primitive3DSettings): Shape3DDescriptor {
    switch (settings.shape) {
      case 'BOX':
        if (!settings.dimensions) {
          throw new Error('Dimensions are required for BOX primitive');
        }
        return { shape: 'BOX', dimensions: settings.dimensions };
      case 'SPHERE':
        if (settings.radius === undefined) {
          throw new Error('Radius is required for SPHERE primitive');
        }
        return { shape: 'SPHERE', radius: settings.radius };
      case 'PLANE':
        return { shape: 'PLANE' };
      case 'CAPSULE':
        if (settings.radius === undefined) {
          throw new Error('Radius is required for CAPSULE primitive');
        }
        if (settings.centersDistance === undefined) {
          throw new Error('Centers distance is required for CAPSULE primitive');
        }
        return { shape: 'CAPSULE', radius: settings.radius, centersDistance: settings.centersDistance };
      case 'CYLINDER':
        if (settings.radius === undefined) {
          throw new Error('Radius is required for CYLINDER primitive');
        }
        if (settings.height === undefined) {
          throw new Error('Height is required for CYLINDER primitive');
        }
        return { shape: 'CYLINDER', radius: settings.radius, height: settings.height };
      case 'CONE':
        if (settings.radius === undefined) {
          throw new Error('Radius is required for CONE primitive');
        }
        if (settings.height === undefined) {
          throw new Error('Height is required for CONE primitive');
        }
        return { shape: 'CONE', radius: settings.radius, height: settings.height };
      default:
        throw new Error(`Unknown primitive shape "${settings.shape}"`);
    }
  }

  /**
   * Create a primitive entity (both display object and physics body) from a shape descriptor.
   * `Shape3DDescriptor` (no mesh-only segment options) is used for both the visual and the
   * physics representation, same as `Gg3dWorld.addPrimitiveRigidBody`'s own shortcut methods.
   * @param world - The world instance
   * @param shape - The shape descriptor
   * @param settings - Position/rotation/material/body settings shared by all primitives
   * @returns The created entity
   */
  private createPrimitive(
    world: Gg3dWorld<TypeDoc>,
    shape: Shape3DDescriptor,
    settings: Primitive3DSettings,
  ): Entity3d<TypeDoc> {
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
    world: Gg3dWorld<TypeDoc>,
    settings: Trigger3DSettings,
  ): TypeDoc['pTypeDoc']['trigger'] | undefined {
    const { position, rotation, dimensions } = settings;
    const shape: Shape3DDescriptor = { shape: 'BOX', dimensions };
    return world.physicsWorld?.factory.createTrigger(shape, { position, rotation });
  }

  /**
   * Create a camera entity
   * @param world - The world instance
   * @param settings - The camera settings
   * @returns The created camera
   */
  private createCamera(
    world: Gg3dWorld<TypeDoc>,
    settings: Camera3DSettings,
  ): TypeDoc['vTypeDoc']['camera'] | undefined {
    const { position, rotation, fov, aspectRatio, frustrum } = settings;
    const camera = world.visualScene?.factory.createPerspectiveCamera({ fov, aspectRatio, frustrum });
    if (camera) {
      if (position) {
        camera.position = position;
      }
      if (rotation) {
        camera.rotation = rotation;
      }
    }
    return camera;
  }
}
