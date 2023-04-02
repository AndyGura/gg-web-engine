import { animationFrameScheduler, Observable, of, Subject } from 'rxjs';
import { map, repeat, tap } from 'rxjs/operators';
import { Clock } from './clock';

/**
 * A singleton class, providing ability to track time, fire ticks, provide time elapsed + tick delta.
 * Starts as soon as accessed and counts time from 01/01/1970
 */
export class GgGlobalClock {
  private static _instance: GgGlobalClock;
  public static get instance(): GgGlobalClock {
    if (!GgGlobalClock._instance) {
      GgGlobalClock._instance = new GgGlobalClock();
    }
    return GgGlobalClock._instance;
  }

  private readonly _tick$: Subject<[number, number]> = new Subject<[number, number]>();

  public get tick$(): Observable<[number, number]> {
    return this._tick$.pipe(map(([oldTime, newTime]) => [newTime, newTime - oldTime]));
  }

  public get elapsedTime(): number {
    return (typeof performance === 'undefined' ? Date : performance).now();
  }

  createChildClock(autoStart: boolean): Clock {
    return new Clock(autoStart, this);
  }

  private constructor() {
    let oldRelativeTime = this.elapsedTime;
    of(undefined, animationFrameScheduler)
      .pipe(repeat())
      .pipe(
        map(() => [oldRelativeTime, this.elapsedTime] as [number, number]),
        tap(([_, cur]) => (oldRelativeTime = cur)),
      )
      .subscribe(this._tick$);
  }
}
