import { Subject } from 'rxjs';

/**
 * Where a control sits inside the overlay and how big it is. A number is a multiple of the overlay's
 * `--gg-mc-unit` (an edge offset also keeps clear of the device's safe-area inset on that side); a
 * string is used as a CSS value as is. Leave `width`/`height` out to keep the size the stylesheet
 * gives that kind of control.
 */
export type ControlPlacement = {
  left?: number | string;
  right?: number | string;
  top?: number | string;
  bottom?: number | string;
  width?: number | string;
  height?: number | string;
};

export type TouchControlOptions = {
  /**
   * Identifies the control within its layout. Becomes the element's `gg-mc-id-<id>` class and
   * `data-gg-mc` attribute, for styling one control from CSS.
   */
  id?: string;
  placement?: ControlPlacement;
  /** Extra CSS class names for the element, space-separated. */
  className?: string;
  /** Accessible name of the control. */
  label?: string;
};

const EDGES = ['left', 'right', 'top', 'bottom'] as const;

/**
 * Sets a control element's inline position/size from a `ControlPlacement`.
 */
export function applyControlPlacement(element: HTMLElement, placement: ControlPlacement): void {
  for (const edge of EDGES) {
    const value = placement[edge];
    if (value !== undefined) {
      element.style.setProperty(
        edge,
        typeof value === 'number' ? `calc(var(--gg-mc-unit) * ${value} + env(safe-area-inset-${edge}, 0px))` : value,
      );
    }
  }
  for (const dimension of ['width', 'height'] as const) {
    const value = placement[dimension];
    if (value !== undefined) {
      element.style.setProperty(dimension, typeof value === 'number' ? `calc(var(--gg-mc-unit) * ${value})` : value);
    }
  }
}

/**
 * The base of every on-screen control: owns one DOM element and follows one pointer on it at a time.
 * A control is plain DOM with no dependency on a world, so it works inside a `MobileControls` overlay
 * and equally in an app's own markup - append `element` anywhere.
 *
 * A pointer that goes down on the control is captured by it and never reaches the elements below
 * (the game canvas, a `MouseInput` listening on the window).
 */
export abstract class TouchControl {
  public readonly element: HTMLElement;
  public readonly id: string | undefined;

  protected readonly disposed$: Subject<void> = new Subject<void>();
  private activePointerId: number | null = null;
  private _disposed: boolean = false;

  public get disposed(): boolean {
    return this._disposed;
  }

  /** Whether a pointer is currently down on the control. */
  public get touched(): boolean {
    return this.activePointerId !== null;
  }

  protected constructor(kind: string, options: TouchControlOptions) {
    this.id = options.id;
    this.element = document.createElement('div');
    this.element.className = `gg-mc-control gg-mc-${kind}`;
    if (options.id) {
      this.element.classList.add(`gg-mc-id-${options.id}`);
      this.element.dataset.ggMc = options.id;
    }
    if (options.className) {
      this.element.classList.add(...options.className.split(/\s+/).filter(x => !!x));
    }
    if (options.label) {
      this.element.setAttribute('aria-label', options.label);
    }
    if (options.placement) {
      applyControlPlacement(this.element, options.placement);
    }
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerEnd = this.handlePointerEnd.bind(this);
    this.element.addEventListener('pointerdown', this.handlePointerDown);
    this.element.addEventListener('pointermove', this.handlePointerMove);
    this.element.addEventListener('pointerup', this.handlePointerEnd);
    this.element.addEventListener('pointercancel', this.handlePointerEnd);
    this.element.addEventListener('lostpointercapture', this.handlePointerEnd);
    this.element.addEventListener('contextmenu', e => e.preventDefault());
    // stops the long-press text selection/magnifier of iOS, which `touch-action` does not cover
    this.element.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  }

  /**
   * Returns the control to its untouched state, releasing whatever it holds (a pressed button, a
   * deflected stick). A latched toggle button is released too.
   */
  public reset(): void {
    if (this.activePointerId !== null) {
      this.releaseCapture(this.activePointerId);
      this.activePointerId = null;
      this.onPointerEnd(null);
    }
  }

  /**
   * Resets the control, completes its observables (ending every binding made through it) and removes
   * its element from the document.
   */
  public dispose(): void {
    if (this._disposed) {
      return;
    }
    this.reset();
    this._disposed = true;
    this.disposed$.next();
    this.disposed$.complete();
    this.element.remove();
  }

  protected abstract onPointerStart(event: PointerEvent): void;

  protected onPointerMove(event: PointerEvent): void {}

  /** `event` is `null` when the control was reset rather than released by the pointer. */
  protected abstract onPointerEnd(event: PointerEvent | null): void;

  private handlePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.activePointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    this.activePointerId = event.pointerId;
    try {
      this.element.setPointerCapture(event.pointerId);
    } catch (err) {
      // not capturable (a synthetic event, a pointer already gone): the control still works while
      // the pointer stays over it
    }
    this.onPointerStart(event);
  }

  private handlePointerMove(event: PointerEvent): void {
    event.stopPropagation();
    if (event.pointerId === this.activePointerId) {
      event.preventDefault();
      this.onPointerMove(event);
    }
  }

  private handlePointerEnd(event: PointerEvent): void {
    event.stopPropagation();
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.activePointerId = null;
    this.releaseCapture(event.pointerId);
    this.onPointerEnd(event);
  }

  private releaseCapture(pointerId: number): void {
    try {
      this.element.releasePointerCapture(pointerId);
    } catch (err) {
      // was not captured
    }
  }
}
