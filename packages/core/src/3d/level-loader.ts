import { EntityJson, LevelLoader } from '../base/level-loader';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from './gg-3d-world';
import { AudioDistanceModel, AxisDirection3, IEntity, Pnt3, Point3, Point4 } from '../base';
import { DisplayObject3dOpts } from './factories';
import { Body3DOptions } from './models/body-options';
import { Shape3DDescriptor } from './models/shapes';
import { Entity3d } from './entities/entity-3d';
import { Trigger3dEntity } from './entities/trigger-3d.entity';
import { Camera3dEntity } from './entities/camera-3d.entity';
import { AudioSource3dEntity } from './entities/audio-source-3d.entity';
import {
  CharacterController3dEntity,
  CharacterController3dEntityOptions,
} from './entities/character-controller-3d.entity';
import {
  CharacterAnimationClipMap,
  CharacterAnimationController,
} from './entities/controllers/character-animation.controller';
import { isAnimatedDisplayObject3d } from './components/rendering/i-animated-display-object-3d.component';
import { GgCarEntity, GgCarProperties } from './entities/gg-car/gg-car.entity';
import {
  RVEntityAxleOptions,
  RVEntitySharedWheelOptions,
  WheelDisplayOptions,
} from './entities/raycast-vehicle-3d.entity';
import {
  Gg3dMapGraphEntityOptions,
  MapGraph,
  MapGraph3dEntity,
  MapGraphNodeType,
} from './entities/map-graph-3d.entity';

const defaultBodyOptions: Body3DOptions = {
  bodyType: 'dynamic',
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
  ccd: false,
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
 * Inverse of `Gg3dLevelLoader.buildShapeDescriptor`: turns a live `Shape3DDescriptor` (as read off
 * a rigid body's `debugBodySettings.shape`) back into the `shape`/`config` fields a `"Primitive"`
 * `EntityJson` needs - backs `Gg3dLevelLoader.serializePrimitive`. Returns `undefined` for a shape
 * `"Primitive"` has no `shape` value for (`COMPOUND`/`CONVEX_HULL`/`MESH`/`TRIANGLE_MESH`, and
 * anything else not listed in `buildShapeDescriptor`'s own `switch`).
 */
function primitiveConfigFromShape(
  shape: Shape3DDescriptor,
): { shape: string; config: Record<string, any> } | undefined {
  switch (shape.shape) {
    case 'BOX':
      return { shape: 'BOX', config: { dimensions: shape.dimensions } };
    case 'SPHERE':
      return { shape: 'SPHERE', config: { radius: shape.radius } };
    case 'PLANE':
      return { shape: 'PLANE', config: {} };
    case 'CAPSULE':
      return { shape: 'CAPSULE', config: { radius: shape.radius, centersDistance: shape.centersDistance } };
    case 'CYLINDER':
      return {
        shape: 'CYLINDER',
        config:
          'radius' in shape
            ? { radius: shape.radius, height: shape.height }
            : { radiusX: shape.radiusX, radiusY: shape.radiusY, height: shape.height },
      };
    case 'CONE':
      return { shape: 'CONE', config: { radius: shape.radius, height: shape.height } };
    default:
      return undefined;
  }
}

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
   * Elliptical cross-section radius along local X, as an alternative to `radius` (Cylinder only).
   * Must be given together with `radiusY`.
   */
  radiusX?: number;

  /**
   * Elliptical cross-section radius along local Y, as an alternative to `radius` (Cylinder only).
   * Must be given together with `radiusX`.
   */
  radiusY?: number;

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

  /**
   * Initial linear velocity, applied once right after the body is created (a physics-only
   * property, only meaningful for a dynamic/kinematic_vel body - has no lasting effect on a
   * static/kinematic_pos one). Left unset entirely (not just omitted) means the body starts at
   * rest, same as not setting it at all.
   */
  linearVelocity?: Point3;

  /** Initial angular velocity - see `linearVelocity`'s own doc, same caveats. */
  angularVelocity?: Point3;
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
 * Settings for the built-in `"Sound"` entity class: loads a clip (via `audioScene.factory
 * .loadClip`) and builds a ready-to-use `AudioSource3dEntity`, positioned like any other level
 * entity. Covers `AudioSource3dEntity`'s "static" and "ambient/level music" placement modes -
 * "attached" (riding another entity's transform) isn't expressible in a level JSON, since JSON
 * has no way to reference a not-yet-loaded entity; wire that up in app code instead, the same way
 * a `"GgCar"` wheel's visual mesh or a `"Player"`'s input controller is - see
 * `gg-engine-level-json`. `playOneShot`-style transient sounds aren't a level entity at all
 * (there's nothing static to declare) - trigger them from a `"PlaySound"` blueprint node instead
 * (see `EntityJson.events`).
 */
export interface Sound3DSettings {
  /** Position of the sound source. */
  position?: Point3;

  /** Rotation of the sound source - only meaningful with a directional cone (`coneOuterAngle` on the source). */
  rotation?: Point4;

  /** URL of the clip to load. */
  path: string;

  /** Whether to loop. Defaults to `true` - static/ambient sounds are normally continuous. */
  loop?: boolean;

  volume?: number;
  playbackRate?: number;

  /** Positional 3D audio vs. flat/non-positional (ambient bed, level music, UI). Defaults to `true`. */
  spatial?: boolean;

  /** Output bus/category (e.g. `"sfx"`, `"music"`, `"ambient"`). Defaults to `"sfx"`. */
  bus?: string;

  /** Whether to start playing as soon as the level loads. Defaults to `true`. */
  autoplay?: boolean;

  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  distanceModel?: AudioDistanceModel;
}

/**
 * Settings for the built-in `"Player"` entity class's `display.model` - loads a bone-animated `.glb`
 * character model (via `loadFromGlb`) in place of the auto-generated capsule mesh, and wires up a
 * `CharacterAnimationController` (as a child of the returned entity - see
 * `CharacterController3dEntity.addChildren`) to drive idle/walk/run/crouch/jump switching
 * automatically, using the character's own `isGrounded`/`isCrouching`/`isRunning`/`moveDirection`
 * state - no extra app code needed for either. Ignored (with the rest of `display`) if there's no
 * visual scene.
 */
export interface PlayerModel3DSettings {
  /** Path (URL or path prefix, without extension) to the `.glb` file - passed straight through to
   * `loadFromGlb`. */
  path: string;
  /**
   * Local offset applied to the loaded model relative to the capsule's own center - see
   * `LoadGlbOptions.offset`. Defaults to `-(radius + centersDistance / 2)` along `up` (the
   * capsule's own bottom), matching a model authored with its origin at the feet, the common case
   * for a character rig. Set explicitly (e.g. `Pnt3.O`) for a model already authored with its
   * origin at the capsule's center.
   */
  offset?: Point3;
  /** See `CharacterAnimationClipMap` - maps a built-in animation state to this model's own clip
   * name, for a model whose clips aren't already named `"idle"`/`"walk"`/`"run"`/`"crouch"`/
   * `"jump"`. */
  animations?: CharacterAnimationClipMap;
  /** Crossfade duration (seconds) applied on every animation state switch. Default 0.2. */
  fadeDuration?: number;
  /** See `CharacterAnimationControllerOptions.groundedTransitionDelay` - how long `isGrounded` must
   * hold steady before the animation state trusts it, to avoid flickering between a grounded state
   * and `"jump"` while standing at an edge. Default 0.15. */
  groundedTransitionDelay?: number;
}

/**
 * Settings for the built-in `"Player"` entity class: a capsule-bodied `CharacterController3dEntity`
 * (see that class's own doc for the gameplay fields below). Only the physics/visual capsule is
 * built here - the input/camera wiring (`PlayerCharacterController`) needs a live canvas/
 * `KeyboardInput`/renderer the app supplies, so it's left to the app's own code, the same way a
 * `"Camera"` entity is just a positioned `Camera3dEntity` while `FreeCameraController`/
 * `OrbitCameraController` wiring happens outside the level JSON too.
 */
export type Player3DSettings = Partial<Omit<CharacterController3dEntityOptions, 'radius' | 'centersDistance'>> & {
  /** Spawn position of the character (capsule center). */
  position?: Point3;
  /** Spawn rotation of the character. */
  rotation?: Point4;
  /** Capsule radius. Default 0.4. */
  radius?: number;
  /** Standing capsule centersDistance. Default 1.0. */
  centersDistance?: number;
  /**
   * Material options for the auto-generated capsule mesh; omit (along with `model`) for a
   * physics-only, invisible player. `model`, if given, loads an animated character model instead of
   * the capsule mesh entirely - the rest of `display` (`color`/`shading`/...) is then ignored.
   */
  display?: DisplayObject3dOpts<any> & { model?: PlayerModel3DSettings };
};

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
 * counterpart of the GLB-driven car construction an app does by hand when it instead loads a
 * modeled chassis mesh/body and derives each wheel's position/specs from named dummy objects in
 * that same model before constructing `GgCarEntity` directly. This settings type is for the case
 * where the chassis/wheels are plain primitives rather than loaded meshes, so the whole thing can
 * be declared as data in a level JSON instead.
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
  graph: { type?: 'array'; nodes: MapGraphNodeJson[]; closed?: boolean } | { type: 'grid'; grid: MapGraphNodeJson[][] };

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
    this.registerClass('Sound', this.createSound.bind(this));
    this.registerClass('Player', this.createPlayer.bind(this));
    this.registerClass('GgCar', this.createGgCar.bind(this));
    this.registerClass('MapGraph', this.createMapGraph.bind(this));

    this.registerLiveSerializer(this.serializePrimitive.bind(this));
    this.registerLiveSerializer(this.serializeTrigger.bind(this));
  }

  /**
   * Live serializer for the built-in `"Primitive"` class - see `LiveEntitySerializer`'s own doc for
   * the general contract. Matches an entity built by `addPrimitiveRigidBody`/`createPrimitive`
   * exactly (`entity.constructor === Entity3d`, deliberately not `instanceof` - a richer subclass
   * like `Grabbable3dEntity` needs its own dedicated serializer, not yet provided, to round-trip
   * correctly instead of silently losing its grabbable behavior). Recovers `shape`/`dimensions`/
   * `radius`/etc. from `objectBody.debugBodySettings.shape` (the exact `Shape3DDescriptor` the body
   * was actually built with, tracked by every physics adapter regardless of how the body was
   * constructed) and `body`/`linearVelocity`/`angularVelocity` from the live physics body itself
   * (`objectBody.bodyOptions`, `.linearVelocity`, `.angularVelocity`) - not from whatever `config`
   * the entity may or may not have originally been loaded from. Returns `undefined` (falls through
   * to the next serializer, then the spawn-record echo) for a shape `"Primitive"` doesn't support
   * (`COMPOUND`/`CONVEX_HULL`/`MESH`/`TRIANGLE_MESH` - buildable directly via
   * `physicsWorld.factory.createRigidBody`, just not through this level-JSON class) or an entity
   * with no physics body at all (`objectBody` unset - a display-only primitive has nothing this
   * serializer can recover a `shape`/`body` from).
   *
   * Deliberately doesn't attempt to recover `material` - unlike a rigid body's `debugBodySettings
   * .shape`/`bodyOptions`, no adapter's visual display-object component exposes an equivalent
   * "what was I actually created with" accessor, so a primitive's color/shading can't be read back
   * from its live `object3D` today; a serialized `"Primitive"` reloads with default material.
   */
  private serializePrimitive(entity: IEntity<Point3, Point4, TypeDoc>): EntityJson | undefined {
    if (entity.constructor !== Entity3d || !(entity as Entity3d<TypeDoc>).objectBody) {
      return undefined;
    }
    const positionable = entity as Entity3d<TypeDoc>;
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
   * Live serializer for the built-in `"Trigger"` class - see `serializePrimitive`'s own doc for the
   * general approach (same `debugBodySettings.shape`-based recovery, applied to a trigger's `ITrigger3dComponent`
   * instead of a rigid body). Matches `entity.constructor === Trigger3dEntity` exactly.
   */
  private serializeTrigger(entity: IEntity<Point3, Point4, TypeDoc>): EntityJson | undefined {
    if (entity.constructor !== Trigger3dEntity) {
      return undefined;
    }
    const trigger = entity as Trigger3dEntity<TypeDoc['pTypeDoc']>;
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
        if (settings.height === undefined) {
          throw new Error('Height is required for CYLINDER primitive');
        }
        if (settings.radius !== undefined) {
          return { shape: 'CYLINDER', radius: settings.radius, height: settings.height };
        }
        if (settings.radiusX !== undefined && settings.radiusY !== undefined) {
          return { shape: 'CYLINDER', radiusX: settings.radiusX, radiusY: settings.radiusY, height: settings.height };
        }
        throw new Error('Radius (or radiusX and radiusY) is required for CYLINDER primitive');
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
      if (angularVelocity) {
        entity.objectBody.angularVelocity = angularVelocity;
      }
    }
    return entity;
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
   * Create a `"Sound"` entity: loads `settings.path` via `audioScene.factory.loadClip` and wraps
   * the resulting source in a ready-to-use `AudioSource3dEntity`, statically positioned. Returns
   * `undefined` (no-op) if the world has no `audioScene`, same posture as `createTrigger`/
   * `createCamera` returning `undefined` for a missing physics/visual scene.
   * @param world - The world instance
   * @param settings - The sound settings
   * @returns The created audio source entity
   */
  private async createSound(
    world: Gg3dWorld<TypeDoc>,
    settings: Sound3DSettings,
  ): Promise<AudioSource3dEntity<TypeDoc> | undefined> {
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
    const entity = new AudioSource3dEntity<TypeDoc>(source);
    if (settings.position) {
      entity.position = settings.position;
    }
    if (settings.rotation) {
      entity.rotation = settings.rotation;
    }
    return entity;
  }

  /**
   * Create a `"Player"` entity: a capsule-shaped `CharacterController3dEntity`, with a matching
   * auto-generated capsule mesh when `display` is given and there's a visual scene (physics-only/
   * invisible otherwise). See `Player3DSettings`'s doc for why this doesn't also build a
   * `PlayerCharacterController`.
   * @param world - The world instance
   * @param settings - The player settings
   * @returns The created character entity
   */
  private async createPlayer(
    world: Gg3dWorld<TypeDoc>,
    settings: Player3DSettings,
  ): Promise<CharacterController3dEntity<TypeDoc> | undefined> {
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
      ...gameplay
    } = settings;
    if (!world.physicsWorld) {
      return undefined;
    }
    // `offset`/`maxStepHeight`/`up`/`ownCollisionGroups`/`interactWithCollisionGroups`/etc. above are
    // `undefined` whenever the level JSON didn't set them - they must be left out of the objects
    // below entirely (not passed through as explicit `undefined` values) so each adapter's own
    // `{...DEFAULT_OPTIONS, ...options}` merge (and `CharacterController3dEntity`'s own
    // `{...DEFAULT_OPTIONS, ...options}`) actually falls back to its default for that field, rather
    // than a present-but-`undefined` key overwriting the default with `undefined` (a real bug found
    // here: an unset `maxSlopeClimbAngleRad` silently disabled all ground detection, since
    // `angle <= undefined` is always `false`). `up`/`ownCollisionGroups`/`interactWithCollisionGroups`
    // must be included in `tunableOptions` (not left to fall into `...gameplay` below) so they reach
    // `factory.createCharacterController` and actually configure the physics component, not just
    // `CharacterController3dEntity`'s cosmetic options object.
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
    let object3D: TypeDoc['vTypeDoc']['displayObject'] | null = null;
    if (world.visualScene) {
      if (display?.model) {
        // Default: the model's own origin sits at the capsule's bottom (`up` negated by the
        // capsule's own half-height) - the common convention for a character rig authored with its
        // origin at the feet. `tunableOptions.up` mirrors the same "leave it out entirely when
        // unset" reasoning as every other field above - `?? Pnt3.Z` supplies the same default
        // `CharacterController3dEntity`/every adapter's own `createCharacterController` falls back
        // to when `up` isn't explicitly given.
        const modelOffset =
          display.model.offset ?? Pnt3.scalarMult(tunableOptions.up ?? Pnt3.Z, -(radius + centersDistance / 2));
        const glb = await fetch(`${display.model.path}.glb`).then(r => r.arrayBuffer());
        object3D = await world.visualScene.loader.loadFromGlb(glb, { offset: modelOffset });
      } else {
        object3D = world.visualScene.factory.createCapsule(radius, centersDistance, display);
      }
    }
    const entity = new CharacterController3dEntity<TypeDoc>(
      {
        radius,
        centersDistance,
        ...tunableOptions,
        ...gameplay,
      },
      object3D,
      characterController,
    );
    if (position) {
      entity.position = position;
    }
    if (rotation) {
      entity.rotation = rotation;
    }
    if (display?.model && isAnimatedDisplayObject3d(object3D)) {
      entity.addChildren(
        new CharacterAnimationController<TypeDoc>(entity, {
          clipMap: display.model.animations ?? {},
          ...(display.model.fadeDuration !== undefined && { fadeDuration: display.model.fadeDuration }),
          ...(display.model.groundedTransitionDelay !== undefined && {
            groundedTransitionDelay: display.model.groundedTransitionDelay,
          }),
        }),
      );
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
      displayObject: world.visualScene.factory.createCylinder(
        tyreRadius,
        tyreWidth,
        wheelSettings.display.material ?? {},
      ),
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
    const normalizeNode = (node: MapGraphNodeJson): MapGraphNodeType => ({
      ...node,
      loadOptions: node.loadOptions ?? {},
    });

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
