/*
 * Input of `etc/generate_level_schema.mjs` (repo root) for `schema/level-3d.schema.json`. Composes
 * the 3D level loader's exported settings types into a `LevelJson` whose `entities` items are a
 * union discriminated on `class`, one member per built-in class alias, with `shape` selecting the
 * fields a `"Primitive"`/`"Trigger"` needs. Every field, description and default comes from the
 * composed types. The generator does not evaluate conditional types or `Omit` over a union, so
 * the compositions avoid both and spell unions out member by member; the `Same<>` assertions at
 * the end make the type check (which the generator runs first) fail when a composition stops
 * matching the settings type it stands for.
 */
import { EntityJson, LevelJson } from '../../src/base/level-loader';
import { Point3, Point4 } from '../../src/base/models/points';
import { CylinderRadius, Shape3DDescriptor } from '../../src/3d/models/shapes';
import { Light3dDescriptor } from '../../src/3d/models/lights';
import {
  Camera3DSettings,
  CompoundChild3DSettings,
  Environment3DSettings,
  GgCar3DCommonSettings,
  GgCar3DSettings,
  GgCarWheelLayoutSettings,
  Light3DSettings,
  MapGraph3DSettings,
  Player3DSettings,
  Primitive3DSettings,
  Primitive3DShapeName,
  Primitive3DShapeSettings,
  Sound3DSettings,
  Trigger3DSettings,
} from '../../src/3d/level-loader';
import { Glb3DSettings } from '../../src/3d/loader';

/** Fields `loadLevel` reads off the entity itself rather than out of `config`. */
type EntityLevelKeys = 'shape' | 'position' | 'rotation' | 'name';

/** One shape's fields: descriptions from `Primitive3DShapeSettings`, required-ness from `Shape3DDescriptor`. */
type DescriptorFields3D<S extends Primitive3DShapeName, K extends keyof Primitive3DShapeSettings> = Pick<
  Primitive3DShapeSettings,
  K
> &
  Omit<Extract<Shape3DDescriptor, { shape: S }>, 'shape' | 'collisionMargin'>;

/** The fields a `COMPOUND` shape needs (an interface, so the recursion through `children` resolves lazily). */
export interface CompoundShapeFields3D {
  /**
   * Child shapes making up a Compound primitive, each with its own local `position`/`rotation`
   * offset. A child's `shape` may itself be `"COMPOUND"`, nesting arbitrarily deep.
   */
  children: CompoundChild3DJson[];
}

/**
 * The fields each shape needs, one named type per shape. The unions below reference these names
 * rather than `ShapeFields3D['BOX']`: the generator misreads that indexed access once the
 * recursion through `children` is involved. `ShapeFields3D` exists for the checks at the end.
 */
type BoxFields3D = DescriptorFields3D<'BOX', 'dimensions'>;
type SphereFields3D = DescriptorFields3D<'SPHERE', 'radius'>;
type ConeFields3D = DescriptorFields3D<'CONE', 'radius' | 'height'>;
type CylinderFields3D = Pick<Primitive3DShapeSettings, 'height'> &
  Omit<
    Extract<Shape3DDescriptor, { shape: 'CYLINDER' }>,
    'shape' | 'collisionMargin' | 'radius' | 'radiusX' | 'radiusY'
  > &
  CylinderRadius;
type CapsuleFields3D = DescriptorFields3D<'CAPSULE', 'radius' | 'centersDistance'>;
type ConvexHullFields3D = DescriptorFields3D<'CONVEX_HULL', 'vertices'>;
type MeshFields3D = DescriptorFields3D<'MESH', 'vertices' | 'faces'>;

/** Per shape, exactly the fields `buildShapeDescriptor` needs. */
interface ShapeFields3D {
  PLANE: {};
  BOX: BoxFields3D;
  SPHERE: SphereFields3D;
  CONE: ConeFields3D;
  CYLINDER: CylinderFields3D;
  CAPSULE: CapsuleFields3D;
  COMPOUND: CompoundShapeFields3D;
  CONVEX_HULL: ConvexHullFields3D;
  MESH: MeshFields3D;
}

/** One shape with exactly the fields it needs. */
export type Shape3DJson =
  | { shape: 'PLANE' }
  | ({ shape: 'BOX' } & BoxFields3D)
  | ({ shape: 'SPHERE' } & SphereFields3D)
  | ({ shape: 'CONE' } & ConeFields3D)
  | ({ shape: 'CYLINDER' } & CylinderFields3D)
  | ({ shape: 'CAPSULE' } & CapsuleFields3D)
  | ({ shape: 'COMPOUND' } & CompoundShapeFields3D)
  | ({ shape: 'CONVEX_HULL' } & ConvexHullFields3D)
  | ({ shape: 'MESH' } & MeshFields3D);

/** One child of a `COMPOUND` shape. */
export type CompoundChild3DJson = Pick<CompoundChild3DSettings, 'position' | 'rotation'> & Shape3DJson;

/** Fields every entity has, whatever its class. */
type EntityCommon = Pick<EntityJson, 'name' | 'events'>;

type Positioned3D = {
  /** Position of the entity */
  position?: Point3;
  /** Rotation of the entity (quaternion) */
  rotation?: Point4;
};

type PrimitiveConfig3D = Omit<Primitive3DSettings, keyof Primitive3DShapeSettings | EntityLevelKeys>;
type PrimitiveEntity3D<S extends Primitive3DShapeName> = EntityCommon &
  Positioned3D & {
    class: 'Primitive';
    /** Which primitive shape to construct */
    shape: S;
  };
type PrimitiveWithFields3D<S extends Primitive3DShapeName, Fields> = PrimitiveEntity3D<S> & {
  config: PrimitiveConfig3D & Fields;
};

/** A `"Primitive"` entity; `shape` picks which fields `config` needs. */
export type Primitive3DEntityJson =
  | (PrimitiveEntity3D<'PLANE'> & { config?: PrimitiveConfig3D })
  | PrimitiveWithFields3D<'BOX', BoxFields3D>
  | PrimitiveWithFields3D<'SPHERE', SphereFields3D>
  | PrimitiveWithFields3D<'CONE', ConeFields3D>
  | PrimitiveWithFields3D<'CYLINDER', CylinderFields3D>
  | PrimitiveWithFields3D<'CAPSULE', CapsuleFields3D>
  | PrimitiveWithFields3D<'COMPOUND', CompoundShapeFields3D>
  | PrimitiveWithFields3D<'CONVEX_HULL', ConvexHullFields3D>
  | PrimitiveWithFields3D<'MESH', MeshFields3D>;

type TriggerConfig3D = Omit<Trigger3DSettings, keyof Primitive3DShapeSettings | EntityLevelKeys>;
type TriggerEntity3D = EntityCommon & Positioned3D & { class: 'Trigger' };
type TriggerShape3D<S extends Primitive3DShapeName> = TriggerEntity3D & {
  /** Which trigger volume shape to construct. Defaults to `"BOX"`. */
  shape: S;
};

/** A `"Trigger"` entity; `shape` defaults to `"BOX"`. */
export type Trigger3DEntityJson =
  | (TriggerShape3D<'PLANE'> & { config?: TriggerConfig3D })
  | (TriggerEntity3D & {
      /** Which trigger volume shape to construct. Defaults to `"BOX"`. */
      shape?: 'BOX';
      config: TriggerConfig3D & BoxFields3D;
    })
  | (TriggerShape3D<'SPHERE'> & { config: TriggerConfig3D & SphereFields3D })
  | (TriggerShape3D<'CONE'> & { config: TriggerConfig3D & ConeFields3D })
  | (TriggerShape3D<'CYLINDER'> & { config: TriggerConfig3D & CylinderFields3D })
  | (TriggerShape3D<'CAPSULE'> & { config: TriggerConfig3D & CapsuleFields3D })
  | (TriggerShape3D<'COMPOUND'> & { config: TriggerConfig3D & CompoundShapeFields3D })
  | (TriggerShape3D<'CONVEX_HULL'> & { config: TriggerConfig3D & ConvexHullFields3D })
  | (TriggerShape3D<'MESH'> & { config: TriggerConfig3D & MeshFields3D });

type CameraConfig3D = Omit<Camera3DSettings, EntityLevelKeys>;
/** A `"Camera"` entity. */
export type Camera3DEntityJson = EntityCommon & Positioned3D & { class: 'Camera'; config?: CameraConfig3D };

type LightConfig3D = Light3dDescriptor & Pick<Light3DSettings, 'target'>;
/** A `"Light"` entity. */
export type Light3DEntityJson = EntityCommon & Positioned3D & { class: 'Light'; config: LightConfig3D };

/** An `"Environment"` entity. */
export type Environment3DEntityJson = EntityCommon & { class: 'Environment'; config?: Environment3DSettings };

type PlayerConfig3D = Omit<Player3DSettings, EntityLevelKeys>;
/** A `"Player"` entity. */
export type Player3DEntityJson = EntityCommon & Positioned3D & { class: 'Player'; config?: PlayerConfig3D };

type GlbConfig3D = Omit<Glb3DSettings, EntityLevelKeys>;
/** A `"Glb"` entity. */
export type Glb3DEntityJson = EntityCommon & Positioned3D & { class: 'Glb'; config: GlbConfig3D };

type GgCarConfig3D = GgCar3DCommonSettings & Pick<GgCar3DSettings, 'chassis' | 'state'> & GgCarWheelLayoutSettings;
/** A `"GgCar"` entity. */
export type GgCar3DEntityJson = EntityCommon & Positioned3D & { class: 'GgCar'; config: GgCarConfig3D };

/** A `"MapGraph"` entity. */
export type MapGraph3DEntityJson = EntityCommon & { class: 'MapGraph'; config: MapGraph3DSettings };

type SoundConfig3D = Omit<Sound3DSettings, EntityLevelKeys>;
/** A `"Sound"` entity. */
export type Sound3DEntityJson = EntityCommon & Positioned3D & { class: 'Sound'; config: SoundConfig3D };

/** One entity of a 3D level, discriminated on `class`. */
export type BuiltIn3DEntityJson =
  | Primitive3DEntityJson
  | Trigger3DEntityJson
  | Camera3DEntityJson
  | Light3DEntityJson
  | Environment3DEntityJson
  | Player3DEntityJson
  | Glb3DEntityJson
  | GgCar3DEntityJson
  | MapGraph3DEntityJson
  | Sound3DEntityJson;

/** A level for a 3D world, as `world.loader.loadLevel` accepts it. */
export type Level3DJson = Omit<LevelJson, 'entities'> & {
  /** Entities in the level */
  entities: BuiltIn3DEntityJson[];
};

// Type-check-time proof that the compositions above match the settings types they stand for.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type ConfigRequired<C> = {} extends C ? false : true;
type WithLevelKeys<C> = C & { position?: Point3; rotation?: Point4; name?: string };
type DescriptorFieldsOf<S extends Primitive3DShapeName> =
  Extract<Shape3DDescriptor, { shape: S }> extends infer D
    ? D extends any
      ? Omit<D, 'shape' | 'collisionMargin'>
      : never
    : never;
type ShapeFieldsMatch = {
  [S in Exclude<Primitive3DShapeName, 'COMPOUND'>]: Same<ShapeFields3D[S], DescriptorFieldsOf<S>>;
};

export type LevelSchema3DChecks = [
  Assert<Same<keyof ShapeFields3D, Primitive3DShapeName>>,
  Assert<Same<Shape3DJson['shape'], Primitive3DShapeName>>,
  Assert<Same<Primitive3DEntityJson['shape'], Primitive3DShapeName>>,
  Assert<Same<Exclude<Trigger3DEntityJson['shape'], undefined>, Primitive3DShapeName>>,
  Assert<Same<ShapeFieldsMatch[keyof ShapeFieldsMatch], true>>,
  Assert<Same<Primitive3DSettings, WithLevelKeys<PrimitiveConfig3D> & Primitive3DShapeSettings>>,
  Assert<
    Same<
      Trigger3DSettings,
      WithLevelKeys<TriggerConfig3D> & Omit<Primitive3DShapeSettings, 'shape'> & { shape?: Primitive3DShapeName }
    >
  >,
  Assert<Same<Camera3DSettings, WithLevelKeys<CameraConfig3D>>>,
  Assert<Same<WithLevelKeys<Light3DSettings>, WithLevelKeys<LightConfig3D>>>,
  Assert<Same<Player3DSettings, WithLevelKeys<PlayerConfig3D>>>,
  Assert<Same<Glb3DSettings, WithLevelKeys<GlbConfig3D>>>,
  Assert<Same<WithLevelKeys<GgCar3DSettings>, WithLevelKeys<GgCarConfig3D>>>,
  Assert<Same<Sound3DSettings, WithLevelKeys<SoundConfig3D>>>,
  // `config` is optional exactly where its settings have no required field.
  Assert<Same<ConfigRequired<PrimitiveConfig3D>, false>>,
  Assert<Same<ConfigRequired<TriggerConfig3D>, false>>,
  Assert<Same<ConfigRequired<CameraConfig3D>, false>>,
  Assert<Same<ConfigRequired<LightConfig3D>, true>>,
  Assert<Same<ConfigRequired<Environment3DSettings>, false>>,
  Assert<Same<ConfigRequired<PlayerConfig3D>, false>>,
  Assert<Same<ConfigRequired<GlbConfig3D>, true>>,
  Assert<Same<ConfigRequired<GgCarConfig3D>, true>>,
  Assert<Same<ConfigRequired<MapGraph3DSettings>, true>>,
  Assert<Same<ConfigRequired<SoundConfig3D>, true>>,
];
