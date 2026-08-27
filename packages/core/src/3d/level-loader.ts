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
 * Settings shared by every primitive entity (Box, Sphere, Plane, Capsule, Cylinder, Cone)
 */
export interface Primitive3DSettings {
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
 * 3D level loader: registers generators for the built-in primitive/trigger/camera entity classes
 * and dispatches `LevelJson` entities to them (or to custom generators registered via `registerGenerator`).
 * @template TypeDoc - The type document repository
 */
export class Gg3dLevelLoader<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> extends LevelLoader<
  Point3,
  Point4,
  TypeDoc
> {
  constructor(protected readonly world: Gg3dWorld<TypeDoc>) {
    super(world);
    this.registerDefaultGenerators();
  }

  /**
   * Register default generators for primitives, triggers, and cameras
   */
  private registerDefaultGenerators(): void {
    this.registerGenerator('Box', (world: Gg3dWorld<TypeDoc>, settings: Primitive3DSettings) => {
      if (!settings.dimensions) {
        throw new Error('Dimensions are required for Box primitive');
      }
      return this.createPrimitive(world, { shape: 'BOX', dimensions: settings.dimensions }, settings);
    });

    this.registerGenerator('Sphere', (world: Gg3dWorld<TypeDoc>, settings: Primitive3DSettings) => {
      if (settings.radius === undefined) {
        throw new Error('Radius is required for Sphere primitive');
      }
      return this.createPrimitive(world, { shape: 'SPHERE', radius: settings.radius }, settings);
    });

    this.registerGenerator('Plane', (world: Gg3dWorld<TypeDoc>, settings: Primitive3DSettings) =>
      this.createPrimitive(world, { shape: 'PLANE' }, settings),
    );

    this.registerGenerator('Capsule', (world: Gg3dWorld<TypeDoc>, settings: Primitive3DSettings) => {
      if (settings.radius === undefined) {
        throw new Error('Radius is required for Capsule primitive');
      }
      if (settings.centersDistance === undefined) {
        throw new Error('Centers distance is required for Capsule primitive');
      }
      return this.createPrimitive(
        world,
        { shape: 'CAPSULE', radius: settings.radius, centersDistance: settings.centersDistance },
        settings,
      );
    });

    this.registerGenerator('Cylinder', (world: Gg3dWorld<TypeDoc>, settings: Primitive3DSettings) => {
      if (settings.radius === undefined) {
        throw new Error('Radius is required for Cylinder primitive');
      }
      if (settings.height === undefined) {
        throw new Error('Height is required for Cylinder primitive');
      }
      return this.createPrimitive(
        world,
        { shape: 'CYLINDER', radius: settings.radius, height: settings.height },
        settings,
      );
    });

    this.registerGenerator('Cone', (world: Gg3dWorld<TypeDoc>, settings: Primitive3DSettings) => {
      if (settings.radius === undefined) {
        throw new Error('Radius is required for Cone primitive');
      }
      if (settings.height === undefined) {
        throw new Error('Height is required for Cone primitive');
      }
      return this.createPrimitive(world, { shape: 'CONE', radius: settings.radius, height: settings.height }, settings);
    });

    this.registerGenerator('Trigger', this.createTrigger.bind(this));
    this.registerGenerator('Camera', this.createCamera.bind(this));
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
