import { Gg2dWorld, GgWorld, LevelLoader, Point2 } from '@gg-web-engine/core';
import { NetworkController, NetworkControllerOptions } from './network-controller';

/**
 * `NetworkController` for a 2D world: positions are `Point2`, rotations angles (meters and m/s, as
 * in 3D), and the level loader defaults to the world's own `loader` (a `Gg2dLevelLoader` - register
 * the game's entity classes on it).
 *
 * @example
 * ```ts
 * import { Pnt2 } from '@gg-web-engine/core';
 * import { FirebaseSignaling, getRoomIdFromUrl, Network2dController, WebRtcMeshTransport } from '@gg-web-engine/multiplayer';
 *
 * const signaling = new FirebaseSignaling(); // the package's default Firebase project, or { config } for your own
 * const roomId = getRoomIdFromUrl() ?? (await signaling.createRoom());
 *
 * const net = new Network2dController({ transport: new WebRtcMeshTransport({ signaling, roomId }) });
 * world.addEntity(net);
 * await net.connect();
 *
 * // a capsule character; screen Y points down, so "up" is -Y
 * const character = await world.loader.createEntity({
 *   class: 'Player',
 *   position: { x: 0, y: -1 },
 *   config: { radius: 0.4, centersDistance: 1, up: Pnt2.nY, walkSpeed: 4, jumpSpeed: 6 },
 * });
 * world.addEntity(character!);
 * net.possess(character!);
 * ```
 */
export class Network2dController extends NetworkController<Point2, number> {
  static readonly entityTypeName: string = 'Network2dController';

  constructor(options: NetworkControllerOptions<Point2>) {
    super(options);
  }

  protected createDefaultLevelLoader(world: GgWorld<Point2, number>): LevelLoader<any, any, any> {
    // the world's own loader is a level loader - the one the game registers its entity classes on
    return (world as Gg2dWorld).loader;
  }
}
