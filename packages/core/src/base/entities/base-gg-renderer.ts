import { GgEntity, GGTickOrder } from './gg-entity';
import { Point2 } from '../models/points';
import { GgWorld } from '../gg-world';
import { auditTime, BehaviorSubject, fromEvent, merge, Observable, takeUntil } from 'rxjs';
import { distinctUntilChanged, map, startWith } from 'rxjs/operators';

/**
 * Represents the options that can be passed to a renderer.
 * @typedef {Object} RendererOptions
 * @property {boolean} transparent - Specifies whether pixels can be transparent. false by default.
 * @property {number} background - Specifies the background color of the renderer. black by default.
 * @property {Point2 | 'fullscreen' | ((pageSize: Point2) => Point2) | Observable<Point2>} size - Specifies the size of the renderer and canvas if set. 'fullscreen' by default.
 * @property {number} [forceResolution] - Specifies the pixel resolution. Not set by default, which means "use device resolution".
 * @property {boolean} antialias - Specifies whether antialiasing is turned on/off. true by default.
 */
export type RendererOptions = {
  transparent: boolean;
  background: number;
  size: Point2 | 'fullscreen' | ((pageSize: Point2) => Point2) | Observable<Point2>;
  forceResolution?: number;
  antialias: boolean;
};

const DEFAULT_RENDERER_OPTIONS: RendererOptions = {
  transparent: false,
  background: 0x000000,
  size: 'fullscreen',
  antialias: true,
};

/**
 * Represents an abstract base class for a renderer controller.
 * @abstract
 * @class
 */
export abstract class BaseGgRenderer extends GgEntity {
  public readonly tickOrder = GGTickOrder.RENDERING;
  /** Specifies the options for the renderer. */
  public readonly rendererOptions: RendererOptions;
  /** Represents the current size of the renderer. */
  protected _rendererSize$: BehaviorSubject<Point2 | null> = new BehaviorSubject<Point2 | null>(null);
  /**
   * Gets the observable that represents the current size of the renderer.
   * @returns {Observable<Point2 | null>} - An observable that represents the size of the renderer.
   */
  public get rendererSize$(): Observable<Point2 | null> {
    return this._rendererSize$.asObservable();
  }

  /**
   Gets the current size of the renderer.
   @returns {Point2 | null} - The size of the renderer.
   */
  public get rendererSize(): Point2 | null {
    return this._rendererSize$.getValue();
  }

  /**
   Initializes a new instance of the BaseGgRenderer class.
   @param {HTMLCanvasElement} [canvas] - The canvas element to render onto.
   @param {Partial<RendererOptions>} [options={}] - The options to configure the renderer.
   */
  protected constructor(protected readonly canvas?: HTMLCanvasElement, options: Partial<RendererOptions> = {}) {
    super();
    this.rendererOptions = {
      ...DEFAULT_RENDERER_OPTIONS,
      ...(options || {}),
    };
    this.tick$.subscribe(() => {
      this.render();
    });
  }

  /**
   * Renders the scene.
   */
  abstract render(): void;

  /**
   * Resizes the renderer to the specified size.
   * @param {Point2} newSize - The new size of the renderer.
   */
  protected abstract resizeRenderer(newSize: Point2): void;

  onSpawned(world: GgWorld<any, any>) {
    super.onSpawned(world);
    this._rendererSize$.next(null);
    if (this.rendererOptions.size == 'fullscreen' || this.rendererOptions.size instanceof Function) {
      if (this.canvas) {
        this.canvas.style.position = 'absolute';
      }
      merge(fromEvent(window, 'resize').pipe(auditTime(100)), fromEvent(window, 'orientationchange'))
        .pipe(
          takeUntil(this._onRemoved$),
          map(() => ({ x: window.innerWidth, y: window.innerHeight })),
          startWith({ x: window.innerWidth, y: window.innerHeight }),
        )
        .subscribe(size => {
          this._rendererSize$.next(
            this.rendererOptions.size instanceof Function ? this.rendererOptions.size(size) : size,
          );
        });
    } else if (
      this.rendererOptions.size instanceof Observable ||
      // for cases when project uses two separate rxjs packages, instanceof can return false for observable
      (!!(this.rendererOptions as any).subscribe !== undefined && !!(this.rendererOptions as any).pipe !== undefined)
    ) {
      (this.rendererOptions.size as Observable<Point2>).pipe(takeUntil(this._onRemoved$)).subscribe(newSize => {
        this._rendererSize$.next(newSize);
      });
    } else {
      this._rendererSize$.next(this.rendererOptions.size);
    }
    this._rendererSize$
      .pipe(
        takeUntil(this._onRemoved$),
        distinctUntilChanged((a, b) => a?.x == b?.x && a?.y == b?.y),
      )
      .subscribe(size => {
        if (size) {
          this.resizeRenderer(size);
          if (this.canvas) {
            this.canvas!.width = size.x;
            this.canvas!.height = size.y;
          }
        }
      });
  }

  dispose() {
    super.dispose();
    this._rendererSize$.complete();
  }
}
