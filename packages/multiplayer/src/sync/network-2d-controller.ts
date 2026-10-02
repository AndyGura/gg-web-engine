import { Gg2dWorld, GgWorld, LevelLoader, Point2 } from '@gg-web-engine/core';
import { NetworkController, NetworkControllerOptions } from './network-controller';

/**
 * `NetworkController` for a 2D world: positions are `Point2`, rotations angles, `unitScale` defaults
 * to 100 (2D physics adapters work in pixels, 100 per meter), and the level loader defaults to the
 * world's own `loader` (a `Gg2dLevelLoader` - register the game's entity classes on it).
 */
export class Network2dController extends NetworkController<Point2, number> {
  static readonly entityTypeName: string = 'Network2dController';

  constructor(options: NetworkControllerOptions<Point2>) {
    super({ unitScale: 100, ...options });
  }

  protected createDefaultLevelLoader(world: GgWorld<Point2, number>): LevelLoader<any, any, any> {
    // the world's own loader is a level loader - the one the game registers its entity classes on
    return (world as Gg2dWorld).loader;
  }
}
