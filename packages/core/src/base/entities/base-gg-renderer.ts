import { GgEntity, GGTickOrder } from './gg-entity';
import { Point2 } from '../models/points';
import { GgViewportManager } from '../gg-viewport-manager';
import { GgWorld } from '../gg-world';

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

  protected constructor(protected readonly canvas?: HTMLCanvasElement, options: Partial<RendererOptions> = {}) {
    super();
    this.rendererOptions = {
      transparent: false,
      background: 0x000000,
      antialias: true,
      ...(options || {}),
    };
    this.tick$.subscribe(() => {
      this.render();
    });
  }

  abstract render(): void;

  abstract resize(newSize: Point2): void;

  onSpawned(world: GgWorld<any, any>) {
    super.onSpawned(world);
    if (this.canvas) {
      setTimeout(() => {
        GgViewportManager.instance.assignRendererToCanvas(this, this.canvas!).then();
      }, 0);
    }
  }

  onRemoved() {
    super.onRemoved();
    if (this.canvas) {
      setTimeout(() => {
        GgViewportManager.instance.deregisterCanvas(this.canvas!).then();
      }, 0);
    }
  }
}
