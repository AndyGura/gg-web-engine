import { Gg2dWorld, Gg2dWorldTypeDocRepo } from './gg-2d-world';
import { EntityGenerator, LevelJson } from '../base/level-loader';
import { Gg2dLevelLoader } from './level-loader';
import { Point2 } from '../base';

export class Gg2dLoader<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> {
  /**
   * Level loader for loading levels from JSON
   */
  public readonly levelLoader: Gg2dLevelLoader<TypeDoc>;

  constructor(protected readonly world: Gg2dWorld<TypeDoc>) {
    this.levelLoader = new Gg2dLevelLoader<TypeDoc>(world);
  }

  /**
   * Register a generator function for a level JSON class alias, so `loadLevel`/`loadLevelFromUrl`
   * can dispatch entities of that `class` to it - see `Gg2dLevelLoader`'s built-in classes for
   * examples
   * @param classAlias - The class alias
   * @param generator - The generator function
   */
  public registerClass<Settings, W = any>(
    classAlias: string,
    generator: EntityGenerator<Point2, number, TypeDoc, Settings, W>,
  ): void {
    this.levelLoader.registerClass(classAlias, generator);
  }

  /**
   * Load a level from an already-parsed JSON document
   * @param levelJson - The level JSON
   */
  public loadLevel(levelJson: LevelJson): void {
    this.levelLoader.loadLevel(levelJson);
  }

  /**
   * Fetch a level JSON document hosted at `url` and load it
   * @param url - URL (or path) of the level JSON document
   */
  public loadLevelFromUrl(url: string): Promise<void> {
    return this.levelLoader.loadLevelFromUrl(url);
  }

  /**
   * Look up a previously-loaded, named entity/object by the `name` its `EntityJson` was given
   * @param name - The entity's `name` in the level JSON
   * @returns The entity/object its generator returned
   * @throws if no loaded entity has that name
   */
  public getEntityByName<T = any>(name: string): T {
    return this.levelLoader.getEntityByName<T>(name);
  }
}
