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
 * later one (head-of-line blocking); unreliable ones may reorder.
 */
export class LinkConditioner {
  public latencyMs = 0;
  public lossRate = 0;
  public jitterMs = 0;
  public stallMs = 0;
  public stallIntervalMs = 0;
  public reliableDelayRate = 0;
  public reliableDelayMs = 0;

  // per sender: when its last reliable message is delivered
  private readonly reliableTail = new Map<string, number>();

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
    const tail = this.reliableTail.get(from);
    if (tail !== undefined && tail <= now) {
      this.reliableTail.delete(from);
    }
    if (!this.active && !(channel === 'reliable' && this.reliableTail.has(from))) {
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
    if (channel === 'reliable') {
      due = Math.max(due, this.reliableTail.get(from) ?? 0);
      if (due > now) {
        this.reliableTail.set(from, due);
      }
    }
    if (due > now) {
      this.scheduler.setTimeout(deliver, due - now);
    } else {
      deliver();
    }
  }
}
