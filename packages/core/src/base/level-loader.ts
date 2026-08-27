import { GgWorld, GgWorldTypeDocRepo } from './gg-world';
import { GroupEntity } from './entities/group.entity';
import { IEntity } from './entities/i-entity';

/**
 * Entities a generator has opted out of the level's lifecycle via {@link standaloneEntity} - see
 * that function's docs. A plain module-level `WeakSet` (not per-`LevelLoader`-instance state):
 * "standalone" is a property of the entity value itself, and entries vanish on their own once the
 * entity is garbage-collected.
 */
const standaloneEntities = new WeakSet<IEntity>();

/**
 * Mark an entity a generator is about to return as standalone: `LevelLoader.loadLevel` will still
 * add it to the world (if it isn't already) and still set its `.name` if the level JSON gave it
 * one, but will **not** parent it under the level's group entity - so it survives
 * `world.removeEntity(level, true)` untouched. Use this for something an app is expected to own
 * independently of any one level, e.g. a shared camera loaded once but still around after the
 * level that declared it gets swapped out - see the built-in `"Camera"` 3D class for the reference
 * case:
 * ```typescript
 * const entity = new Camera3dEntity(camera);
 * return standaloneEntity(entity);
 * ```
 * Don't reach for this by default - most level content (primitives, triggers, custom entities)
 * should be torn down with the level, which is what happens without calling this at all.
 * @param entity - The entity to mark
 * @returns `entity`, unchanged, for chaining into a `return`
 */
export function standaloneEntity<T extends IEntity>(entity: T): T {
  standaloneEntities.add(entity);
  return entity;
}

/**
 * A function that turns per-entity JSON settings into a spawned entity (or other world object,
 * e.g. a trigger or camera). Registered against a class alias via {@link LevelLoader.registerClass}.
 * May be `async`/return a `Promise` (e.g. the built-in `"Glb"` 3D class, which fetches a model) -
 * {@link LevelLoader.loadLevel} awaits every generator before moving to the next entity.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 * @template Settings - The settings object type
 * @template W - The world type
 */
export type EntityGenerator<
  D,
  R,
  TypeDoc extends GgWorldTypeDocRepo<D, R>,
  Settings = any,
  W = GgWorld<D, R, TypeDoc>,
> = (world: W, settings: Settings) => any;

/**
 * A level/scene, serializable as a single JSON document (e.g. to be hosted as a static file and
 * loaded via {@link LevelLoader.loadLevelFromUrl}).
 */
export interface LevelJson {
  /**
   * Entities in the level
   */
  entities: EntityJson[];
}

/**
 * JSON description of a single entity in a level. `position`/`rotation` are left untyped here
 * since their shape depends on the dimensionality (`Point2`/`number` for 2D, `Point3`/`Point4`
 * for 3D) of whichever `LevelLoader` subclass parses this JSON.
 */
export interface EntityJson {
  /**
   * Class alias for the entity, matching a class registered via `registerClass`. Built-in
   * primitive shapes (box/sphere/square/circle/...) all share the single `"Primitive"` alias and
   * are distinguished by `shape` instead of by a per-shape class - e.g. `{ class: "Primitive",
   * shape: "BOX" }` rather than `{ class: "BOX" }`. Apps register their own aliases (e.g.
   * `"ShapeSpawner"`) the same way the dimensionality-specific `LevelLoader` subclasses register
   * their built-ins, via `registerClass`.
   */
  class: string;

  /**
   * Shape identifier for the built-in `"Primitive"` entity class (e.g. `"Box"`, `"Circle"`) - see
   * the dimensionality-specific `LevelLoader` subclass (`Gg2dLevelLoader`/`Gg3dLevelLoader`) for
   * the supported values. Ignored for any other `class`.
   */
  shape?: string;

  /**
   * Position of the entity
   */
  position?: any;

  /**
   * Rotation of the entity
   */
  rotation?: any;

  /**
   * Name of the entity. If the generator's result is an `IEntity`, `loadLevel` sets its `.name` to
   * this (overriding whatever default the generator gave it), so it can be found afterwards with
   * `GgWorld.getEntityByName`/`IEntity.getChildEntityByName`. Ignored for generators that return
   * something other than an `IEntity` - there's nowhere to look such a result back up by name.
   */
  name?: string;

  /**
   * Configuration for the entity, passed to its generator alongside position/rotation/name
   */
  config?: any;
}

/**
 * Base class for level loaders: parses a {@link LevelJson} document into world entities by
 * dispatching each `EntityJson.class` to a generator function registered with {@link registerClass}.
 *
 * Every `IEntity` a generator produces is parented under one {@link GroupEntity} per `loadLevel`/
 * `loadLevelFromUrl` call (added to the world immediately, and handed back once loading
 * completes) - so a whole level can be torn down in one shot with `world.removeEntity(level, true)`,
 * which cascades removal/disposal to every child, and any named entity can be found afterwards
 * with `level.getChildEntityByName(name)`. The one exception is an entity a generator marks with
 * {@link standaloneEntity} (the built-in `"Camera"` 3D class does this): it's still added to the
 * world, but deliberately left unparented, so it survives level removal - look such an entity up
 * with `GgWorld.getEntityByName` instead, since it was never made a child of `level`. Generators
 * that return something other than an `IEntity` aren't tracked anywhere by `loadLevel` at all -
 * there's nothing to parent or look up by name.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
export abstract class LevelLoader<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> {
  /**
   * Map of class aliases to generator functions
   */
  protected generators: Map<string, EntityGenerator<D, R, TypeDoc, any, any>> = new Map();

  /**
   * Constructor
   * @param world - The world instance
   */
  constructor(protected readonly world: GgWorld<D, R, TypeDoc>) {}

  /**
   * Register a generator function for a class alias
   * @param classAlias - The class alias
   * @param generator - The generator function
   */
  public registerClass<Settings, W = any>(
    classAlias: string,
    generator: EntityGenerator<D, R, TypeDoc, Settings, W>,
  ): void {
    this.generators.set(classAlias, generator);
  }

  /**
   * Load a level from an already-parsed JSON document. Every `IEntity` the level's entities
   * produce is parented under - and, on failure, torn down along with - the returned
   * {@link GroupEntity}, already added to the world (see the class docs above for the one
   * exception: an entity a generator marked with {@link standaloneEntity}).
   * @param levelJson - The level JSON
   * @param levelName - Optional name for the returned group entity (e.g. so a debugger/console
   * listing entities by name shows something more meaningful than the default auto-generated one)
   * @returns The level's root group entity
   */
  public async loadLevel(levelJson: LevelJson, levelName?: string): Promise<GroupEntity<D, R, TypeDoc>> {
    const level = new GroupEntity<D, R, TypeDoc>();
    if (levelName !== undefined) {
      level.name = levelName;
    }
    this.world.addEntity(level);

    try {
      for (const entityJson of levelJson.entities) {
        const { class: classAlias, shape, position, rotation, name, config } = entityJson;
        const generator = this.generators.get(classAlias);
        if (!generator) {
          console.warn(`No generator registered for class alias "${classAlias}"`);
          continue;
        }

        const settings = {
          ...(config ?? {}),
          ...(shape !== undefined ? { shape } : {}),
          ...(position !== undefined ? { position } : {}),
          ...(rotation !== undefined ? { rotation } : {}),
          ...(name !== undefined ? { name } : {}),
        };

        const entity = await generator(this.world, settings);
        if (!entity || !(entity instanceof IEntity)) {
          continue;
        }
        if (name !== undefined) {
          entity.name = name;
        }
        if (standaloneEntities.has(entity)) {
          // Opted out via standaloneEntity() - still make sure it's in the world, but don't parent
          // it under the level (addChildren, safe to call even if it's already spawned elsewhere).
          if (!entity.world) {
            this.world.addEntity(entity);
          }
        } else {
          level.addChildren(entity);
        }
      }
    } catch (e) {
      // Don't leave a partially-loaded level (and its already-spawned entities) behind if a
      // generator throws partway through - the caller never gets `level` back to clean it up itself.
      this.world.removeEntity(level, true);
      throw e;
    }

    return level;
  }

  /**
   * Fetch a level JSON document hosted at `url` and load it, so a whole level/scene can be
   * shipped and consumed as a single static JSON file.
   * @param url - URL (or path) of the level JSON document
   * @param levelName - Optional name for the returned group entity, see {@link loadLevel}
   * @returns The level's root group entity
   */
  public async loadLevelFromUrl(url: string, levelName?: string): Promise<GroupEntity<D, R, TypeDoc>> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load level JSON from "${url}": ${response.status} ${response.statusText}`);
    }
    const levelJson: LevelJson = await response.json();
    return this.loadLevel(levelJson, levelName);
  }
}
