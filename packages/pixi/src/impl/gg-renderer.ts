import { BaseGgRenderer, Gg2dWorld, GgViewport, Point2, RendererOptions } from '@gg-web-engine/core';
import { Application, Renderer, Ticker } from 'pixi.js';
import { Gg2dVisualScene } from './gg-2d-visual-scene';


export class GgRenderer extends BaseGgRenderer {

  public readonly application: Application;

  constructor(
    canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions> = {},
  ) {
    super(canvas, rendererOptions);
    // GG uses own ticker, disable pixi ticker
    Ticker.shared.autoStart = false;
    Ticker.shared.stop();
    const size = this.rendererOptions.forceRendererSize || GgViewport.instance.getCurrentViewportSize();
    this.application = new Application({
      view: canvas,
      backgroundAlpha: this.rendererOptions.transparent ? 0 : 1,
      autoDensity: this.rendererOptions.forceResolution === undefined,
      resolution: this.rendererOptions.forceResolution,
      width: size.x,
      height: size.y,
      antialias: this.rendererOptions.antialias,
      backgroundColor: this.rendererOptions.background,
    });
  }

  resize(newSize: Point2): void {
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
    if (this.application.renderer instanceof Renderer) {
      this.application.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.application.destroy(true, true);
  }

}
