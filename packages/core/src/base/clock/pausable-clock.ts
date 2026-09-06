import { filter, Subject, Subscription } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { GgGlobalClock } from './global-clock';
import { IClock } from './i-clock';

/**
 * A class providing the ability to track time, fire ticks, provide time elapsed, and tick delta with the ability to suspend/resume it.
 */
export class PausableClock extends IClock {
  private tickSub: Subscription | null = null;
  private readonly _internalTick$: Subject<[number, number]> = new Subject<[number, number]>();

  /**
   * Checks if the clock is currently running.
   */
  public get isRunning(): boolean {
    return !!this.tickSub;
  }

  /**
   * Checks if the clock is currently paused.
   */
  public get isPaused(): boolean {
    return this.pausedAt !== -1;
  }

  /**
   * Checks if the clock is stopped.
   */
  public get isStopped(): boolean {
    return this.startedAt === -1;
  }

  /**
   * Gets the time scale of the clock.
   */
  public get timeScale(): number {
    return this._timeScale;
  }

  /**
   * Sets the time scale of the clock.
   */
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

  /**
   * Gets the elapsed time since the clock started.
   */
  public get elapsedTime(): number {
    if (this.isStopped) {
      return this.lastStopElapsed;
    }
    if (this.isPaused) {
      return this._timeScale * (this.pausedAt - this.startedAt);
    }
    return this._timeScale * (this.parentClock.elapsedTime - this.startedAt);
  }

  /**
   * Tick rate limiter. If set to 0 - tick rate is unlimited, 15 means "allow at most 15 ticks per second"
   */
  public tickRateLimit: number = 0;

  // events
  public readonly paused$: Subject<boolean> = new Subject<boolean>();

  // State variables
  private startedAt: number = -1;
  private oldRelativeTime: number = 0; // "elapsed", emitted on last tick
  private pausedAt: number = -1;
  private lastStopElapsed: number = 0;
  private _timeScale: number = 1;
  private pausedByTimescale: boolean = false;
  private lastFiredTickElapsed: number = 0;

  /**
   * Constructs a new PausableClock instance.
   * @param autoStart Indicates whether the clock should start automatically upon creation.
   * @param parentClock The parent clock to synchronize with. Defaults to GgGlobalClock instance.
   */
  constructor(
    autoStart: boolean = false,
    protected readonly parentClock: IClock = GgGlobalClock.instance,
  ) {
    super(parentClock);
    if (autoStart) {
      this.start();
    }
    this._internalTick$
      .pipe(
        map<[number, number], [number, number]>(([_, newTime]) => [newTime, newTime - this.lastFiredTickElapsed]),
        filter<[number, number]>(
          ([elapsed]) =>
            !this.tickRateLimit ||
            Math.floor((this.lastFiredTickElapsed * this.tickRateLimit) / 1000) <
              Math.floor((elapsed * this.tickRateLimit) / 1000),
        ),
        tap(([elapsed]) => (this.lastFiredTickElapsed = elapsed)),
      )
      .subscribe(this._tick$);
  }

  /**
   * Starts the clock.
   */
  start() {
    if (this.isRunning) {
      return;
    }
    this.oldRelativeTime = 0;
    this.startedAt = this.parentClock.elapsedTime;
    this.startListeningTicks();
  }

  /**
   * Stops the clock.
   */
  stop() {
    this.stopListeningTicks();
    this.lastStopElapsed = this.elapsedTime;
    this.startedAt = this.pausedAt = -1;
  }

  /**
   * Pauses the clock.
   */
  pause() {
    this.stopListeningTicks();
    this.pausedAt = this.parentClock.elapsedTime;
    this.pausedByTimescale = false;
    this.paused$.next(true);
  }

  /**
   * Fires exactly one tick with the given delta while the clock is paused, without resuming it -
   * useful for frame-by-frame debugging. `elapsedTime` (and everything derived from it - child
   * clocks, animations, anything reading `this.elapsedTime`) advances by exactly `delta`, same as
   * it would over `delta` worth of normal ticking, and stays at that new instant once `step`
   * returns (the clock is still paused, it just moved its frozen instant forward). A manual step
   * is never throttled by `tickRateLimit`, and resuming afterwards continues seamlessly from the
   * stepped-to instant rather than losing or double-counting the stepped time.
   * @param delta - tick delta to report to subscribers, in milliseconds
   * @throws if the clock isn't currently paused
   */
  step(delta: number) {
    if (!this.isPaused) {
      throw new Error('Clock must be paused to step it manually');
    }
    // advance the frozen instant so `elapsedTime` (= timeScale * (pausedAt - startedAt)) grows by
    // exactly `delta`, matching what `delta` means for every other tick consumer
    this.pausedAt += this._timeScale !== 0 ? delta / this._timeScale : delta;
    // keep the internal relative-time bookkeeping in step, so the first real tick after resume
    // reports a normal-sized delta instead of one that swallows the whole stepped duration
    this.oldRelativeTime += delta;
    this.lastFiredTickElapsed = this.oldRelativeTime;
    this._tick$.next([this.elapsedTime, delta]);
  }

  /**
   * Resumes the clock.
   */
  resume() {
    if (this.isRunning || this.pausedAt == -1) {
      return;
    }
    this.startedAt += this.parentClock.elapsedTime - this.pausedAt;
    this.pausedAt = -1;
    this.startListeningTicks();
    this.paused$.next(false);
  }

  /**
   * Starts listening for ticks from the parent clock.
   */
  protected startListeningTicks() {
    if (this.tickSub) {
      throw new Error('Clock is already ticking!');
    }
    this.tickSub = this.parentClock.tick$
      .pipe(
        map(([_, d]) => [this.oldRelativeTime, this.oldRelativeTime + d * this.timeScale] as [number, number]),
        tap(([_, cur]) => (this.oldRelativeTime = cur)),
      )
      .subscribe(this._internalTick$);
  }

  /**
   * Stops listening for ticks from the parent clock.
   */
  protected stopListeningTicks() {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
  }

  dispose() {
    this.stopListeningTicks();
    this._internalTick$.complete();
    super.dispose();
  }
}
