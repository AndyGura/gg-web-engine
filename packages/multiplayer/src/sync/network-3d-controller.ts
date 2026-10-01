import { Gg3dWorld, GgWorld, LevelLoader, Point3, Point4 } from '@gg-web-engine/core';
import { NetworkController, NetworkControllerOptions } from './network-controller';

/**
 * `NetworkController` for a 3D world: positions are `Point3`, rotations quaternions, and the level
 * loader defaults to the world's own `loader` (a `Gg3dLevelLoader` - register the game's entity
 * classes on it).
 */
export class Network3dController extends NetworkController<Point3, Point4> {
  static readonly entityTypeName: string = 'Network3dController';

  constructor(options: NetworkControllerOptions<Point3>) {
    super(options);
  }

  protected createDefaultLevelLoader(world: GgWorld<Point3, Point4>): LevelLoader<any, any, any> {
    // the world's own loader is a level loader - the one the game registers its entity classes on
    return (world as Gg3dWorld).loader;
  }
}
