import { IClock } from './i-clock';

const now = typeof performance === 'undefined' ? () => Date.now() : () => performance.now();

/**
 * A singleton class, providing ability to track time, fire ticks, provide time elapsed + tick delta.
 * Starts as soon as accessed and counts time from 01/01/1970
 */
export class GgGlobalClock extends IClock {
  private static _instance: GgGlobalClock;
  public static get instance(): GgGlobalClock {
    if (!GgGlobalClock._instance) {
      GgGlobalClock._instance = new GgGlobalClock();
    }
    return GgGlobalClock._instance;
  }

  public get elapsedTime(): number {
    return now();
  }

  private constructor() {
    super(null);
    let oldRelativeTime = this.elapsedTime;
    const tick = () => {
      requestAnimationFrame(tick);
      const prev = oldRelativeTime;
      const cur = this.elapsedTime;
      oldRelativeTime = cur;
      this._tick$.next([prev, cur - prev]);
    };
    requestAnimationFrame(tick);
  }

  dispose() {
    throw new Error('Cannot dispose global clock');
  }
}
