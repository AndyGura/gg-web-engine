import { Gg2dRenderer, Gg2dWorld, Point2, RendererOptions } from '@gg-web-engine/core';
import { Application, Renderer } from 'pixi.js';
import { Gg2dVisualScene } from './gg-2d-visual-scene';

export class GgRenderer extends Gg2dRenderer {
  public readonly application: Application;

  constructor(canvas?: HTMLCanvasElement, rendererOptions: Partial<RendererOptions> = {}) {
    super(canvas, rendererOptions);
    this.application = new Application({
      view: canvas,
      backgroundAlpha: this.rendererOptions.transparent ? 0 : 1,
      autoDensity: this.rendererOptions.forceResolution === undefined,
      resolution: this.rendererOptions.forceResolution,
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

  public onSpawned(world: Gg2dWorld) {
    super.onSpawned(world);
    this.application.stage.addChild((this.world!.visualScene as Gg2dVisualScene).nativeContainer!);
  }

  public onRemoved() {
    this.application.stage.removeChild((this.world!.visualScene as Gg2dVisualScene).nativeContainer!);
    super.onRemoved();
  }

  render(): void {
    this.application.render();
  }

  dispose(): void {
    super.dispose();
    if (this.application.renderer instanceof Renderer) {
      this.application.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.application.destroy(true, true);
  }
}
