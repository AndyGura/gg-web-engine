export interface ClockSyncOptions {
  /** how many of the latest samples the estimate is picked from. Default 8. */
  windowSize: number;
  /** samples needed before the estimate counts as {@link ClockSync.ready}. Default 3. */
  minSamples: number;
  /** how fast `offset` follows a changed estimate once ready, ms per second. Default 5. */
  slewMsPerSecond: number;
  /** an estimate further than this from `offset` is applied at once instead of slewed, ms. Default 250. */
  stepThresholdMs: number;
}

// what one exchange proves about the offset: it lies within [lower, upper]
interface ClockSample {
  t0: number;
  lower: number;
  upper: number;
}

// a sample whose bounds miss the window's by more than this measured a different clock (the remote
// clock jumped, e.g. the machine slept), ms
const CONSISTENCY_MARGIN_MS = 5;

/**
 * NTP-style clock offset/RTT estimate toward one remote peer. `offset` is "remote clock minus local
 * clock": a remote timestamp `ts` happened at local time `ts - offset`.
 *
 * A single exchange only bounds the offset: the ping can't have arrived before it was sent
 * (`offset <= t1 - t0`, exact if the way out took no time) and neither can the pong
 * (`offset >= t2 - t3`). Its midpoint is right only when both legs took equally long, and a leg
 * delayed by a busy main thread or a queued packet pushes it off by half of that delay. So the
 * estimate is never an average: over a sliding window of the latest samples it takes the tightest
 * bound of each direction - the fastest way out and the fastest way back, usually from different
 * samples - and sits in the middle. A delayed leg loosens only its own sample's bound, which is then
 * simply not the tightest one.
 *
 * Every remote timestamp is converted with `offset`, so a change of it moves everything that peer
 * owns at once. Until {@link ready}, `offset` follows the estimate directly (nothing should be
 * converted with it yet); afterwards it slews toward the estimate at `slewMsPerSecond` as time is
 * fed in through {@link advance}, and steps only for an error above `stepThresholdMs`.
 */
export class ClockSync {
  private readonly opts: ClockSyncOptions;
  private readonly window: ClockSample[] = [];
  private lower = 0;
  private upper = 0;
  private _offset = 0;
  private _samples = 0;
  private advancedAt: number | null = null;

  constructor(options: Partial<ClockSyncOptions> = {}) {
    this.opts = {
      windowSize: options.windowSize ?? 8,
      minSamples: options.minSamples ?? 3,
      slewMsPerSecond: options.slewMsPerSecond ?? 5,
      stepThresholdMs: options.stepThresholdMs ?? 250,
    };
  }

  /** the offset timestamps are converted with: the estimate, slewed (see the class description) */
  get offset(): number {
    return this._offset;
  }

  /** the current estimate - where `offset` is heading */
  get targetOffset(): number {
    return (this.lower + this.upper) / 2;
  }

  /** round trip time over the fastest way out and the fastest way back in the window, ms */
  get rtt(): number {
    return Math.max(0, this.upper - this.lower);
  }

  /** number of samples fed in so far */
  get samples(): number {
    return this._samples;
  }

  /** whether enough samples arrived to convert timestamps with `offset` */
  get ready(): boolean {
    return this._samples >= this.opts.minSamples;
  }

  /**
   * Feed one ping/pong exchange. Samples may arrive late or out of order (each carries its own
   * timestamps); a duplicate of one still in the window is ignored.
   * @param t0 - local send time of the ping
   * @param t1 - remote receive time of the ping
   * @param t2 - remote send time of the pong
   * @param t3 - local receive time of the pong
   */
  addSample(t0: number, t1: number, t2: number, t3: number): void {
    if (![t0, t1, t2, t3].every(Number.isFinite) || t3 < t0 || this.window.some(s => s.t0 === t0)) {
      return;
    }
    this.advance(t3);
    const sample: ClockSample = { t0, lower: t2 - t3, upper: t1 - t0 };
    if (
      this.window.length > 0 &&
      (sample.lower > this.upper + CONSISTENCY_MARGIN_MS || sample.upper < this.lower - CONSISTENCY_MARGIN_MS)
    ) {
      // can't both be right: the remote clock itself changed, everything measured before is void
      this.window.length = 0;
    }
    this.window.push(sample);
    if (this.window.length > this.opts.windowSize) {
      this.window.shift();
    }
    this.lower = Math.max(...this.window.map(s => s.lower));
    this.upper = Math.min(...this.window.map(s => s.upper));
    this._samples++;
    if (!this.ready || Math.abs(this.targetOffset - this._offset) > this.opts.stepThresholdMs) {
      this._offset = this.targetOffset;
    }
  }

  /** Move `offset` toward the estimate by what the slew rate allows since the last call. */
  advance(localTime: number): void {
    const elapsed = this.advancedAt === null ? 0 : localTime - this.advancedAt;
    if (this.advancedAt === null || elapsed > 0) {
      this.advancedAt = localTime;
    }
    if (elapsed <= 0 || this.window.length === 0) {
      return;
    }
    const max = (this.opts.slewMsPerSecond * elapsed) / 1000;
    this._offset += Math.max(-max, Math.min(max, this.targetOffset - this._offset));
  }

  /** Convert a remote timestamp to local time. */
  toLocal(remoteTime: number): number {
    return remoteTime - this._offset;
  }

  /** Convert a local timestamp to the remote clock. */
  toRemote(localTime: number): number {
    return localTime + this._offset;
  }
}
