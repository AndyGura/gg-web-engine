import { Gg2dWorld, Gg2dWorldTypeDocRepo } from './gg-2d-world';
import { LevelJson } from '../base/level-loader';
import { Gg2dLevelLoader } from './level-loader';

export class Gg2dLoader<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> {
  /**
   * Level loader for loading levels from JSON
   */
  public readonly levelLoader: Gg2dLevelLoader<TypeDoc>;

  constructor(protected readonly world: Gg2dWorld<TypeDoc>) {
    this.levelLoader = new Gg2dLevelLoader<TypeDoc>(world);
  }

  /**
   * Load a level from an already-parsed JSON document
   * @param levelJson - The level JSON
   * @returns The created entities
   */
  public loadLevel(levelJson: LevelJson): any[] {
    return this.levelLoader.loadLevel(levelJson);
  }

  /**
   * Fetch a level JSON document hosted at `url` and load it
   * @param url - URL (or path) of the level JSON document
   * @returns The created entities
   */
  public loadLevelFromUrl(url: string): Promise<any[]> {
    return this.levelLoader.loadLevelFromUrl(url);
  }
}
