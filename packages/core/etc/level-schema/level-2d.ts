/*
 * Input of `etc/generate_level_schema.mjs` (repo root) for `schema/level-2d.schema.json`. Composes
 * the 2D level loader's exported settings types into a `LevelJson` whose `entities` items are a
 * union discriminated on `class`, one member per built-in class alias, with `shape` selecting the
 * fields a `"Primitive"`/`"Trigger"` needs. Every field, description and default comes from the
 * composed types. The generator does not evaluate conditional types or `Omit` over a union, so
 * the compositions avoid both and spell unions out member by member; the `Same<>` assertions at
 * the end make the type check (which the generator runs first) fail when a composition stops
 * matching the settings type it stands for.
 */
import { EntityJson, LevelJson } from '../../src/base/level-loader';
import { Point2 } from '../../src/base/models/points';
import { Shape2DDescriptor } from '../../src/2d/models/shapes';
import {
  CompoundChild2DSettings,
  Environment2DSettings,
  ParallaxLayer2DSettings,
  Player2DSettings,
  Primitive2DShapeName,
  Primitive2DShapeSettings,
  PrimitiveSettings,
  Sound2DSettings,
  TriggerSettings,
} from '../../src/2d/level-loader';

/** Fields `loadLevel` reads off the entity itself rather than out of `config`. */
type EntityLevelKeys = 'shape' | 'position' | 'rotation' | 'name';

/** One shape's fields: descriptions from `Primitive2DShapeSettings`, required-ness from `Shape2DDescriptor`. */
type DescriptorFields2D<S extends Primitive2DShapeName, K extends keyof Primitive2DShapeSettings> = Pick<
  Primitive2DShapeSettings,
  K
> &
  Omit<Extract<Shape2DDescriptor, { shape: S }>, 'shape' | 'collisionMargin'>;

/** The fields a `COMPOUND` shape needs (an interface, so the recursion through `children` resolves lazily). */
export interface CompoundShapeFields2D {
  /**
   * Child shapes making up a Compound primitive, each with its own local `position`/`rotation`
   * offset. A child's `shape` may itself be `"COMPOUND"`, nesting arbitrarily deep.
   */
  children: CompoundChild2DJson[];
}

/**
 * The fields each shape needs, one named type per shape. The unions below reference these names
 * rather than `ShapeFields2D['BOX']`: the generator misreads that indexed access once the
 * recursion through `children` is involved. `ShapeFields2D` exists for the checks at the end.
 */
type BoxFields2D = DescriptorFields2D<'BOX', 'dimensions'>;
type CircleFields2D = DescriptorFields2D<'CIRCLE', 'radius'>;
type CapsuleFields2D = DescriptorFields2D<'CAPSULE', 'radius' | 'centersDistance'>;
type ConvexHullFields2D = DescriptorFields2D<'CONVEX_HULL', 'vertices'>;
type PolygonFields2D = DescriptorFields2D<'POLYGON', 'vertices'>;

/** Per shape, exactly the fields `buildShapeDescriptor` needs. */
interface ShapeFields2D {
  BOX: BoxFields2D;
  CIRCLE: CircleFields2D;
  CAPSULE: CapsuleFields2D;
  CONVEX_HULL: ConvexHullFields2D;
  POLYGON: PolygonFields2D;
  COMPOUND: CompoundShapeFields2D;
}

/** One shape with exactly the fields it needs. */
export type Shape2DJson =
  | ({ shape: 'BOX' } & BoxFields2D)
  | ({ shape: 'CIRCLE' } & CircleFields2D)
  | ({ shape: 'CAPSULE' } & CapsuleFields2D)
  | ({ shape: 'CONVEX_HULL' } & ConvexHullFields2D)
  | ({ shape: 'POLYGON' } & PolygonFields2D)
  | ({ shape: 'COMPOUND' } & CompoundShapeFields2D);

/** One child of a `COMPOUND` shape. */
export type CompoundChild2DJson = Pick<CompoundChild2DSettings, 'position' | 'rotation'> & Shape2DJson;

/** Fields every entity has, whatever its class. */
type EntityCommon = Pick<EntityJson, 'name' | 'events'>;

type Positioned2D = {
  /** Position of the entity */
  position?: Point2;
  /** Rotation of the entity in radians */
  rotation?: number;
};

type PrimitiveConfig2D = Omit<PrimitiveSettings, keyof Primitive2DShapeSettings | EntityLevelKeys>;
type PrimitiveEntity2D<S extends Primitive2DShapeName> = EntityCommon &
  Positioned2D & {
    class: 'Primitive';
    /** Which primitive shape to construct */
    shape: S;
  };
type PrimitiveWithFields2D<S extends Primitive2DShapeName, Fields> = PrimitiveEntity2D<S> & {
  config: PrimitiveConfig2D & Fields;
};

/** A `"Primitive"` entity; `shape` picks which fields `config` needs. */
export type Primitive2DEntityJson =
  | PrimitiveWithFields2D<'BOX', BoxFields2D>
  | PrimitiveWithFields2D<'CIRCLE', CircleFields2D>
  | PrimitiveWithFields2D<'CAPSULE', CapsuleFields2D>
  | PrimitiveWithFields2D<'CONVEX_HULL', ConvexHullFields2D>
  | PrimitiveWithFields2D<'POLYGON', PolygonFields2D>
  | PrimitiveWithFields2D<'COMPOUND', CompoundShapeFields2D>;

type TriggerConfig2D = Omit<TriggerSettings, keyof Primitive2DShapeSettings | EntityLevelKeys>;
type TriggerEntity2D = EntityCommon & Positioned2D & { class: 'Trigger' };
type TriggerShape2D<S extends Primitive2DShapeName> = TriggerEntity2D & {
  /** Which trigger volume shape to construct. Defaults to `"BOX"`. */
  shape: S;
};

/** A `"Trigger"` entity; `shape` defaults to `"BOX"`. */
export type Trigger2DEntityJson =
  | (TriggerEntity2D & {
      /** Which trigger volume shape to construct. Defaults to `"BOX"`. */
      shape?: 'BOX';
      config: TriggerConfig2D & BoxFields2D;
    })
  | (TriggerShape2D<'CIRCLE'> & { config: TriggerConfig2D & CircleFields2D })
  | (TriggerShape2D<'CAPSULE'> & { config: TriggerConfig2D & CapsuleFields2D })
  | (TriggerShape2D<'CONVEX_HULL'> & { config: TriggerConfig2D & ConvexHullFields2D })
  | (TriggerShape2D<'POLYGON'> & { config: TriggerConfig2D & PolygonFields2D })
  | (TriggerShape2D<'COMPOUND'> & { config: TriggerConfig2D & CompoundShapeFields2D });

/** A `"ParallaxLayer"` entity. */
export type ParallaxLayer2DEntityJson = EntityCommon & { class: 'ParallaxLayer'; config: ParallaxLayer2DSettings };

/** An `"Environment"` entity. */
export type Environment2DEntityJson = EntityCommon & { class: 'Environment'; config?: Environment2DSettings };

type PlayerConfig2D = Omit<Player2DSettings, EntityLevelKeys>;
/** A `"Player"` entity. */
export type Player2DEntityJson = EntityCommon & Positioned2D & { class: 'Player'; config?: PlayerConfig2D };

type SoundConfig2D = Omit<Sound2DSettings, EntityLevelKeys>;
/** A `"Sound"` entity. */
export type Sound2DEntityJson = EntityCommon & Positioned2D & { class: 'Sound'; config: SoundConfig2D };

/** One entity of a 2D level, discriminated on `class`. */
export type BuiltIn2DEntityJson =
  | Primitive2DEntityJson
  | Trigger2DEntityJson
  | ParallaxLayer2DEntityJson
  | Environment2DEntityJson
  | Player2DEntityJson
  | Sound2DEntityJson;

/** A level for a 2D world, as `world.loader.loadLevel` accepts it. */
export type Level2DJson = Omit<LevelJson, 'entities'> & {
  /** Entities in the level */
  entities: BuiltIn2DEntityJson[];
};

// Type-check-time proof that the compositions above match the settings types they stand for.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type ConfigRequired<C> = {} extends C ? false : true;
type WithLevelKeys<C> = C & { position?: Point2; rotation?: number; name?: string };
type DescriptorFieldsOf<S extends Primitive2DShapeName> =
  Extract<Shape2DDescriptor, { shape: S }> extends infer D
    ? D extends any
      ? Omit<D, 'shape' | 'collisionMargin'>
      : never
    : never;
type ShapeFieldsMatch = {
  [S in Exclude<Primitive2DShapeName, 'COMPOUND'>]: Same<ShapeFields2D[S], DescriptorFieldsOf<S>>;
};

export type LevelSchema2DChecks = [
  Assert<Same<keyof ShapeFields2D, Primitive2DShapeName>>,
  Assert<Same<Shape2DJson['shape'], Primitive2DShapeName>>,
  Assert<Same<Primitive2DEntityJson['shape'], Primitive2DShapeName>>,
  Assert<Same<Exclude<Trigger2DEntityJson['shape'], undefined>, Primitive2DShapeName>>,
  Assert<Same<ShapeFieldsMatch[keyof ShapeFieldsMatch], true>>,
  Assert<Same<PrimitiveSettings, WithLevelKeys<PrimitiveConfig2D> & Primitive2DShapeSettings>>,
  Assert<
    Same<
      TriggerSettings,
      WithLevelKeys<TriggerConfig2D> & Omit<Primitive2DShapeSettings, 'shape'> & { shape?: Primitive2DShapeName }
    >
  >,
  Assert<Same<Player2DSettings, WithLevelKeys<PlayerConfig2D>>>,
  Assert<Same<Sound2DSettings, WithLevelKeys<SoundConfig2D>>>,
  // `config` is optional exactly where its settings have no required field.
  Assert<Same<ConfigRequired<ParallaxLayer2DSettings>, true>>,
  Assert<Same<ConfigRequired<Environment2DSettings>, false>>,
  Assert<Same<ConfigRequired<PlayerConfig2D>, false>>,
  Assert<Same<ConfigRequired<SoundConfig2D>, true>>,
];
