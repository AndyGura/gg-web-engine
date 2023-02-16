import { IController } from './i-controller';
import { filter, fromEvent, Observable, Subject, takeUntil } from 'rxjs';
import { map } from 'rxjs/operators';
import { Point2 } from '../../models/points';

export type MouseControllerPointLockOptions = { ignoreMovementWhenNotLocked: boolean, canvas: HTMLCanvasElement };
export type MouseControllerOptions = {
  pointerLock?: MouseControllerPointLockOptions,
}

export class MouseController implements IController {

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

  constructor(
    private readonly options: MouseControllerOptions = {},
  ) {
    this.canvasClickListener = this.canvasClickListener.bind(this);
  }

  private stopped$: Subject<void> = new Subject();
  private _running: boolean = false;
  public get running(): boolean {
    return this._running;
  }

  async start() {
    if (this.running) {
      return;
    }
    fromEvent(window, 'mousemove')
      .pipe(
        takeUntil(this.stopped$),
        filter(() => !this.options.pointerLock || !this.options.pointerLock.ignoreMovementWhenNotLocked || !!document.pointerLockElement),
        map((e: any) => ({ x: e.movementX, y: e.movementY }))
      )
      .subscribe(this._delta$);
    if (!!this.options.pointerLock) {
      this.options.pointerLock.canvas.addEventListener('click', this.canvasClickListener);
    }
    this._running = true;
  }

  private canvasClickListener(): void {
    this.options.pointerLock!.canvas.requestPointerLock();
  }

  async stop() {
    if (!this.running) {
      return;
    }
    this.stopped$.next();
    if (!!this.options.pointerLock) {
      this.options.pointerLock.canvas.removeEventListener('click', this.canvasClickListener);
      document.exitPointerLock();
    }
    this._running = false;
  }

}
