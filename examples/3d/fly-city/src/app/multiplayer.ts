import { IEntity, Point3 } from '@gg-web-engine/core';
import {
  BroadcastChannelSignaling,
  buildRoomUrl,
  DEFAULT_FIREBASE_CONFIG,
  FirebaseSignaling,
  generateRoomId,
  getRoomIdFromUrl,
  ISignalingChannel,
  Network3dController,
  WebRtcMeshTransport,
} from '@gg-web-engine/multiplayer';
import { FirebaseOptions } from 'firebase/app';
import { FlyCityWorld } from './app.component';
import { selectedPhysicsBackend } from './backends';

/**
 * Firebase web config used for room signaling. Leave `null` to use the package's default project -
 * and when that isn't configured either, rooms fall back to `BroadcastChannel` signaling, which
 * connects tabs of this one browser only (open the room link in a second tab to try it).
 */
const FIREBASE_CONFIG: FirebaseOptions | null = null;

/**
 * The city's tiles are 75 m squares - zoning uses them as cells: peers connect within two tiles of
 * each other and exchange state within one. Zoning is opt-in (meant for maps much larger than what
 * one player sees); set this to `null` for a plain full mesh, where everybody sees everybody.
 */
const ZONING: { cellSize: number } | null = { cellSize: 75 };

/**
 * Everything multiplayer-specific in this example: the room (from the page URL's `?room=`), the
 * signaling choice, and the network controller. Game code reaches it through `GameFactory`/
 * `GameRunner`, which run unchanged in single-player mode when there's no room.
 */
export class Multiplayer {
  public readonly net: Network3dController;
  public readonly signalingKind: 'Firebase' | 'local tabs';
  /** the camera, so a free-flying spectator still connects to the peers it is looking at */
  public camera: { position: Point3 } | null = null;

  /** The room id in the page URL, or `null` for single-player. */
  static roomIdFromUrl(): string | null {
    return getRoomIdFromUrl();
  }

  /** Reload the page into a fresh room. */
  static createRoom(): void {
    location.assign(Multiplayer.urlFor(generateRoomId()));
  }

  /**
   * The page URL for a room. It names the physics engine too: every peer in a room has to simulate
   * with the same one, so a link opened elsewhere must not fall back to another default.
   */
  private static urlFor(roomId: string): string {
    const url = new URL(buildRoomUrl(roomId));
    url.searchParams.set('physics', selectedPhysicsBackend());
    return url.toString();
  }

  constructor(
    public readonly world: FlyCityWorld,
    public readonly roomId: string,
  ) {
    const config = FIREBASE_CONFIG ?? DEFAULT_FIREBASE_CONFIG;
    let signaling: ISignalingChannel;
    if (config) {
      signaling = new FirebaseSignaling({ config });
      this.signalingKind = 'Firebase';
    } else {
      signaling = new BroadcastChannelSignaling();
      this.signalingKind = 'local tabs';
    }
    this.net = new Network3dController({
      transport: new WebRtcMeshTransport({
        signaling,
        roomId,
        zoning: ZONING,
        zonePosition: () => this.camera?.position ?? null,
      }),
    });
  }

  get roomUrl(): string {
    return Multiplayer.urlFor(this.roomId);
  }

  /**
   * A PRNG for one city tile, seeded from the room id and the tile position: every peer streams
   * tiles independently, so a tile's parked cars must come out identical everywhere - a pure
   * function of (room, tile), never `Math.random()`.
   */
  tileRandom(tileX: number, tileY: number): () => number {
    let h = 2166136261;
    for (const ch of `${this.roomId}:${tileX}:${tileY}`) {
      h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    }
    let a = h >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** whether another peer drives/controls `entity` right now */
  isPossessedByOther(entity: IEntity): boolean {
    const possessor = this.net.possessorOf(entity);
    return !!possessor && possessor !== this.net.localPeerId;
  }
}
