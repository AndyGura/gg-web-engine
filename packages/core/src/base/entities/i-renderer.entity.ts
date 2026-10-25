import { IEntity, TickOrder } from './i-entity';
import { GgWorld, GgWorldTypeDocVPatch, VisualTypeDocRepo } from '../gg-world';
import { BehaviorSubject, Observable, takeUntil } from 'rxjs';
import { distinctUntilChanged, filter } from 'rxjs/operators';
import { Point2 } from '../models/points';
import { RendererOptions } from '../components/rendering/i-renderer.component';
import { viewportSize$ } from '../components/rendering/viewport';
import { IPositionable } from '../interfaces/i-positionable';
import { markCanvasReleased } from '../components/rendering/canvas-reuse';

/**
 * Represents a base class for a renderer entity.
 * @class
 */
export abstract class IRendererEntity<D, R, VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IEntity<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>
  implements IPositionable<D, R>
{
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

  public get camera(): VTypeDoc['camera'] {
    return this.renderer.camera;
  }

  public get position(): D {
    return this.camera.position;
  }

  set position(value: D) {
    this.renderer.camera.position = value;
  }

  public get rotation(): R {
    return this.renderer.camera.rotation;
  }

  set rotation(value: R) {
    this.renderer.camera.rotation = value;
  }

  /** get flag whether renderer shows physics debugger view */
  get physicsDebugViewActive(): boolean {
    return this.renderer.physicsDebugViewActive;
  }

  /** turns on/off physics debugger view for this renderer */
  set physicsDebugViewActive(value: boolean) {
    this.renderer.physicsDebugViewActive = value;
  }

  /**
   Initializes a new instance of the BaseGgRenderer class.
   * @param renderer
   */
  constructor(public readonly renderer: VTypeDoc['renderer']) {
    super();
    this.addComponents(renderer);
    this.tick$.subscribe(() => {
      this.renderer.render();
    });
  }

  onSpawned(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>) {
    this._rendererSize$.next(null);
    const size = this.rendererOptions.size;
    if (size == 'fullscreen' || typeof size === 'function') {
      if (this.renderer.canvas) {
        this.renderer.canvas.style.position = 'absolute';
      }
      viewportSize$()
        .pipe(takeUntil(this._onRemoved$))
        .subscribe(pageSize => {
          this._rendererSize$.next(typeof size === 'function' ? size(pageSize) : pageSize);
        });
    } else if (isObservableLike<Point2>(size)) {
      size.pipe(takeUntil(this._onRemoved$)).subscribe(newSize => {
        this._rendererSize$.next(newSize);
      });
    } else {
      this._rendererSize$.next(size);
    }
    const resolution = this.rendererOptions.forceResolution;
    if (isObservableLike<number>(resolution)) {
      resolution
        .pipe(
          takeUntil(this._onRemoved$),
          filter(value => typeof value === 'number' && value > 0 && isFinite(value)),
          distinctUntilChanged(),
        )
        .subscribe(value => this.renderer.setResolution(value));
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

  /**
   * Disposes the renderer, which releases its canvas's WebGL context: that canvas can't host
   * another renderer (`addRenderer` throws for it) - use `replaceCanvas` for the next one.
   */
  dispose() {
    super.dispose();
    this._rendererSize$.complete();
    markCanvasReleased(this.renderer.canvas);
  }
}

/**
 * Whether `x` is an observable. Checked by shape rather than `instanceof`: an app can end up with two
 * copies of rxjs, and an observable of the other copy fails `instanceof Observable`.
 */
function isObservableLike<T>(x: unknown): x is Observable<T> {
  return (
    x instanceof Observable ||
    (!!x && typeof (x as any).subscribe === 'function' && typeof (x as any).pipe === 'function')
  );
}
