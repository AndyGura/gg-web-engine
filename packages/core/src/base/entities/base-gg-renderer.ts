import { GgVisualScene } from '../interfaces/gg-visual-scene';
import { ITickListener } from './interfaces/i-tick-listener';
import { Subject, Subscription } from 'rxjs';
import { GgEntity } from './gg-entity';

export abstract class BaseGgRenderer extends GgEntity implements ITickListener {

  protected _permanentRenderMethods: Map<number, Function>;
  protected _singularRenderMethods: Map<number, Function>;
  private initialized = false;

  readonly tick$: Subject<[number, number]>;
  public readonly tickOrder = 1000;
  protected tickListener: Subscription | null = null;

  protected constructor(
    protected readonly scene: GgVisualScene<any, any>,
  ) {
    super();
    this._permanentRenderMethods = new Map<number, Function>();
    this._singularRenderMethods = new Map<number, Function>();
    this.tick$ = new Subject<[number, number]>();
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
    this.tickListener = this.tick$.subscribe(() => { this.render(); });
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

  abstract dispose(): void;

}
