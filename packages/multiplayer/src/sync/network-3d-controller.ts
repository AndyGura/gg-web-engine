import { Gg3dWorld, GgWorld, LevelLoader, NetworkFrame, Point3, Point4 } from '@gg-web-engine/core';
import { NetworkController, NetworkControllerOptions } from './network-controller';

/**
 * `NetworkController` for a 3D world: positions are `Point3`, rotations quaternions, and the level
 * loader defaults to the world's own `loader` (a `Gg3dLevelLoader` - register the game's entity
 * classes on it).
 *
 * Everything on the wire is in global coordinates: two peers whose worlds have different
 * `Gg3dWorld.frame`s (sections of one open world, each simulated near its own origin) share
 * entities at the same global pose. The built-in entities convert their own network state through
 * their world's frame; this controller converts what it sends itself - heartbeat positions (and so
 * zoning cells) and the `position`/`rotation` of spawn descriptors. Received state stays global in
 * its buffers and is converted only when applied, through the frame as it is at that moment. With
 * the default identity frame, global is local.
 *
 * @example
 * ```ts
 * import { BroadcastChannelSignaling, getRoomIdFromUrl, Network3dController, WebRtcMeshTransport } from '@gg-web-engine/multiplayer';
 *
 * // BroadcastChannelSignaling connects tabs of one browser with no backend; use FirebaseSignaling across machines
 * const signaling = new BroadcastChannelSignaling();
 * const roomId = getRoomIdFromUrl() ?? (await signaling.createRoom());
 *
 * const net = new Network3dController({ transport: new WebRtcMeshTransport({ signaling, roomId }) });
 * world.addEntity(net);
 * await net.loadSharedLevel(levelJson, 'level'); // every peer builds the same level, named alike
 * await net.connect();
 *
 * const player = await world.loader.createEntity({ class: 'Player', position: { x: 0, y: 0, z: 2 } });
 * world.addEntity(player!); // a runtime spawn: replicated to every peer
 * net.possess(player!); // the local peer owns it and its input is broadcast
 * ```
 */
export class Network3dController extends NetworkController<Point3, Point4> {
  static readonly entityTypeName: string = 'Network3dController';

  constructor(options: NetworkControllerOptions<Point3>) {
    super(options);
  }

  protected worldFrame(): NetworkFrame<Point3, Point4> | null {
    const frame = (this.world as Gg3dWorld | null)?.frame;
    return frame && !frame.isIdentity ? frame : null;
  }

  protected createDefaultLevelLoader(world: GgWorld<Point3, Point4>): LevelLoader<any, any, any> {
    // the world's own loader is a level loader - the one the game registers its entity classes on
    return (world as Gg3dWorld).loader;
  }
}
