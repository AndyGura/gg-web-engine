import { animationFrameScheduler, Observable, of, Subject, Subscription } from 'rxjs';
import { map, repeat, tap } from 'rxjs/operators';

const now = () => {
  return (typeof performance === 'undefined' ? Date : performance).now();
};

export class Clock {
  public static readonly animationFrameClock: Clock = new Clock(
    of(undefined, animationFrameScheduler).pipe(repeat()),
    true,
  );

  // value is global clock time, delta ms from last tick
  public get tick$(): Observable<[number, number]> {
    return this._tick$.pipe(map(([oldTime, newTime]) => [newTime, newTime - oldTime]));
  }

  public get isRunning(): boolean {
    return !!this.tickSub;
  }

  public get isPaused(): boolean {
    return this.pausedAt !== -1;
  }

  public get elapsedTime(): number {
    if (this.isPaused) {
      return this.pausedAt - this.startedAt;
    }
    return now() - this.startedAt;
  }

  private tickSub: Subscription | null = null;
  private readonly _tick$: Subject<[number, number]> = new Subject<[number, number]>();

  // state
  private startedAt: number = -1;
  private pausedAt: number = -1;

  constructor(private readonly tickSource: Observable<any>, autoStart: boolean = false) {
    if (autoStart) {
      this.start();
    }
  }

  start() {
    if (this.isRunning) {
      return;
    }
    this.startedAt = now();
    this.startListeningTicks();
  }

  stop() {
    this.stopListeningTicks();
    this.startedAt = this.pausedAt = -1;
  }

  pause() {
    this.stopListeningTicks();
    this.pausedAt = now();
  }

  resume() {
    if (this.isRunning || this.pausedAt == -1) {
      return;
    }
    this.startedAt += now() - this.pausedAt;
    this.pausedAt = -1;
    this.startListeningTicks();
  }

  private startListeningTicks() {
    if (this.tickSub) {
      throw new Error('Clock is already ticking!');
    }
    let oldRelativeTime = 0;
    this.tickSub = this.tickSource
      .pipe(
        map(() => [oldRelativeTime, now() - this.startedAt] as [number, number]),
        tap(([_, cur]) => (oldRelativeTime = cur)),
      )
      .subscribe(this._tick$);
  }

  private stopListeningTicks() {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
  }
}
