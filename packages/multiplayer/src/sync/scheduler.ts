/**
 * Time source and timers the network layer runs on - everything that must keep working while the
 * world clock is paused (heartbeats, clock-sync pings, join handshakes, transport latency) goes
 * through this instead of the world's `tick$`. Injectable so tests (and the in-process harness) can
 * drive several peers deterministically on one {@link VirtualScheduler}.
 */
export interface NetScheduler {
  /** Monotonic milliseconds. */
  now(): number;

  setTimeout(fn: () => void, ms: number): unknown;

  clearTimeout(handle: unknown): void;

  setInterval(fn: () => void, ms: number): unknown;

  clearInterval(handle: unknown): void;
}

/** The default scheduler: `performance.now()` (falling back to `Date.now()`) and the host's own timers. */
export const realScheduler: NetScheduler = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: handle => clearTimeout(handle as any),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: handle => clearInterval(handle as any),
};

interface VirtualTimer {
  id: number;
  due: number;
  fn: () => void;
  interval: number | null;
}

/**
 * A manually advanced clock: nothing happens until {@link advance} is called, which runs every
 * timer due in the advanced window in due-time order (ties in creation order). Used by the
 * in-process multiplayer harness to run several peers and a `LoopbackHub` on one shared timeline.
 */
export class VirtualScheduler implements NetScheduler {
  private time: number;
  private nextId = 1;
  private timers: VirtualTimer[] = [];

  constructor(startTime: number = 0) {
    this.time = startTime;
  }

  now(): number {
    return this.time;
  }

  setTimeout(fn: () => void, ms: number): unknown {
    return this.add(fn, ms, null);
  }

  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter(t => t.id !== handle);
  }

  setInterval(fn: () => void, ms: number): unknown {
    return this.add(fn, ms, Math.max(1, ms));
  }

  clearInterval(handle: unknown): void {
    this.clearTimeout(handle);
  }

  /** Advance time by `ms`, running every timer that falls due on the way. */
  advance(ms: number): void {
    const target = this.time + ms;
    while (true) {
      let next: VirtualTimer | null = null;
      for (const t of this.timers) {
        if (t.due <= target && (!next || t.due < next.due || (t.due === next.due && t.id < next.id))) {
          next = t;
        }
      }
      if (!next) {
        break;
      }
      this.time = Math.max(this.time, next.due);
      if (next.interval !== null) {
        next.due += next.interval;
      } else {
        this.timers.splice(this.timers.indexOf(next), 1);
      }
      next.fn();
    }
    this.time = target;
  }

  /** Number of pending timers - handy to assert a disposed peer cleaned up after itself. */
  get pendingTimers(): number {
    return this.timers.length;
  }

  private add(fn: () => void, ms: number, interval: number | null): number {
    const id = this.nextId++;
    this.timers.push({ id, due: this.time + Math.max(0, ms), fn, interval });
    return id;
  }
}
