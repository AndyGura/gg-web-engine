import { IEntity, TickOrder } from '../i-entity';
import { BehaviorSubject, distinctUntilChanged, Observable, Subject, takeUntil } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { GgWorld, GgWorldTypeDocRepo } from '../../gg-world';

export type AnimationFunction<T> = (elapsed: number, delta: number) => T;

/**
 * A class that performs property animations for a specific type `T` by using provided animation function.
 * Supports smooth transition between animation function by interpolating between values over time.
 * The current value of the animation can be subscribed to using the `subscribeToValue` property.
 * The animation function can be changed with `transitAnimationFunction` or `transitFromStaticState`.
 */
export class AnimationMixer<
  // a type of animated property
  T,
  // pass-through types, if needed by subclasses
  D = any,
  R = any,
  TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>,
> extends IEntity<D, R, TypeDoc> {
  public readonly tickOrder: number = TickOrder.ANIMATION_MIXERS;
  /**
   * A subject that emits the current value of the animation on every tick.
   */
  protected readonly _value$: Subject<T> = new Subject<T>();

  /**
   * The current transition time reference `[elapsed, delta]` that interpolates between the old and new functions.
   */
  private _currentTransitionK: [number, number] = [0, 0];
  /**
   * The current transition subscription, which is null if no transition is currently active.
   */
  private _currentTransition: ((a: [number, number]) => void) | null = null;
  /**
   * A behavior subject that emits whether the animator is currently in a transition.
   */
  private _isInTransition$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Gets an observable of the current value of the animation.
   */
  get value$(): Observable<T> {
    return this._value$.asObservable();
  }

  /**
   * Gets the current motion control function that determines the animation.
   */
  get animationFunction(): AnimationFunction<T> {
    return this._animationFunction;
  }

  /**
   * Sets the current motion control function that determines the animation.
   * @param value The new motion control function.
   */
  set animationFunction(value: AnimationFunction<T>) {
    if (this.currentTransition) {
      this.currentTransition = null;
    }
    this._animationFunction = value;
  }

  /**
   * Gets a flag whether the animator is currently in a transition.
   */
  public get isInTransition(): boolean {
    return this._isInTransition$.getValue();
  }

  /**
   * Gets an observable that emits whether the animator is currently in a transition.
   */
  public get isInTransition$(): Observable<boolean> {
    return this._isInTransition$.pipe(distinctUntilChanged());
  }

  protected get currentTransition(): ((a: [number, number]) => void) | null {
    return this._currentTransition;
  }

  protected set currentTransition(value: ((a: [number, number]) => void) | null) {
    this._currentTransition = value;
    this._isInTransition$.next(!!value);
  }

  /**
   * Creates a new `AnimationMixer` entity.
   * @param _animationFunction The initial motion control function that determines the animation.
   * @param _lerp The linear interpolation between two values of type `T`.
   */
  constructor(
    protected _animationFunction: AnimationFunction<T>,
    protected _lerp: (a: T, b: T, t: number) => T = (a, b, t) => b,
  ) {
    super();
  }

  /**
   * Set output to static value and smoothly transit to new control function
   * @param newFunc a new function
   * @param transitionDuration a duration, after which new function will be fully controlling the output
   * @param easing an easing function for transition
   */
  transitFromStaticState(
    state: T,
    newFunc: AnimationFunction<T>,
    transitionDuration: number,
    easing: (t: number) => number = x => x,
  ) {
    this.animationFunction = () => state;
    return this.transitAnimationFunction(newFunc, transitionDuration, easing);
  }

  /**
   * Smoothly transit to new control function
   * @param newFunc a new function
   * @param transitionDuration a duration, after which new function will be fully controlling the output
   * @param easing an easing function for transition
   */
  transitAnimationFunction(
    newFunc: AnimationFunction<T>,
    transitionDuration: number,
    easing: (t: number) => number = x => x,
  ) {
    let oldAnimFunc: AnimationFunction<T>;
    if (this.currentTransition) {
      // interrupt it by freezing K, so it will still work as binding, but do not animate further
      this.currentTransition = null;
      const oldTransitionAnimationFunction = this._animationFunction;
      const oldTransitionLatestK = this._currentTransitionK;
      oldAnimFunc = () => oldTransitionAnimationFunction(...oldTransitionLatestK);
    } else {
      oldAnimFunc = this._animationFunction;
    }
    let k = 0;
    this._animationFunction = (elapsed, delta) => this._lerp(oldAnimFunc(elapsed, delta), newFunc(elapsed, delta), k);
    let startTime: number | undefined;
    this.currentTransition = ([elapsed, delta]) => {
      this._currentTransitionK = [elapsed, delta];
      if (startTime === undefined) {
        startTime = elapsed;
      } else {
        k = (elapsed - startTime) / transitionDuration;
        if (k >= 1) {
          k = 1;
          this.currentTransition = null;
          this._animationFunction = newFunc;
        } else {
          k = easing(k);
        }
      }
    };
  }

  onSpawned(world: GgWorld<D, R, TypeDoc>) {
    super.onSpawned(world);
    this.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        tap(([elapsed, delta]) => this.currentTransition && this.currentTransition([elapsed, delta])),
        map(([elapsed, delta]) => this._animationFunction(elapsed, delta)),
      )
      .subscribe(value => this._value$.next(value));
  }

  dispose(): void {
    super.dispose();
    this.tick$.complete();
    this._value$.complete();
  }
}
