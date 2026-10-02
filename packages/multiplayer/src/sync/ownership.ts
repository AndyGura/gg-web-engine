import { CollisionEvent, IEntity, Pnt2, Pnt3 } from '@gg-web-engine/core';

/**
 * Context the network layer hands an ownership strategy alongside each decision.
 */
export interface OwnershipContext {
  /** ms since this entity last changed owner (`Infinity` if it never did) */
  msSinceLastTransfer: number;
  /** ms since this entity was last claimed through a contact (`Infinity` if never) */
  msSinceLastContactClaim: number;
}

/** What the network layer adds to a contact for `IOwnershipStrategy.onContact`. */
export interface ContactContext extends OwnershipContext {
  /** |linear velocity| of the local body, from its latest snapshot (i.e. pre-impact) */
  localSpeed: number;
  /** |linear velocity| of the foreign body, from its latest snapshot (i.e. pre-impact) */
  foreignSpeed: number;
  /**
   * Pre-impact closing speed × the lighter body's mass - an adapter-independent stand-in for
   * `event.impulse`, which some adapters report as 0 on a contact's first step. 0 when unknown.
   */
  estimatedImpulse: number;
}

/**
 * Decides who owns a Free (not possessed) entity. Possessed entities are never arbitrated - their
 * possessor owns them until it releases them or is taken over.
 */
export interface IOwnershipStrategy<D> {
  /**
   * Called every arbitration interval by the current owner (and, for an unowned entity, by the
   * peer elected to claim it). Returns the peer that should own `entity` now, or `null` to leave it.
   * @param entity - the entity
   * @param current - current owner ('' when unowned)
   * @param peers - every known peer's reported position (`null` = spectating/dead), the local peer included
   * @param local - the local peer's own position
   * @param ctx - transfer timing of this entity
   */
  proposeOwner(
    entity: IEntity,
    current: string,
    peers: ReadonlyMap<string, D | null>,
    local: D | null,
    ctx?: OwnershipContext,
  ): string | null;

  /**
   * Called on a local collision-start between a locally owned body and a foreign-owned Free body.
   * Returns whether the local peer should claim the foreign body.
   * @param entity - the foreign-owned Free entity that was hit
   * @param event - the collision, as seen from the local body (`otherBody` is the foreign entity's body)
   * @param byPossessed - whether the local body is possessed by the local peer
   * @param ctx - transfer timing of the foreign entity, plus contact details - see {@link ContactContext}
   */
  onContact(entity: IEntity, event: CollisionEvent<D>, byPossessed: boolean, ctx?: ContactContext): boolean;
}

export interface NearestPeerOwnershipOptions {
  /** a challenger takes over only when closer than `ratio` × the owner's distance. Default 0.5. */
  ratio: number;
  /** ...and only while the owner is farther than this from the entity. Default 10. */
  floor: number;
  /** minimum ms between two distance transfers of one entity. Default 1500. */
  cooldownMs: number;
  /**
   * Collision impulse above which a contact claims. Impulse scales differ per physics adapter -
   * start at ~3× what a slow walk into a crate produces with the adapter in use. Default 1.
   */
  contactImpulseThreshold: number;
  /** minimum ms between two contact claims of one entity. Default 5 ticks at 60 Hz (83 ms). */
  contactCooldownMs: number;
}

export const DEFAULT_NEAREST_PEER_OWNERSHIP: Readonly<NearestPeerOwnershipOptions> = Object.freeze({
  ratio: 0.5,
  floor: 10,
  cooldownMs: 1500,
  contactImpulseThreshold: 1,
  contactCooldownMs: 83,
});

/** Squared distance between two `Point2`/`Point3` values. */
export function distanceSq(a: any, b: any): number {
  return typeof a.z === 'number' && typeof b.z === 'number' ? Pnt3.lenSq(Pnt3.sub(a, b)) : Pnt2.lenSq(Pnt2.sub(a, b));
}

/** The entity's position, if it has one. */
export function positionOf<D>(entity: IEntity): D | null {
  const p = (entity as any).position;
  return p && typeof p.x === 'number' ? (p as D) : null;
}

/**
 * The default strategy: an entity belongs near whoever is near it.
 *
 * - **Distance:** transfers only when a challenger is closer than half the owner's distance *and*
 *   the owner is beyond an absolute floor (10 m), with a per-entity cooldown (1.5 s). An owner
 *   reporting a `null` position (spectator) hands over to the nearest peer with a position at once.
 * - **Contact:** a local body that touches a foreign-owned Free body claims it only when it is
 *   possessed (or is a Free body moving faster than the target), the impulse clears a threshold, and
 *   the contact cooldown elapsed - so resting contact never transfers ownership, a car crashing
 *   into a sign does.
 */
export class NearestPeerOwnership<D> implements IOwnershipStrategy<D> {
  public readonly options: NearestPeerOwnershipOptions;

  constructor(options: Partial<NearestPeerOwnershipOptions> = {}) {
    this.options = { ...DEFAULT_NEAREST_PEER_OWNERSHIP, ...options };
  }

  proposeOwner(
    entity: IEntity,
    current: string,
    peers: ReadonlyMap<string, D | null>,
    _local: D | null,
    ctx?: OwnershipContext,
  ): string | null {
    const position = positionOf<D>(entity);
    if (!position) {
      return null;
    }
    let best: string | null = null;
    let bestD = Infinity;
    for (const [peerId, peerPos] of peers) {
      if (!peerPos) {
        continue;
      }
      const d = distanceSq(position, peerPos);
      if (d < bestD || (d === bestD && best !== null && peerId < best)) {
        best = peerId;
        bestD = d;
      }
    }
    if (best === null || best === current) {
      return null;
    }
    const currentPos = current ? peers.get(current) : null;
    if (!currentPos) {
      // unowned, or owned by a peer that can't hold Free entities (no position): nearest takes it
      return best;
    }
    if (ctx && ctx.msSinceLastTransfer < this.options.cooldownMs) {
      return null;
    }
    const currentD = distanceSq(position, currentPos);
    if (currentD <= this.options.floor * this.options.floor) {
      return null;
    }
    return bestD < currentD * this.options.ratio * this.options.ratio ? best : null;
  }

  onContact(_entity: IEntity, event: CollisionEvent<D>, byPossessed: boolean, ctx?: ContactContext): boolean {
    if (Math.max(event.impulse, ctx?.estimatedImpulse ?? 0) < this.options.contactImpulseThreshold) {
      return false;
    }
    if (ctx && ctx.msSinceLastContactClaim < this.options.contactCooldownMs) {
      return false;
    }
    if (byPossessed) {
      return true;
    }
    return !!ctx && ctx.localSpeed > ctx.foreignSpeed;
  }
}

/**
 * The dedicated-server variant: a designated peer always owns every Free entity, and contacts never
 * move ownership. Possession still transfers to players.
 */
export class AlwaysServerOwnership<D> implements IOwnershipStrategy<D> {
  constructor(public readonly serverPeerId: string) {}

  proposeOwner(_entity: IEntity, current: string): string | null {
    return current === this.serverPeerId ? null : this.serverPeerId;
  }

  onContact(): boolean {
    return false;
  }
}

/**
 * The claim acceptance rule every peer applies identically, so ownership converges within one round
 * trip with no coordinator: a claim wins when its epoch is greater than the local one, or equal with
 * a lexically smaller candidate id.
 */
export function claimWins(claimEpoch: number, candidate: string, localEpoch: number, localOwner: string): boolean {
  if (claimEpoch !== localEpoch) {
    return claimEpoch > localEpoch;
  }
  if (!localOwner) {
    return true;
  }
  return candidate < localOwner;
}
