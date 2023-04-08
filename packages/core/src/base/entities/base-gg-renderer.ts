import { GgEntity, GGTickOrder } from './gg-entity';
import { Point2 } from '../models/points';
import { GgViewportManager } from '../gg-viewport-manager';

export type RendererOptions = {
  transparent: boolean;
  background: number;
  forceRendererSize?: Point2;
  forceResolution?: number;
  antialias: boolean;
};

export abstract class BaseGgRenderer extends GgEntity {
  public readonly tickOrder = GGTickOrder.RENDERING;

  public readonly rendererOptions: RendererOptions;

  protected constructor(canvas?: HTMLCanvasElement, options: Partial<RendererOptions> = {}) {
    super();
    this.rendererOptions = {
      transparent: false,
      background: 0x000000,
      antialias: true,
      ...(options || {}),
    };
    if (canvas) {
      setTimeout(() => {
        GgViewportManager.instance.assignRendererToCanvas(this, canvas).then();
      }, 0);
    }
    this.tick$.subscribe(() => {
      this.render();
    });
  }

  abstract render(): void;

  abstract resize(newSize: Point2): void;
}
