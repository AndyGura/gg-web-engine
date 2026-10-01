import { NetScheduler } from './scheduler';
import { WireChannel } from './wire';

/**
 * Simulated bad network on the receive path of one peer (the `net_lag` console command): every
 * incoming message is delayed by `latencyMs`, and `lossRate` of the unreliable ones are dropped.
 * Works the same over any transport. A constant delay keeps reliable messages in order.
 */
export class LinkConditioner {
  public latencyMs = 0;
  public lossRate = 0;

  constructor(
    private readonly scheduler: NetScheduler,
    private readonly random: () => number = Math.random,
  ) {}

  get active(): boolean {
    return this.latencyMs > 0 || this.lossRate > 0;
  }

  /** Run `deliver` for an incoming message, after the simulated delay, unless it is dropped. */
  pass(channel: WireChannel, deliver: () => void): void {
    if (!this.active) {
      deliver();
      return;
    }
    if (channel === 'unreliable' && this.random() < this.lossRate) {
      return;
    }
    if (this.latencyMs > 0) {
      this.scheduler.setTimeout(deliver, this.latencyMs);
    } else {
      deliver();
    }
  }
}
