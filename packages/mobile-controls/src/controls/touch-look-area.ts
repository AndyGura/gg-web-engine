import { Observable, Subject, takeUntil } from 'rxjs';
import { MouseInput, Point2 } from '@gg-web-engine/core';
import { TouchControl, TouchControlOptions } from './touch-control';

export type TouchLookAreaOptions = TouchControlOptions & {
  /** How far, in pixels, a touch may move and still count as a tap. 10 by default. */
  tapDistance?: number;
  /** How long, in milliseconds, a touch may last and still count as a tap. 250 by default. */
  tapDuration?: number;
};

/**
 * An invisible area that reports how a finger drags across it - the touch counterpart of moving the
 * mouse to look around. Fills the whole overlay unless placed; put it before the other controls, so
 * they stay on top of it.
 */
export class TouchLookArea extends TouchControl {
  private readonly _delta$: Subject<Point2> = new Subject<Point2>();
  private readonly _tap$: Subject<Point2> = new Subject<Point2>();
  private readonly tapDistance: number;
  private readonly tapDuration: number;
  private last: Point2 = { x: 0, y: 0 };
  private start: { x: number; y: number; time: number; moved: boolean } | null = null;

  /** The movement of the dragging finger since its previous report, in pixels. */
  public get delta$(): Observable<Point2> {
    return this._delta$.pipe(takeUntil(this.disposed$));
  }

  /** A short touch that did not turn into a drag, with its client position. */
  public get tap$(): Observable<Point2> {
    return this._tap$.pipe(takeUntil(this.disposed$));
  }

  constructor(options: TouchLookAreaOptions = {}) {
    super('look-area', options);
    this.tapDistance = options.tapDistance ?? 10;
    this.tapDuration = options.tapDuration ?? 250;
    if (!options.placement) {
      this.element.style.inset = '0';
    }
  }

  /**
   * Makes dragging over the area turn a view the way moving the mouse does: every drag is reported
   * by `mouse` as a movement, multiplied by `sensitivity`.
   */
  public bindMouse(mouse: MouseInput, sensitivity: number = 1): this {
    this.delta$.subscribe(delta => mouse.emulateMove({ x: delta.x * sensitivity, y: delta.y * sensitivity }));
    return this;
  }

  protected onPointerStart(event: PointerEvent): void {
    this.last = { x: event.clientX, y: event.clientY };
    this.start = { x: event.clientX, y: event.clientY, time: event.timeStamp, moved: false };
  }

  protected onPointerMove(event: PointerEvent): void {
    const delta = { x: event.clientX - this.last.x, y: event.clientY - this.last.y };
    this.last = { x: event.clientX, y: event.clientY };
    if (this.start && Math.hypot(event.clientX - this.start.x, event.clientY - this.start.y) > this.tapDistance) {
      this.start.moved = true;
    }
    if (delta.x !== 0 || delta.y !== 0) {
      this._delta$.next(delta);
    }
  }

  protected onPointerEnd(event: PointerEvent | null): void {
    const start = this.start;
    this.start = null;
    if (event && event.type === 'pointerup' && start && !start.moved) {
      if (event.timeStamp - start.time <= this.tapDuration) {
        this._tap$.next({ x: event.clientX, y: event.clientY });
      }
    }
  }
}
