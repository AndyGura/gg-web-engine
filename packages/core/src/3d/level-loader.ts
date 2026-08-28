import { LevelLoader } from '../base/level-loader';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from './gg-3d-world';
import { AxisDirection3, Point3, Point4 } from '../base';
import { DisplayObject3dOpts } from './factories';
import { Body3DOptions } from './models/body-options';
import { Shape3DDescriptor } from './models/shapes';
import { Entity3d } from './entities/entity-3d';
import { Trigger3dEntity } from './entities/trigger-3d.entity';
import { Camera3dEntity } from './entities/camera-3d.entity';
import { GgCarEntity, GgCarProperties } from './entities/gg-car/gg-car.entity';
import {
  RVEntityAxleOptions,
  RVEntitySharedWheelOptions,
  WheelDisplayOptions,
} from './entities/raycast-vehicle-3d.entity';
import { Gg3dMapGraphEntityOptions, MapGraph, MapGraph3dEntity, MapGraphNodeType } from './entities/map-graph-3d.entity';

const defaultBodyOptions: Body3DOptions = {
  dynamic: true,
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
};

const defaultCarChassisBodyOptions: Body3DOptions = {
  ...defaultBodyOptions,
  mass: 800,
};

/** Fallback tyre size used only to size a `"GgCar"` wheel's auto-generated cylinder mesh when
 * neither the wheel nor its shared wheel settings specify one - independent of the physics
 * wheel's own default (`RaycastVehicle3dEntity`'s internal `wheeelDefaults`) applied when a
 * wheel's `tyreRadius`/`tyreWidth` is left unset entirely. */
const defaultWheelDisplaySize = { tyreRadius: 0.4, tyreWidth: 0.3 };

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
 * Settings for a `"GgCar"` wheel's optional visual mesh. A level JSON has no way to reference an
 * existing display object component (unlike programmatic `RVEntityProperties`, whose
 * `WheelDisplayOptions.displayObject` takes one directly) - instead, supplying `display` at all
 * makes the `"GgCar"` generator build one itself via `visualScene.factory.createCylinder`, sized
 * to that wheel's own (or its axle/shared settings') `tyreRadius`/`tyreWidth`. Omit `display`
 * entirely (on both the wheel and whatever it inherits from) to leave that wheel invisible
 * (physics-only), same as omitting `WheelDisplayOptions.displayObject` does programmatically.
 */
export interface GgCarWheelDisplaySettings {
  material?: DisplayObject3dOpts<any>;
  wheelObjectDirection?: AxisDirection3;
}

/**
 * JSON-friendly counterpart of `RVEntitySharedWheelOptions`: identical except `display` is a
 * {@link GgCarWheelDisplaySettings} descriptor instead of a ready-made `WheelDisplayOptions`.
 */
export type GgCarSharedWheelSettings = Omit<RVEntitySharedWheelOptions, 'display'> & {
  display?: GgCarWheelDisplaySettings;
};

/**
 * JSON-friendly counterpart of `RVEntityAxleOptions`, for the `"GgCar"` class's `wheelBase.front`/
 * `wheelBase.rear`.
 */
export type GgCarAxleSettings = Pick<RVEntityAxleOptions, 'halfAxleWidth' | 'axlePosition' | 'axleHeight'> &
  GgCarSharedWheelSettings;

/**
 * JSON-friendly counterpart of one `RVEntityProperties['wheelOptions']` element, for the
 * `"GgCar"` class's `wheelOptions` array.
 */
export type GgCarWheelSettings = GgCarSharedWheelSettings & {
  isLeft: boolean;
  isFront: boolean;
  position: Point3;
};

/**
 * Fields of `GgCarProperties` that don't vary between its `wheelBase`/`wheelOptions` shapes -
 * carried over into {@link GgCar3DSettings} as-is (already plain JSON-serializable data).
 */
export interface GgCar3DCommonSettings {
  suspension: GgCarProperties['suspension'];
  tractionBias: GgCarProperties['tractionBias'];
  mpsToRpmFactor?: GgCarProperties['mpsToRpmFactor'];
  engine: GgCarProperties['engine'];
  brake: GgCarProperties['brake'];
  transmission: GgCarProperties['transmission'];
  maxSteerAngle: GgCarProperties['maxSteerAngle'];
}

/**
 * Settings for the built-in `"GgCar"` entity class (3D only): builds a box-shaped chassis rigid
 * body (+ optional matching display box) and a full `GgCarEntity` on top of it - the procedural
 * counterpart of the GLB-driven car construction apps do by hand (see `examples/fly-city-three-ammo`'s
 * `GameFactory.generateCar`), for a car whose chassis/wheels are plain primitives rather than
 * loaded meshes.
 */
export type GgCar3DSettings = GgCar3DCommonSettings & {
  position?: Point3;
  rotation?: Point4;

  /**
   * The chassis's box collider/mesh. `body` is merged over a default dynamic body (same shape as
   * `Primitive3DSettings.body`, but with `mass: 800` instead of `1`, since a `mass: 1` chassis is
   * unrealistically light for a car).
   */
  chassis: {
    dimensions: Point3;
    material?: DisplayObject3dOpts<any>;
    body?: Partial<Body3DOptions>;
  };
} & (
    | {
        wheelBase: {
          shared?: GgCarSharedWheelSettings;
          front: GgCarAxleSettings;
          rear: GgCarAxleSettings;
        };
        wheelOptions?: undefined;
        sharedWheelOptions?: undefined;
      }
    | {
        wheelOptions: GgCarWheelSettings[];
        sharedWheelOptions?: GgCarSharedWheelSettings;
        wheelBase?: undefined;
      }
  );

/**
 * JSON-friendly counterpart of `MapGraphNodeType`: identical except `loadOptions` may be omitted
 * (defaulting to `{}`) rather than required, since most nodes need none of it.
 */
export type MapGraphNodeJson = Omit<MapGraphNodeType, 'loadOptions'> & {
  loadOptions?: MapGraphNodeType['loadOptions'];
};

/**
 * Settings for the built-in `"MapGraph"` entity class (3D only): builds a `MapGraph` from plain
 * node data and wraps it in a ready-to-use `MapGraph3dEntity`. `graph` mirrors the two
 * `MapGraph` factory methods - a flat (optionally closed-loop) path via `nodes`, or a rectangular
 * `grid` - since both already take plain-data node arrays. The resulting entity doesn't implement
 * `IPositionable3d` (each node carries its own absolute `position`/`rotation`), so there's no
 * `position`/`rotation` field here - and its `loaderCursor$` still needs to be driven at runtime
 * from whatever entity's position should determine which nodes are loaded (see
 * `gg-engine-level-json` skill's "MapGraph" section).
 */
export interface MapGraph3DSettings {
  graph:
    | { type?: 'array'; nodes: MapGraphNodeJson[]; closed?: boolean }
    | { type: 'grid'; grid: MapGraphNodeJson[][] };

  /** Depth in the graph to load - see `Gg3dMapGraphEntityOptions.loadDepth` (default `5`) */
  loadDepth?: number;

  /** Extra unload-delay depth - see `Gg3dMapGraphEntityOptions.inertia` (default `0`) */
  inertia?: number;

  /** Max nodes loaded per tick - see `Gg3dMapGraphEntityOptions.maxNodesLoadingPerTick` (default `1`) */
  maxNodesLoadingPerTick?: number;

  /** Ticks/second of the internal load-scheduling clock - see `MapGraph3dEntity.loadRateLimit` (default `1`) */
  loadRateLimit?: number;
}

/**
 * 3D level loader: registers the built-in primitive/trigger/camera/car/map-graph entity classes
 * and dispatches `LevelJson` entities to them (or to custom classes registered via
 * `registerClass`).
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
    this.registerClass('GgCar', this.createGgCar.bind(this));
    this.registerClass('MapGraph', this.createMapGraph.bind(this));
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
   * Create a trigger entity: a `Trigger3dEntity` wrapping the raw physics trigger component, so
   * the app can subscribe to `onEntityEntered`/`onEntityLeft` without any extra wiring - see the
   * base `LevelLoader` docs for how it's parented for level-lifecycle cleanup.
   * @param world - The world instance
   * @param settings - The trigger settings
   * @returns The created trigger entity
   */
  private createTrigger(
    world: Gg3dWorld<TypeDoc>,
    settings: Trigger3DSettings,
  ): Trigger3dEntity<TypeDoc['pTypeDoc']> | undefined {
    const { position, rotation, dimensions } = settings;
    const shape: Shape3DDescriptor = { shape: 'BOX', dimensions };
    const trigger = world.physicsWorld?.factory.createTrigger(shape, { position, rotation });
    if (!trigger) {
      return undefined;
    }
    const entity = new Trigger3dEntity<TypeDoc['pTypeDoc']>(trigger);
    if (position) {
      entity.position = position;
    }
    if (rotation) {
      entity.rotation = rotation;
    }
    return entity;
  }

  /**
   * Create a camera entity: a `Camera3dEntity` wrapping the raw camera component, not attached to
   * any renderer/canvas (a level JSON has no notion of one - `world.addRenderer(entity.camera,
   * canvas)` once the app has a canvas). Parented under the level's group entity, so it's torn
   * down along with the rest of the level - put a camera meant to outlive a level swap in a
   * separate, never-unloaded level instead (see `gg-engine-level-json`'s "Camera" section).
   * @param world - The world instance
   * @param settings - The camera settings
   * @returns The created camera entity
   */
  private createCamera(
    world: Gg3dWorld<TypeDoc>,
    settings: Camera3DSettings,
  ): Camera3dEntity<TypeDoc['vTypeDoc']> | undefined {
    const { position, rotation, fov, aspectRatio, frustrum } = settings;
    const camera = world.visualScene?.factory.createPerspectiveCamera({ fov, aspectRatio, frustrum });
    if (!camera) {
      return undefined;
    }
    const entity = new Camera3dEntity<TypeDoc['vTypeDoc']>(camera);
    if (position) {
      entity.position = position;
    }
    if (rotation) {
      entity.rotation = rotation;
    }
    return entity;
  }

  /**
   * Build a `WheelDisplayOptions` for one `"GgCar"` wheel/axle from its (already shared-merged)
   * settings, via `visualScene.factory.createCylinder`. Returns `undefined` (no visual wheel,
   * physics-only) if `display` wasn't specified at all, or there's no visual scene to build one
   * against.
   * @param world - The world instance
   * @param wheelSettings - The wheel's own settings, already merged over whatever it inherits
   * from `wheelBase.shared`/`sharedWheelOptions`
   * @returns The resolved display options, or `undefined`
   */
  private resolveWheelDisplay(
    world: Gg3dWorld<TypeDoc>,
    wheelSettings: GgCarSharedWheelSettings,
  ): WheelDisplayOptions | undefined {
    if (!wheelSettings.display || !world.visualScene) {
      return undefined;
    }
    const { tyreRadius = defaultWheelDisplaySize.tyreRadius, tyreWidth = defaultWheelDisplaySize.tyreWidth } =
      wheelSettings;
    return {
      displayObject: world.visualScene.factory.createCylinder(tyreRadius, tyreWidth, wheelSettings.display.material ?? {}),
      wheelObjectDirection: wheelSettings.display.wheelObjectDirection ?? 'x',
    };
  }

  /**
   * Create a `"GgCar"` entity: a box chassis rigid body (+ optional matching display box) wrapped
   * in a full `GgCarEntity`, with each wheel's optional visual mesh built from its settings (see
   * {@link resolveWheelDisplay}) rather than referencing an existing display object component,
   * which a level JSON has no way to do.
   * @param world - The world instance
   * @param settings - The car settings
   * @returns The created car entity
   */
  private createGgCar(world: Gg3dWorld<TypeDoc>, settings: GgCar3DSettings): GgCarEntity<TypeDoc> | undefined {
    if (!world.physicsWorld) {
      return undefined;
    }
    const { position, rotation, chassis, wheelBase, wheelOptions, sharedWheelOptions, ...rest } = settings;
    if (!chassis?.dimensions) {
      throw new Error('Chassis dimensions are required for GgCar class');
    }
    if (!wheelBase && !wheelOptions) {
      throw new Error('Either "wheelBase" or "wheelOptions" is required for GgCar class');
    }

    const chassisBody = world.physicsWorld.factory.createRigidBody({
      shape: { shape: 'BOX', dimensions: chassis.dimensions },
      body: { ...defaultCarChassisBodyOptions, ...chassis.body },
    });
    const chassis3D = world.visualScene?.factory.createBox(chassis.dimensions, chassis.material ?? {}) ?? null;

    const carProperties: GgCarProperties = wheelBase
      ? {
          ...rest,
          wheelBase: {
            shared: { ...wheelBase.shared, display: undefined },
            front: {
              ...wheelBase.front,
              display: this.resolveWheelDisplay(world, { ...wheelBase.shared, ...wheelBase.front }),
            },
            rear: {
              ...wheelBase.rear,
              display: this.resolveWheelDisplay(world, { ...wheelBase.shared, ...wheelBase.rear }),
            },
          },
        }
      : {
          ...rest,
          wheelOptions: wheelOptions!.map(wheel => ({
            ...wheel,
            display: this.resolveWheelDisplay(world, { ...sharedWheelOptions, ...wheel }),
          })),
          sharedWheelOptions: sharedWheelOptions && { ...sharedWheelOptions, display: undefined },
        };

    const entity = new GgCarEntity<TypeDoc>(
      carProperties,
      chassis3D,
      world.physicsWorld.factory.createRaycastVehicle(chassisBody),
    );
    if (position) {
      entity.position = position;
    }
    if (rotation) {
      entity.rotation = rotation;
    }
    return entity;
  }

  /**
   * Create a `"MapGraph"` entity: a `MapGraph` built from plain node data (a flat/looped path or
   * a rectangular grid, see {@link MapGraph3DSettings}), wrapped in a ready-to-use
   * `MapGraph3dEntity`. The app still has to drive `loaderCursor$` itself once the level is
   * loaded - see `gg-engine-level-json`'s "MapGraph" section.
   * @param world - The world instance
   * @param settings - The map graph settings
   * @returns The created map graph entity
   */
  private createMapGraph(world: Gg3dWorld<TypeDoc>, settings: MapGraph3DSettings): MapGraph3dEntity<TypeDoc> {
    const { graph, loadDepth, inertia, maxNodesLoadingPerTick, loadRateLimit } = settings;
    if (!graph) {
      throw new Error('"graph" is required for MapGraph class');
    }
    const normalizeNode = (node: MapGraphNodeJson): MapGraphNodeType => ({ ...node, loadOptions: node.loadOptions ?? {} });

    let mapGraph: MapGraph;
    if (graph.type === 'grid') {
      if (!graph.grid?.length) {
        throw new Error('"graph.grid" must be a non-empty grid for MapGraph class');
      }
      mapGraph = MapGraph.fromMapSquareGrid(graph.grid.map(row => row.map(normalizeNode)));
    } else {
      if (!graph.nodes?.length) {
        throw new Error('"graph.nodes" must be a non-empty array for MapGraph class');
      }
      mapGraph = MapGraph.fromMapArray(graph.nodes.map(normalizeNode), graph.closed ?? false);
    }

    const options: Partial<Gg3dMapGraphEntityOptions> = {
      ...(loadDepth !== undefined ? { loadDepth } : {}),
      ...(inertia !== undefined ? { inertia } : {}),
      ...(maxNodesLoadingPerTick !== undefined ? { maxNodesLoadingPerTick } : {}),
    };
    const entity = new MapGraph3dEntity<TypeDoc>(mapGraph, options);
    if (loadRateLimit !== undefined) {
      entity.loadRateLimit = loadRateLimit;
    }
    return entity;
  }
}
