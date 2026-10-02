import { WireMessage } from './wire';

/** Messages above this many UTF-16 code units are split - browsers disagree above ~64 KB per data-channel message. */
export const DEFAULT_CHUNK_SIZE = 16 * 1024;

let chunkCounter = 0;

/**
 * Split a serialized message into `chunk` frames when it exceeds `chunkSize`, for a reliable,
 * ordered channel with a per-message size limit. Returns the serialized frames to send, in order.
 */
export function frameMessage(msg: WireMessage, chunkSize: number = DEFAULT_CHUNK_SIZE): string[] {
  const serialized = JSON.stringify(msg);
  if (serialized.length <= chunkSize) {
    return [serialized];
  }
  const id = `${Date.now().toString(36)}-${(chunkCounter++).toString(36)}`;
  const count = Math.ceil(serialized.length / chunkSize);
  const frames: string[] = [];
  for (let idx = 0; idx < count; idx++) {
    const chunk: WireMessage = {
      t: 'chunk',
      id,
      idx,
      count,
      data: serialized.slice(idx * chunkSize, (idx + 1) * chunkSize),
    };
    frames.push(JSON.stringify(chunk));
  }
  return frames;
}

/**
 * Reassembles `chunk` frames back into the original messages; one instance per remote peer. Frames
 * of different messages may interleave, and frames of one message may arrive in any order; an
 * incomplete message is discarded after `staleAfterMs`.
 */
export class ChunkAssembler {
  private readonly partial = new Map<string, { parts: string[]; received: number; startedAt: number }>();

  constructor(private readonly staleAfterMs: number = 30_000) {}

  /**
   * Feed one received frame. Returns the complete message - the frame itself if it wasn't a chunk,
   * the reassembled message once its last chunk arrives - or `null` while a chunked message is
   * still incomplete.
   */
  accept(frame: WireMessage, now: number = Date.now()): WireMessage | null {
    if (frame.t !== 'chunk') {
      return frame;
    }
    let entry = this.partial.get(frame.id);
    if (!entry) {
      entry = { parts: new Array(frame.count), received: 0, startedAt: now };
      this.partial.set(frame.id, entry);
    }
    if (entry.parts[frame.idx] === undefined) {
      entry.parts[frame.idx] = frame.data;
      entry.received++;
    }
    this.dropStale(now);
    if (entry.received < frame.count) {
      return null;
    }
    this.partial.delete(frame.id);
    return JSON.parse(entry.parts.join('')) as WireMessage;
  }

  /** number of messages still being reassembled */
  get pending(): number {
    return this.partial.size;
  }

  private dropStale(now: number): void {
    for (const [id, entry] of this.partial) {
      if (now - entry.startedAt > this.staleAfterMs) {
        this.partial.delete(id);
      }
    }
  }
}
