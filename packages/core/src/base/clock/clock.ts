import { Observable, Subject, Subscription } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { GgGlobalClock } from './global-clock';

/**
 * A class, providing ability to track time, fire ticks, provide time elapsed + tick delta with ability to suspend/resume it.
 */
export class Clock {
  private tickSub: Subscription | null = null;
  private readonly _tick$: Subject<[number, number]> = new Subject<[number, number]>();
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
    return this.parentClock.elapsedTime - this.startedAt;
  }

  // state
  private startedAt: number = -1;
  private oldRelativeTime: number = 0; // "elapsed", emitted on last tick
  private pausedAt: number = -1;

  constructor(
    autoStart: boolean = false,
    protected readonly parentClock: Clock | GgGlobalClock = GgGlobalClock.instance,
  ) {
    if (autoStart) {
      this.start();
    }
  }

  createChildClock(autoStart: boolean): Clock {
    return new Clock(autoStart, this);
  }

  start() {
    if (this.isRunning) {
      return;
    }
    this.oldRelativeTime = 0;
    this.startedAt = this.parentClock.elapsedTime;
    this.startListeningTicks();
  }

  stop() {
    this.stopListeningTicks();
    this.startedAt = this.pausedAt = -1;
  }

  pause() {
    this.stopListeningTicks();
    this.pausedAt = this.parentClock.elapsedTime;
  }

  resume() {
    if (this.isRunning || this.pausedAt == -1) {
      return;
    }
    this.startedAt += this.parentClock.elapsedTime - this.pausedAt;
    this.pausedAt = -1;
    this.startListeningTicks();
  }

  protected startListeningTicks() {
    if (this.tickSub) {
      throw new Error('Clock is already ticking!');
    }
    this.tickSub = this.parentClock.tick$
      .pipe(
        map(([parentElapsed, _]) => [this.oldRelativeTime, parentElapsed - this.startedAt] as [number, number]),
        tap(([_, cur]) => (this.oldRelativeTime = cur)),
      )
      .subscribe(this._tick$);
  }

  protected stopListeningTicks() {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
  }
}
