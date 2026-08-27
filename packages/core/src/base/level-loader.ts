import { GgWorld, GgWorldTypeDocRepo } from './gg-world';

/**
 * A function that turns per-entity JSON settings into a spawned entity (or other world object,
 * e.g. a trigger or camera). Registered against a class alias via {@link LevelLoader.registerClass}.
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
   * Name of the entity. If set, the loaded entity can be looked back up afterwards via
   * {@link LevelLoader.getEntityByName}.
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
 * Loading doesn't hand back the created entities directly - named ones are looked up afterwards
 * via {@link getEntityByName}, so callers don't have to positionally destructure the level's
 * `entities` array.
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
   * Map of entity name to the entity/object its generator returned, for every loaded entity whose
   * JSON had a `name`. Populated by `loadLevel`/`loadLevelFromUrl`, read by `getEntityByName`.
   */
  protected entitiesByName: Map<string, any> = new Map();

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
   * Look up a previously-loaded, named entity/object by the `name` its `EntityJson` was given.
   * @param name - The entity's `name` in the level JSON
   * @returns The entity/object its generator returned
   * @throws if no loaded entity has that name
   */
  public getEntityByName<T = any>(name: string): T {
    if (!this.entitiesByName.has(name)) {
      throw new Error(`No loaded entity named "${name}"`);
    }
    return this.entitiesByName.get(name) as T;
  }

  /**
   * Load a level from an already-parsed JSON document
   * @param levelJson - The level JSON
   */
  public loadLevel(levelJson: LevelJson): void {
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

      const entity = generator(this.world, settings);
      if (entity && name !== undefined) {
        this.entitiesByName.set(name, entity);
      }
    }
  }

  /**
   * Fetch a level JSON document hosted at `url` and load it, so a whole level/scene can be
   * shipped and consumed as a single static JSON file.
   * @param url - URL (or path) of the level JSON document
   */
  public async loadLevelFromUrl(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load level JSON from "${url}": ${response.status} ${response.statusText}`);
    }
    const levelJson: LevelJson = await response.json();
    this.loadLevel(levelJson);
  }
}
