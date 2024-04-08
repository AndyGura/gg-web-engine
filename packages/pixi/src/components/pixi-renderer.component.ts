import { Gg2dWorld, IRenderer2dComponent, Point2, RendererOptions } from '@gg-web-engine/core';
import { Application } from 'pixi.js';
import { PixiSceneComponent } from './pixi-scene.component';
import { PixiVisualTypeDocRepo2D } from '../types';
import { first, Subject } from 'rxjs';

export class PixiRendererComponent extends IRenderer2dComponent<PixiVisualTypeDocRepo2D> {
  public readonly application: Application;
  private initialized: boolean = false;
  private onInitialized$: Subject<void> = new Subject();

  constructor(
    public readonly scene: PixiSceneComponent,
    public readonly canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions> = {},
  ) {
    super(scene, canvas, options);
    this.application = new Application();
    this.application
      .init({
        canvas,
        backgroundAlpha: this.rendererOptions.transparent ? 0 : 1,
        autoDensity: this.rendererOptions.forceResolution === undefined,
        resolution: this.rendererOptions.forceResolution || devicePixelRatio,
        width: 0,
        height: 0,
        antialias: this.rendererOptions.antialias,
        backgroundColor: this.rendererOptions.background,
        // preventing ticks
        autoStart: false,
        sharedTicker: false,
      })
      .then(() => {
        // GG uses own ticker, disable pixi ticker for this renderer
        this.application.ticker.stop();
        this.application.ticker.destroy();
        (this.application as any)._ticker = null!;
        this.initialized = true;
        this.onInitialized$.next();
        this.onInitialized$.complete();
      });
  }

  resizeRenderer(newSize: Point2): void {
    if (this.initialized) {
      this.application.renderer.resize(newSize.x, newSize.y);
    } else {
      this.onInitialized$.pipe(first()).subscribe(() => this.resizeRenderer(newSize));
    }
  }

  addToWorld(world: Gg2dWorld<PixiVisualTypeDocRepo2D>): void {
    this.application.stage.addChild(this.scene.nativeContainer!);
  }

  removeFromWorld(world: Gg2dWorld<PixiVisualTypeDocRepo2D>): void {
    this.application.stage.removeChild(this.scene.nativeContainer!);
  }

  render(): void {
    if (this.initialized) {
      this.application.render();
    } else {
      this.onInitialized$.pipe(first()).subscribe(() => this.render());
    }
  }

  dispose(): void {
    this.application.destroy(true, true);
  }
}
