import { Observable, Subject, Subscription } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { GgGlobalClock } from './global-clock';
import { IClock } from './i-clock';

/**
 * A class, providing ability to track time, fire ticks, provide time elapsed + tick delta with ability to suspend/resume it.
 */
export class PausableClock implements IClock {
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

  public get isStopped(): boolean {
    return this.startedAt === -1;
  }

  public get timeScale(): number {
    return this._timeScale;
  }

  public set timeScale(value: number) {
    if (value === this._timeScale && !(this.pausedByTimescale && value !== 0)) return;
    if (value === 0) {
      if (!this.isPaused) {
        this.pause();
        this.pausedByTimescale = true;
      }
      return;
    }
    if (this.isPaused && this.pausedByTimescale) {
      this.resume();
      this.pausedByTimescale = false;
    }
    if (!this.isStopped) {
      const cur = this.isPaused ? this.pausedAt : this.parentClock.elapsedTime;
      this.startedAt = cur - ((cur - this.startedAt) * this.timeScale) / value;
    }
    this._timeScale = value;
  }

  public get elapsedTime(): number {
    if (this.isStopped) {
      return this.lastStopElapsed;
    }
    if (this.isPaused) {
      return this._timeScale * (this.pausedAt - this.startedAt);
    }
    return this._timeScale * (this.parentClock.elapsedTime - this.startedAt);
  }

  // state
  private startedAt: number = -1;
  private oldRelativeTime: number = 0; // "elapsed", emitted on last tick
  private pausedAt: number = -1;
  private lastStopElapsed: number = 0;
  private _timeScale: number = 1;
  private pausedByTimescale: boolean = false;

  constructor(autoStart: boolean = false, protected readonly parentClock: IClock = GgGlobalClock.instance) {
    if (autoStart) {
      this.start();
    }
  }

  createChildClock(autoStart: boolean): PausableClock {
    return new PausableClock(autoStart, this);
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
    this.lastStopElapsed = this.elapsedTime;
    this.startedAt = this.pausedAt = -1;
  }

  pause() {
    this.stopListeningTicks();
    this.pausedAt = this.parentClock.elapsedTime;
    this.pausedByTimescale = false;
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
