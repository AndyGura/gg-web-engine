import { NetScheduler } from './scheduler';
import { WireChannel } from './wire';

/**
 * Simulated bad network on the receive path of one peer (the `net_lag` console command). Works the
 * same over any transport. Every incoming message is delayed by `latencyMs` +- `jitterMs`, and
 * `lossRate` of the unreliable ones are dropped. On top of that:
 * - **stalls**: nothing is delivered during the first `stallMs` of every `stallIntervalMs`; whatever
 *   was due then arrives in one burst when the stall ends (a wifi hiccup, a congested router).
 * - **delayed reliable messages**: `reliableDelayRate` of the reliable ones take `reliableDelayMs`
 *   longer, as a retransmitted packet does.
 *
 * Reliable messages of one sender are always delivered in order, so a delayed one holds back every
 * later one (head-of-line blocking); unreliable ones may reorder. The order never depends on timers
 * firing in the order of their delays: a sender's delayed reliable messages wait in one queue, drained
 * by one timer at a time.
 */
export class LinkConditioner {
  public latencyMs = 0;
  public lossRate = 0;
  public jitterMs = 0;
  public stallMs = 0;
  public stallIntervalMs = 0;
  public reliableDelayRate = 0;
  public reliableDelayMs = 0;

  // per sender: its reliable messages in flight, in order of arrival. No entry with nothing in flight
  private readonly reliableQueues = new Map<string, { deliver: () => void; due: number }[]>();

  constructor(
    private readonly scheduler: NetScheduler,
    private readonly random: () => number = Math.random,
  ) {}

  private get stalls(): boolean {
    return this.stallMs > 0 && this.stallIntervalMs > 0;
  }

  private get delaysReliable(): boolean {
    return this.reliableDelayRate > 0 && this.reliableDelayMs > 0;
  }

  get active(): boolean {
    return this.latencyMs > 0 || this.lossRate > 0 || this.jitterMs > 0 || this.stalls || this.delaysReliable;
  }

  /** Back to a clean link. Messages already delayed are still delivered on their schedule. */
  reset(): void {
    this.latencyMs = this.lossRate = this.jitterMs = 0;
    this.stallMs = this.stallIntervalMs = 0;
    this.reliableDelayRate = this.reliableDelayMs = 0;
  }

  /** The simulated conditions in one line, e.g. `100 ms, 10% loss`. */
  describe(): string {
    let text = `${this.latencyMs} ms, ${this.lossRate * 100}% loss`;
    if (this.jitterMs > 0) {
      text += `, +-${this.jitterMs} ms jitter`;
    }
    if (this.stalls) {
      text += `, ${this.stallMs} ms stall every ${this.stallIntervalMs} ms`;
    }
    if (this.delaysReliable) {
      text += `, ${this.reliableDelayRate * 100}% of reliable +${this.reliableDelayMs} ms`;
    }
    return text;
  }

  /**
   * Run `deliver` for an incoming message, after the simulated delay, unless it is dropped.
   * @param from - the sender: reliable messages keep their order per sender
   */
  pass(channel: WireChannel, deliver: () => void, from: string = ''): void {
    const now = this.scheduler.now();
    const queue = channel === 'reliable' ? this.reliableQueues.get(from) : undefined;
    if (!this.active && !queue) {
      deliver();
      return;
    }
    if (channel === 'unreliable' && this.random() < this.lossRate) {
      return;
    }
    let due = now + this.latencyMs;
    if (this.jitterMs > 0) {
      due = Math.max(now, due + (this.random() * 2 - 1) * this.jitterMs);
    }
    if (channel === 'reliable' && this.delaysReliable && this.random() < this.reliableDelayRate) {
      due += this.reliableDelayMs;
    }
    if (this.stalls) {
      const phase = due % this.stallIntervalMs;
      if (phase < this.stallMs) {
        due += this.stallMs - phase;
      }
    }
    if (queue) {
      // behind everything of this sender still in flight, whatever its own delay
      queue.push({ deliver, due });
    } else if (due <= now) {
      deliver();
    } else if (channel === 'reliable') {
      this.reliableQueues.set(from, [{ deliver, due }]);
      this.scheduler.setTimeout(() => this.drain(from), due - now);
    } else {
      this.scheduler.setTimeout(deliver, due - now);
    }
  }

  /**
   * The timer of a sender's first queued reliable message fired: deliver it and every later one that
   * is due as well, then wait for the next. The sender is forgotten once nothing of it is in flight.
   */
  private drain(from: string): void {
    const queue = this.reliableQueues.get(from);
    if (!queue) {
      return;
    }
    try {
      // the first one is due by its timer having fired, even when a timer runs a fraction of a ms early
      let first = true;
      while (queue.length > 0 && (first || queue[0].due <= this.scheduler.now())) {
        first = false;
        queue.shift()!.deliver();
      }
    } finally {
      if (queue.length > 0) {
        this.scheduler.setTimeout(() => this.drain(from), Math.max(0, queue[0].due - this.scheduler.now()));
      } else {
        this.reliableQueues.delete(from);
      }
    }
  }
}
