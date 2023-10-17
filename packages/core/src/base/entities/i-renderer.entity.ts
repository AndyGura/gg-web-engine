import { IEntity, TickOrder } from './i-entity';
import { GgWorld } from '../gg-world';
import { auditTime, BehaviorSubject, fromEvent, merge, Observable, startWith, takeUntil } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { Point2 } from '../models/points';
import { IRendererComponent, RendererOptions } from '../components/rendering/i-renderer.component';
import { IVisualSceneComponent } from '../components/rendering/i-visual-scene.component';

/**
 * Represents a base class for a renderer entity.
 * @class
 */
export abstract class IRendererEntity<
  D,
  R,
  VS extends IVisualSceneComponent<D, R> = IVisualSceneComponent<D, R>,
  RC extends IRendererComponent<D, R, VS> = IRendererComponent<D, R, VS>,
> extends IEntity<D, R, VS> {
  public readonly tickOrder = TickOrder.RENDERING;
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

  public get rendererOptions(): RendererOptions {
    return this.renderer.rendererOptions;
  }

  /**
   Initializes a new instance of the BaseGgRenderer class.
   * @param renderer
   */
  constructor(public readonly renderer: RC) {
    super();
    this.addComponents(renderer);
    this.tick$.subscribe(() => {
      this.renderer.render();
    });
  }

  onSpawned(world: GgWorld<D, R, VS, any>) {
    this._rendererSize$.next(null);
    if (this.rendererOptions.size == 'fullscreen' || typeof this.rendererOptions.size === 'function') {
      if (this.renderer.canvas) {
        this.renderer.canvas.style.position = 'absolute';
      }
      merge(fromEvent(window, 'resize').pipe(auditTime(100)), fromEvent(window, 'orientationchange'))
        .pipe(
          takeUntil(this._onRemoved$),
          map(() => ({ x: window.innerWidth, y: window.innerHeight })),
          startWith({ x: window.innerWidth, y: window.innerHeight }),
        )
        .subscribe(size => {
          this._rendererSize$.next(
            typeof this.rendererOptions.size === 'function' ? this.rendererOptions.size(size) : size,
          );
        });
    } else if (
      this.rendererOptions.size instanceof Observable ||
      // for cases when project uses two separate rxjs packages, instanceof can return false for observable
      ((this.rendererOptions.size as any).subscribe !== undefined &&
        (this.rendererOptions.size as any).pipe !== undefined)
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
          this.renderer.resizeRenderer(size);
        }
      });
    super.onSpawned(world);
  }

  dispose() {
    super.dispose();
    this._rendererSize$.complete();
  }
}
