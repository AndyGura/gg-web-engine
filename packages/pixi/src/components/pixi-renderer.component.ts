import { Gg2dWorld, IRenderer2dComponent, Point2, RendererOptions } from '@gg-web-engine/core';
import { Application, Renderer } from 'pixi.js';
import { PixiSceneComponent } from './pixi-scene.component';
import { PixiVisualTypeDocRepo2D } from '../types';

export class PixiRendererComponent extends IRenderer2dComponent<PixiVisualTypeDocRepo2D> {
  public readonly application: Application;

  constructor(
    public readonly scene: PixiSceneComponent,
    public readonly canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions> = {},
  ) {
    super(scene, canvas, options);
    this.application = new Application({
      view: canvas,
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
    });
    // GG uses own ticker, disable pixi ticker for this renderer
    this.application.ticker.stop();
    this.application.ticker.destroy();
    (this.application as any)._ticker = null!;
  }

  resizeRenderer(newSize: Point2): void {
    this.application.renderer.resize(newSize.x, newSize.y);
  }

  addToWorld(world: Gg2dWorld<PixiVisualTypeDocRepo2D>): void {
    this.application.stage.addChild(this.scene.nativeContainer!);
  }

  removeFromWorld(world: Gg2dWorld<PixiVisualTypeDocRepo2D>): void {
    this.application.stage.removeChild(this.scene.nativeContainer!);
  }

  render(): void {
    this.application.render();
  }

  dispose(): void {
    // cleanup everything including view (canvas). Canvas cannot be reused later anyway after "soft" destroy of PIXI app
    if (this.application.renderer instanceof Renderer) {
      this.application.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.application.destroy(true, true);
  }
}
