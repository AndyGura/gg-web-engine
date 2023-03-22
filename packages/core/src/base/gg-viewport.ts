import { BehaviorSubject, distinctUntilChanged, fromEvent, merge, Observable, Subject, takeUntil } from 'rxjs';
import { map } from 'rxjs/operators';
import { Point2 } from './models/points';
import { GgVisualScene } from './interfaces/gg-visual-scene';

const getCurrentWindowSize = (): Point2 => {
  return {
    x: window.innerWidth,
    y: window.innerHeight,
  };
};

const getMousePositionFromEvent = (event: MouseEvent | TouchEvent): Point2 | null => {
  if (event instanceof MouseEvent) {
    return { x: event.x, y: event.y };
  } else if (event instanceof TouchEvent) {
    if (event.touches.length === 0) {
      return null;
    }
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  console.warn('Cannot determine mouse position from event', event);
  return null;
};

export class GgViewport {
  private static _instance: GgViewport | null;
  static get instance(): GgViewport {
    if (!this._instance) {
      this._instance = new GgViewport();
    }
    return this._instance;
  }

  private constructor() {}

  protected destroy$: Subject<void> | null = null;

  private scenes: GgVisualScene<any, any>[] = [];

  public get isActive(): boolean {
    return !!this.destroy$;
  }

  public activate() {
    if (this.destroy$) {
      throw new Error('GgViewport is already active');
    }
    this.destroy$ = new Subject();
    // cursor position
    merge(fromEvent(window, 'mousemove'), fromEvent(window, 'touchstart'), fromEvent(window, 'touchmove'))
      .pipe(
        takeUntil(this.destroy$),
        map(event => event as MouseEvent | TouchEvent),
      )
      .subscribe(event => {
        const point = getMousePositionFromEvent(event);
        if (point) {
          this.mousePosition.next(point);
        }
      });
    // clicks
    merge(fromEvent(window, 'mousedown'), fromEvent(window, 'touchstart'))
      .pipe(
        takeUntil(this.destroy$),
        map(event => event as MouseEvent | TouchEvent),
      )
      .subscribe(event => {
        const point = getMousePositionFromEvent(event);
        if (point) {
          this.mousePosition.next(point);
        }
        this.isMouseDown.next(true);
      });
    merge(fromEvent(window, 'mouseup'), fromEvent(window, 'click'), fromEvent(window, 'touchend'))
      .pipe(
        takeUntil(this.destroy$),
        map(event => event as MouseEvent | TouchEvent),
      )
      .subscribe(event => {
        const point = getMousePositionFromEvent(event);
        if (point) {
          this.mousePosition.next(point);
        }
        this.isMouseDown.next(false);
        if ((event.target as any)['nodeName'] === 'canvas') {
          this.mouseClicked.next(this.mousePosition.getValue());
        }
      });
    // viewport size
    merge(fromEvent(window, 'resize'), fromEvent(window, 'orientationchange'))
      .pipe(
        takeUntil(this.destroy$),
        map(() => getCurrentWindowSize()),
      )
      .subscribe(this.viewportSize);
  }

  public deactivate(): void {
    if (!this.destroy$) {
      throw new Error('GgViewport is already inactive');
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.destroy$ = null;
  }

  // ================================================== VIEWPORT SIZE ==================================================
  private viewportSize: BehaviorSubject<Point2> = new BehaviorSubject<Point2>(getCurrentWindowSize());

  getCurrentViewportSize(): Point2 {
    return this.viewportSize.getValue();
  }

  subscribeOnViewportSize(): Observable<Point2> {
    return this.viewportSize.asObservable().pipe(
      distinctUntilChanged((v1, v2) => {
        return v1.x === v2.x && v1.y === v2.y;
      }),
    );
  }

  // ================================================== VIEWPORT SIZE ==================================================

  // ================================================== POINTER LOGIC ==================================================
  private mousePosition: BehaviorSubject<Point2> = new BehaviorSubject<Point2>({ x: 0, y: 0 });
  private mouseClicked: Subject<Point2> = new Subject<Point2>();
  private isMouseDown: Subject<boolean> = new Subject<boolean>();

  isMouseEnabled(): boolean {
    return matchMedia('(hover:hover)').matches && matchMedia('(pointer:fine)').matches;
  }

  isTouchDevice(): boolean {
    return (
      'createTouch' in document ||
      !!navigator.userAgent.match(/(iPhone|iPod|iPad)/) ||
      !!navigator.userAgent.match(/Android/)
    );
  }

  subscribeOnMouseMove(): Observable<Point2> {
    return this.mousePosition.asObservable().pipe(
      distinctUntilChanged((v1, v2) => {
        return v1.x === v2.x && v1.y === v2.y;
      }),
    );
  }

  subscribeOnIsMouseDown(): Observable<boolean> {
    return this.isMouseDown.asObservable().pipe(distinctUntilChanged());
  }

  subscribeOnMouseClick(): Observable<Point2> {
    return this.mouseClicked.asObservable();
  }

  // ================================================== POINTER LOGIC ==================================================
}
