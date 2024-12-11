import { IInput } from './i-input';
import { BehaviorSubject, filter, finalize, fromEvent, NEVER, Observable, share, Subject, takeUntil } from 'rxjs';
import { map, pairwise, switchMap, tap } from 'rxjs/operators';
import { Point2 } from '../models/points';
import { Pnt2 } from '../math/point2';

/**
 * Options for a MouseInput.
 *
 * canvas?: Canvas element. If not provided, mouse events will be listened on the whole window
 * pointerLock: The flag to enable pointer lock when clicking on canvas
 */
export type MouseInputOptions = {
  canvas?: HTMLCanvasElement;
  pointerLock: boolean;
};

const DEFAULT_MOUSE_INPUT_OPTIONS: MouseInputOptions = {
  pointerLock: false,
};

/**
 Represents the state of the mouse/touch input on the screen.
 */
export enum MouseInputState { //MouseInputState {
  /**
   No mouse or touch input is detected. Mouse move can still be emitted
   */
  NONE,
  /**
   The left mouse button or a single touch is being dragged on the screen.
   */
  DRAG,
  /**
   The middle mouse button is being dragged on the screen.
   */
  DRAG_MIDDLE_BUTTON,
  /**
   The right mouse button is being dragged on the screen.
   */
  DRAG_RIGHT_BUTTON,
  /**
   *Two fingers are being used to drag on the screen.
   */
  DRAG_TOUCH_TWO_FINGERS,
}

/**
 * A class representing mouse input.
 */
export class MouseInput extends IInput<[], [unlockPointer?: boolean]> {
  static isTouchDevice(): boolean {
    return (
      'createTouch' in document ||
      !!navigator.userAgent.match(/(iPhone|iPod|iPad)/) ||
      !!navigator.userAgent.match(/Android/)
    );
  }

  /**
   An observable of the change in the position of the mouse.
   */
  public get delta$(): Observable<Point2> {
    return this._delta$.asObservable();
  }

  /**
   A global position of the mouse.
   */
  public get position(): Point2 {
    return this._position$.getValue();
  }

  /**
   An observable of the global position of the mouse.
   */
  public get position$(): Observable<Point2> {
    return this._position$.asObservable();
  }

  /**
   An observable of the wheel scrolling.
   */
  private _wheel$: Observable<number> | null = null;
  public get wheel$(): Observable<number> {
    if (!this._wheel$) {
      this._wheel$ = (fromEvent(this._element, 'wheel', { passive: false }) as Observable<WheelEvent>).pipe(
        takeUntil(this.stopped$),
        finalize(() => (this._wheel$ = null)),
        tap(e => e.preventDefault()),
        map(e => e.deltaY),
        share(),
      );
    }
    return this._wheel$;
  }

  public get isPointerLocked(): boolean {
    return !!document.pointerLockElement;
  }

  public get isPointerLocked$(): Observable<boolean> {
    return fromEvent(document, 'pointerlockchange').pipe(map(() => this.isPointerLocked));
  }

  private readonly options: MouseInputOptions;
  private _delta$: Subject<Point2> = new Subject<Point2>();
  private _position$: BehaviorSubject<Point2> = new BehaviorSubject<Point2>(Pnt2.O);
  private _multiTouchPositions$: BehaviorSubject<Point2[]> = new BehaviorSubject<Point2[]>([]);
  private stopped$: Subject<void> = new Subject();

  private _state$: BehaviorSubject<MouseInputState> = new BehaviorSubject<MouseInputState>(MouseInputState.NONE);

  public get state(): MouseInputState {
    return this._state$.getValue();
  }

  public get state$(): Observable<MouseInputState> {
    return this._state$.asObservable();
  }

  public get multiTouchPositions$(): Observable<Point2[]> {
    return this._multiTouchPositions$.asObservable();
  }

  public get twoTouchGestureDelta$(): Observable<{
    centerPointDelta: Point2;
    angleDelta: number;
    distanceDelta: number;
  }> {
    return this.state$.pipe(
      switchMap((s: MouseInputState) =>
        s == MouseInputState.DRAG_TOUCH_TWO_FINGERS ? this.multiTouchPositions$ : NEVER,
      ),
      map((p: Point2[]) => p.map(v => ({ x: v.x, y: v.y }))),
      pairwise(),
      filter(([prev, cur]) => prev.length > 1 && cur.length > 1),
      map(([prev, cur]) => ({
        centerPointDelta: Pnt2.sub(
          Pnt2.scalarMult(
            cur.reduce((p, c) => Pnt2.add(p, c), Pnt2.O),
            1 / cur.length,
          ),
          Pnt2.scalarMult(
            prev.reduce((p, c) => Pnt2.add(p, c), Pnt2.O),
            1 / cur.length,
          ),
        ),
        angleDelta: Pnt2.angle(cur[1], cur[0]) - Pnt2.angle(prev[1], prev[0]),
        distanceDelta: Pnt2.dist(cur[1], cur[0]) - Pnt2.dist(prev[1], prev[0]),
      })),
    );
  }

  private get _element(): HTMLCanvasElement | Window {
    return this.options.canvas || window;
  }

  /**
   Creates an instance of MouseInput.
   @param {MouseInputOptions} options - The options for the MouseInput.
   */
  constructor(options: Partial<MouseInputOptions> = {}) {
    super();
    this.options = {
      ...DEFAULT_MOUSE_INPUT_OPTIONS,
      ...options,
    };
    this.canvasClickListener = this.canvasClickListener.bind(this);
  }

  protected startInternal() {
    if (this.options.canvas) {
      this.options.canvas.style.touchAction = 'none';
    }
    this._state$.next(MouseInputState.NONE);

    const mouseButtonStateMap = [
      MouseInputState.DRAG,
      MouseInputState.DRAG_MIDDLE_BUTTON,
      MouseInputState.DRAG_RIGHT_BUTTON,
    ];
    const pointerLengthsStateMap = [MouseInputState.NONE, MouseInputState.DRAG, MouseInputState.DRAG_TOUCH_TWO_FINGERS];

    const pointers: any[] = [];
    const pointerPositions: any = {};

    (fromEvent(this._element, 'mousemove') as Observable<MouseEvent | PointerEvent>)
      .pipe(takeUntil(this.stopped$))
      .subscribe((event: MouseEvent) => {
        this._delta$.next({ x: event.movementX, y: event.movementY });
      });

    (fromEvent(this._element, 'pointermove') as Observable<MouseEvent | PointerEvent>)
      .pipe(takeUntil(this.stopped$))
      .subscribe((event: PointerEvent | MouseEvent) => {
        if (event instanceof PointerEvent) {
          if (event.pointerType === 'touch') {
            pointerPositions[event.pointerId] = { x: event.pageX, y: event.pageY };
          }
          const newPosition = { x: event.pageX, y: event.pageY };
          this._position$.next(newPosition);
          this._multiTouchPositions$.next(Object.values(pointerPositions));
        } else {
          this._position$.next({ x: event.clientX, y: event.clientY });
        }
        this._delta$.next({ x: event.movementX, y: event.movementY });
      });
    if (!MouseInput.isTouchDevice() && this.options.pointerLock && this.options.canvas) {
      this.options.canvas.addEventListener('click', this.canvasClickListener);
    }
    const onPointerUp = (event: PointerEvent) => {
      delete pointerPositions[event.pointerId];
      for (let i = 0; i < pointers.length; i++) {
        if (pointers[i].pointerId == event.pointerId) {
          pointers.splice(i, 1);
          break;
        }
      }
      if (pointers.length === 0) {
        if (this.options.canvas) {
          this.options.canvas.releasePointerCapture(event.pointerId);
        }
        window.removeEventListener('pointerup', onPointerUp as any);
        this._element.removeEventListener('pointercancel', onPointerUp as any);
      }
      this._state$.next(pointerLengthsStateMap[Math.min(pointers.length, 2)]);
    };

    (fromEvent(this._element, 'pointerdown') as Observable<PointerEvent>)
      .pipe(takeUntil(this.stopped$))
      .subscribe((event: PointerEvent) => {
        if (pointers.length === 0) {
          try {
            if (this.options.canvas) {
              this.options.canvas.setPointerCapture(event.pointerId);
            }
            // use window instead of ths._element to handle case when mouse was released over other element
            window.addEventListener('pointerup', onPointerUp as any);
            this._element.addEventListener('pointercancel', onPointerUp as any);
          } catch (err) {
            console.error(err);
          }
        }
        pointers.push(event);
        if (event.pointerType === 'touch') {
          pointerPositions[event.pointerId] = { x: event.pageX, y: event.pageY };
          this._state$.next(pointerLengthsStateMap[Math.min(pointers.length, 2)]);
        } else {
          this._state$.next(mouseButtonStateMap[event.button] || MouseInputState.NONE);
        }
      });
    fromEvent(this._element, 'contextmenu')
      .pipe(takeUntil(this.stopped$))
      .subscribe(event => {
        event.preventDefault();
      });
  }

  /**
   Stop listening for mouse movement events.
   @param {boolean} [unlockPointer=true] - Whether to exit pointer lock.
   */
  protected stopInternal(unlockPointer: boolean = true) {
    this.stopped$.next();
    if (unlockPointer && !!this.options.canvas) {
      this.options.canvas.removeEventListener('click', this.canvasClickListener);
      document.exitPointerLock();
    }
  }

  /**
   Request pointer lock on the canvas element.
   */
  private canvasClickListener(): void {
    this.options.canvas!.requestPointerLock();
  }
}
