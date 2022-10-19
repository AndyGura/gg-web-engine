import { ITickListener } from './interfaces/i-tick-listener';
import { Subject, Subscription } from 'rxjs';
import { GgEntity } from './gg-entity';
import { Point2 } from '../models/points';
import { GgViewportManager } from '../gg-viewport-manager';

export type RendererOptions = {
  transparent: boolean;
  background: number;
  forceRendererSize?: Point2;
  forceResolution?: number;
  antialias: boolean;
}

export abstract class BaseGgRenderer extends GgEntity implements ITickListener {

  protected _permanentRenderMethods: Map<number, Function>;
  protected _singularRenderMethods: Map<number, Function>;
  private initialized = false;

  readonly tick$: Subject<[number, number]>;
  public readonly tickOrder = 1000;
  protected tickListener: Subscription | null = null;

  public readonly rendererOptions: RendererOptions;

  protected constructor(
    canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions> = {},
  ) {
    super();
    this.rendererOptions = {
      transparent: false,
      background: 0x000000,
      antialias: true,
      ...(options || {}),
    };
    this._permanentRenderMethods = new Map<number, Function>();
    this._singularRenderMethods = new Map<number, Function>();
    this.tick$ = new Subject<[number, number]>();
    if (canvas) {
      setTimeout(() => {
        GgViewportManager.instance.assignRendererToCanvas(this, canvas).then()
      }, 0);
    }
  }

  public get isActive(): boolean {
    return !!this.tickListener;
  }

  public activate(): void {
    if (this.isActive) {
      return;
    }
    if (!this.initialized) {
      this.init();
    }
    this.tickListener = this.tick$.subscribe(() => {
      this.render();
    });
  }

  public deactivate(): void {
    if (!this.isActive) {
      return;
    }
    this.tickListener?.unsubscribe();
    this.tickListener = null;
  }

  init(): void {
    this.initialized = true;
  };

  abstract render(): void;

  abstract resize(newSize: Point2): void;

  abstract dispose(): void;

}
