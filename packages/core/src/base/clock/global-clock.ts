import { Observable, Subject } from 'rxjs';
import { PausableClock } from './pausable-clock';
import { IClock } from './i-clock';

const now = typeof performance === 'undefined' ? () => Date.now() : () => performance.now();
/**
 * A singleton class, providing ability to track time, fire ticks, provide time elapsed + tick delta.
 * Starts as soon as accessed and counts time from 01/01/1970
 */
export class GgGlobalClock implements IClock {
  private static _instance: GgGlobalClock;
  public static get instance(): GgGlobalClock {
    if (!GgGlobalClock._instance) {
      GgGlobalClock._instance = new GgGlobalClock();
    }
    return GgGlobalClock._instance;
  }

  private readonly _tick$: Subject<[number, number]> = new Subject<[number, number]>();

  public get tick$(): Observable<[number, number]> {
    return this._tick$.asObservable();
  }

  public get elapsedTime(): number {
    return now();
  }

  createChildClock(autoStart: boolean): PausableClock {
    return new PausableClock(autoStart, this);
  }

  private constructor() {
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
}
