import { Input } from './input';
import { filter, fromEvent, Observable, Subject, takeUntil } from 'rxjs';
import { map } from 'rxjs/operators';
import { Point2 } from '../models/points';

export type MouseControllerPointLockOptions = { ignoreMovementWhenNotLocked: boolean; canvas: HTMLCanvasElement };
export type MouseControllerOptions = {
  pointerLock?: MouseControllerPointLockOptions;
};

export class MouseInput extends Input<[], [unlockPointer?: boolean]> {
  private readonly _delta$: Subject<Point2> = new Subject<Point2>();

  public get deltaX$(): Observable<number> {
    return this._delta$.pipe(map(d => d.x));
  }

  public get deltaY$(): Observable<number> {
    return this._delta$.pipe(map(d => d.y));
  }

  public get delta$(): Observable<Point2> {
    return this._delta$.asObservable();
  }

  private stopped$: Subject<void> = new Subject();

  constructor(private readonly options: MouseControllerOptions = {}) {
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

  protected async stopInternal(unlockPointer: boolean = true) {
    this.stopped$.next();
    if (unlockPointer && !!this.options.pointerLock) {
      this.options.pointerLock.canvas.removeEventListener('click', this.canvasClickListener);
      document.exitPointerLock();
    }
  }

  private canvasClickListener(): void {
    this.options.pointerLock!.canvas.requestPointerLock();
  }
}
