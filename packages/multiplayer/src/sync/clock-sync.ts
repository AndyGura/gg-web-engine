/**
 * NTP-style clock offset/RTT estimate toward one remote peer, smoothed with an exponential moving
 * average. `offset` is "remote clock minus local clock": a remote timestamp `ts` happened at local
 * time `ts - offset`. A few ms of noise is plenty for the network layer's 250 ms extrapolation cap.
 */
export class ClockSync {
  private _offset = 0;
  private _rtt = 0;
  private _samples = 0;

  /** @param smoothing - EMA weight of a new sample (0..1); the first sample is taken as is */
  constructor(private readonly smoothing: number = 0.2) {}

  get offset(): number {
    return this._offset;
  }

  get rtt(): number {
    return this._rtt;
  }

  get samples(): number {
    return this._samples;
  }

  /**
   * Feed one ping/pong exchange.
   * @param t0 - local send time of the ping
   * @param t1 - remote receive time of the ping
   * @param t2 - remote send time of the pong
   * @param t3 - local receive time of the pong
   */
  addSample(t0: number, t1: number, t2: number, t3: number): void {
    const rtt = Math.max(0, t3 - t0 - (t2 - t1));
    const offset = (t1 - t0 + (t2 - t3)) / 2;
    if (this._samples === 0) {
      this._offset = offset;
      this._rtt = rtt;
    } else {
      this._offset += (offset - this._offset) * this.smoothing;
      this._rtt += (rtt - this._rtt) * this.smoothing;
    }
    this._samples++;
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
