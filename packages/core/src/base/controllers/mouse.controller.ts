import { IController } from './i-controller';
import { fromEvent, Observable, Subject, takeUntil } from 'rxjs';
import { map } from 'rxjs/operators';

export class MouseController implements IController {

  private readonly _delta$: Subject<[number, number]> = new Subject<[number, number]>();

  public get deltaX$(): Observable<number> {
    return this._delta$.pipe(map(([dx, _]) => dx));
  }

  public get deltaY$(): Observable<number> {
    return this._delta$.pipe(map(([_, dy]) => dy));
  }

  public get delta$(): Observable<[number, number]> {
    return this._delta$.asObservable();
  }

  constructor(
    private readonly enablePointerLock: boolean = false,
    private readonly canvas?: HTMLCanvasElement
  ) {
    if (this.enablePointerLock && !this.canvas) {
      throw new Error('canvas is required when pointer lock enabled');
    }
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
        map((e: any) => [e.movementX, e.movementY] as [number, number])
      )
      .subscribe(this._delta$);
    if (this.enablePointerLock) {
      this.canvas!.addEventListener('click', this.canvasClickListener);
    }
    this._running = true;
  }

  private canvasClickListener(): void {
    this.canvas!.requestPointerLock();
  }

  async stop() {
    if (!this.running) {
      return;
    }
    this.stopped$.next();
    if (this.enablePointerLock) {
      this.canvas!.removeEventListener('click', this.canvasClickListener);
      document.exitPointerLock();
    }
    this._running = false;
  }

}
