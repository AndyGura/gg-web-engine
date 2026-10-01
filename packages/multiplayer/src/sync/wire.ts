import { EntityJson } from '@gg-web-engine/core';

/**
 * One entity's slice of a `state` message.
 */
export interface StateItem {
  /** entity name - names are the ids on the wire */
  id: string;
  /** current owner; lets every peer compute event authority locally */
  owner: string;
  /** ownership generation; an older epoch is dropped */
  epoch: number;
  /** per-sender monotonic sequence; an older seq is dropped */
  seq: number;
  /** owner clock, ms */
  ts: number;
  /** the entity's `INetworkSyncable` payload */
  s: unknown;
  /** the entity's `INetworkInputDriven` payload, present only while possessed */
  i?: unknown;
  /** possessor, present only while possessed */
  pp?: string;
}

/**
 * Everything a peer without a local copy needs to reproduce one entity: in a join dump, a state
 * reply, or a takeover resync.
 */
export interface SpawnItem {
  entityId: string;
  /** level-JSON descriptor; present for runtime spawns only (shared content is built locally) */
  descriptor?: EntityJson;
  owner: string;
  epoch: number;
  possessor: string | null;
  /** owner clock, ms, when `full` was captured */
  ts: number;
  /** `captureFullNetworkState()` */
  full: unknown;
  /** owner clock, ms, after which the entity despawns */
  expiresAt?: number;
}

export type WireMessage =
  | { t: 'state'; items: StateItem[] }
  | { t: 'claim'; entityId: string; epoch: number; candidate: string }
  | { t: 'possess'; entityId: string; epoch: number; peerId: string }
  | { t: 'release'; entityId: string; epoch: number }
  | {
      t: 'spawn';
      entityId: string;
      descriptor: EntityJson;
      owner: string;
      epoch: number;
      possessor: string | null;
      ts: number;
      expiresAt?: number;
      full: unknown;
    }
  | { t: 'despawn'; entityId: string; epoch: number }
  | { t: 'joinRequest' }
  | {
      t: 'joinDump';
      /** shared level sources this peer has loaded */
      sharedLevels: string[];
      entities: SpawnItem[];
      /** shared entities removed for good (`despawn`), so a joiner removes them after loading */
      despawned: string[];
      /** ms this peer has been in the room - the joiner takes `app` from the most senior peer */
      since: number;
      app?: unknown;
    }
  | { t: 'stateRequest'; ids: string[] }
  | { t: 'stateReply'; entities: SpawnItem[] }
  | { t: 'relinquish'; ids: string[] }
  | {
      t: 'takeover';
      /** the peer that went away */
      peerId: string;
      entityIds: string[];
      epochs: number[];
    }
  | { t: 'app'; data: unknown }
  | { t: 'ping'; t0: number }
  | { t: 'pong'; t0: number; t1: number; t2: number }
  | { t: 'heartbeat'; pos: unknown | null; away?: boolean }
  | { t: 'chunk'; id: string; idx: number; count: number; data: string };

export type WireChannel = 'reliable' | 'unreliable';

/** The channel each message kind travels on: everything but the state stream (and its pings) is reliable. */
export function channelOf(msg: WireMessage): WireChannel {
  return msg.t === 'state' ? 'unreliable' : 'reliable';
}
