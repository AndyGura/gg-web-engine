import { Input } from './input';
import { filter, fromEvent, Observable, Subject, takeUntil } from 'rxjs';
import { map } from 'rxjs/operators';
import { Point2 } from '../models/points';

/**
 * Options for pointer lock in a MouseInput.
 *
 * ignoreMovementWhenNotLocked: Whether to ignore mouse movement when pointer lock is not active.
 *
 * canvas: The canvas element to request pointer lock on.
 */
export type MouseInputPointLockOptions = { ignoreMovementWhenNotLocked: boolean; canvas: HTMLCanvasElement };
/**
 * Options for a MouseInput.
 *
 * pointerLock: The options for pointer lock. Do not provide it to disable pointer lock functionality
 */
export type MouseInputOptions = {
  pointerLock?: MouseInputPointLockOptions;
};
/**
 * A class representing mouse input.
 */
export class MouseInput extends Input<[], [unlockPointer?: boolean]> {
  /**
   * An observable of the change in the x position of the mouse.
   */
  public get deltaX$(): Observable<number> {
    return this._delta$.pipe(map(d => d.x));
  }
  /**
   * An observable of the change in the y position of the mouse.
   */
  public get deltaY$(): Observable<number> {
    return this._delta$.pipe(map(d => d.y));
  }
  /**
   An observable of the change in the position of the mouse.
   */
  public get delta$(): Observable<Point2> {
    return this._delta$.asObservable();
  }
  private _delta$: Subject<Point2> = new Subject<Point2>();
  private stopped$: Subject<void> = new Subject();

  /**
   Creates an instance of MouseInput.
   @param {MouseInputOptions} options - The options for the MouseInput.
   */
  constructor(private readonly options: MouseInputOptions = {}) {
    super();
    this.canvasClickListener = this.canvasClickListener.bind(this);
  }

  protected async startInternal() {
    fromEvent(window, 'mousemove')
      .pipe(
        takeUntil(this.stopped$),
        filter(
          () =>
            !this.options.pointerLock ||
            !this.options.pointerLock.ignoreMovementWhenNotLocked ||
            !!document.pointerLockElement,
        ),
        map((e: any) => ({ x: e.movementX, y: e.movementY })),
      )
      .subscribe(v => this._delta$.next(v));
    if (!!this.options.pointerLock) {
      this.options.pointerLock.canvas.addEventListener('click', this.canvasClickListener);
    }
  }
  /**
   Stop listening for mouse movement events.
   @param {boolean} [unlockPointer=true] - Whether to exit pointer lock.
   */
  protected async stopInternal(unlockPointer: boolean = true) {
    this.stopped$.next();
    if (unlockPointer && !!this.options.pointerLock) {
      this.options.pointerLock.canvas.removeEventListener('click', this.canvasClickListener);
      document.exitPointerLock();
    }
  }
  /**
   Request pointer lock on the canvas element.
   */
  private canvasClickListener(): void {
    this.options.pointerLock!.canvas.requestPointerLock();
  }
}
